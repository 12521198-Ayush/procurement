/**
 * Client-side audit trail. Records every API call (fetch + XHR, so axios too),
 * screen views and sign-in/out, and ships them to audit-service in batches.
 *
 * Isolation guarantees (the app must never notice the audit service):
 *  - requests are never delayed or altered; recording happens after the fact
 *    and every hook is wrapped in try/catch;
 *  - events are buffered in memory + localStorage and retried with backoff, so
 *    audit-service downtime only delays delivery; event_id makes resends idempotent;
 *  - uploads use the original fetch with text/plain (no CORS preflight).
 *
 * Kept identical in SERVIZING-NEXTJS, Resident_android and procurement-frontend.
 */

export type AuditApp = 'admin-panel' | 'resident-app' | 'procurement';

export type AuditIdentity = {
    token?: string | null;
    name?: string | null;
    mobile?: string | null;
    designation?: string | null;
    premise_id?: string | null;
    premise_name?: string | null;
};

export type AuditConfig = {
    app: AuditApp;
    /** Base URL of audit-service, e.g. https://api.servizing.app/audit-service */
    endpoint: string;
    /** Pull-style identity (apps without a session provider). */
    resolveIdentity?: () => AuditIdentity;
    /** Requests whose path matches are recorded as a sign-in (outcome from the response). */
    loginPaths?: RegExp[];
    /** Requests whose path matches are recorded as a sign-out. */
    logoutPaths?: RegExp[];
    /** Extra masking for secrets that appear in screen paths. */
    maskPath?: (path: string) => string;
    /** Name the backend a URL belongs to when the path does not say it. */
    serviceFor?: (url: URL) => string | null;
};

type Kind = 'api' | 'page_view' | 'auth';

type AuditEvent = {
    event_id: string;
    kind: Kind;
    action: string | null;
    ts: string;
    last_ts?: string;
    count: number;
    premise_id: string | null;
    premise_name: string | null;
    screen: string;
    session_id: string;
    platform: string;
    actor: { name: string | null; mobile: string | null; designation: string | null };
    request?: {
        method: string;
        host: string;
        service: string | null;
        path: string;
        query: unknown;
        body: unknown;
        background: boolean;
    };
    response?: { status: number; duration_ms: number; error_message: string | null; business_error?: boolean };
};

type Batch = { tk: string | null; events: AuditEvent[] };

type CallInfo = {
    method: string;
    url: URL;
    body: unknown;
    background: boolean;
    start: number;
    auth: 'login' | 'logout' | null;
    /** null = not known yet; resolved when the held event is built. */
    identity: AuditIdentity | null;
    screen: string;
};

const FLUSH_MS = 15000;
const COLLAPSE_MS = 60000;
const MAX_EVENTS_PER_BATCH = 50;
const MAX_PAYLOAD_BYTES = 60000;
const MAX_QUEUED_EVENTS = 1000;
const MAX_BACKOFF_MS = 5 * 60000;
const IDENTITY_WAIT_MS = 10000;
const PENDING_LOGIN_MS = 5 * 60000;
const STORAGE_PREFIX = '__audit_q_v1:';
const PENDING_LOGIN_KEY = '__audit_pending_login';

const SECRET_KEY = /pass(word)?|otp|token|secret|authori[sz]ation|cookie|(^|_)hash$|_hash|^pin$|_pin$|cvv|card_?num|account_?num|api_?key|signature|private|credential|x-amz|csrf/i;
const STATIC_FILE = /\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp3|mp4|webm|wasm|webmanifest)$/i;
const NEXT_AUTH_NOISE = /^\/api\/auth\/(session|csrf|providers|_log)$/;

let cfg: AuditConfig | null = null;
let identity: AuditIdentity = {};
let identityKnown = false;
let queue: Batch[] = [];
let held: Array<() => void> = [];
let sending = false;
let backoff = 0;
let nextAttemptAt = 0;
let lastPath = '';
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let sessionId = '';
let platform = 'web';
let origFetch: typeof fetch | null = null;

function safe(fn: () => void) {
    try {
        fn();
    } catch {
        // Auditing must never break the app.
    }
}

function randomId(prefix: string) {
    let rnd = '';
    try {
        const bytes = new Uint8Array(12);
        crypto.getRandomValues(bytes);
        rnd = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
        rnd = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    }
    return prefix + Date.now().toString(36) + rnd;
}

function detectPlatform() {
    const ua = navigator.userAgent || '';
    if (/; wv\)/.test(ua)) return 'android-app';
    if (/Android/i.test(ua)) return 'android-web';
    if (/iPhone|iPad|iPod/i.test(ua)) return /Safari/i.test(ua) ? 'ios-web' : 'ios-app';
    return 'web';
}

function maskPath(path: string) {
    let p = path
        .split('/')
        .map((seg) => (seg.length >= 40 ? ':token' : seg))
        .join('/');
    if (cfg?.maskPath) p = cfg.maskPath(p);
    return p;
}

function currentScreen() {
    return maskPath(window.location.pathname);
}

function sanitize(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.length > 300 ? `[${value.length} chars omitted]` : value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (depth >= 4) return '[nested]';
    if (Array.isArray(value)) {
        const out = value.slice(0, 20).map((v) => sanitize(v, depth + 1));
        if (value.length > 20) out.push(`[+${value.length - 20} more]`);
        return out;
    }
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        Object.keys(value as object)
            .slice(0, 50)
            .forEach((k) => {
                out[k] = SECRET_KEY.test(k) ? '[redacted]' : sanitize((value as Record<string, unknown>)[k], depth + 1);
            });
        return out;
    }
    return null;
}

function paramsToObject(params: URLSearchParams) {
    const out: Record<string, string> = {};
    params.forEach((v, k) => {
        out[k] = v;
    });
    return out;
}

function readBody(body: unknown): unknown {
    if (body === null || body === undefined || body === '') return null;
    if (typeof body === 'string') {
        const s = body.trim();
        if (s.startsWith('{') || s.startsWith('[')) {
            try {
                return sanitize(JSON.parse(s));
            } catch {
                return `[text ${s.length} chars]`;
            }
        }
        if (/^[^\s=&]+=[^\s]*(&[^\s=&]+=[^\s]*)*$/.test(s)) return sanitize(paramsToObject(new URLSearchParams(s)));
        return `[text ${s.length} chars]`;
    }
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return sanitize(paramsToObject(body));
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
        const keys: string[] = [];
        body.forEach((_v, k) => keys.push(k));
        return { '[form-data]': keys.slice(0, 30) };
    }
    return '[binary]';
}

function capBody(value: unknown) {
    if (value === null) return null;
    const s = JSON.stringify(value);
    return s.length > 4000 ? `[body ${s.length} bytes omitted]` : value;
}

function serviceAndPath(url: URL): { service: string | null; path: string } {
    const custom = cfg?.serviceFor?.(url);
    if (custom) return { service: custom, path: url.pathname };
    const segs = url.pathname.split('/');
    if (/service|consumer|producer/i.test(segs[1] || '')) {
        return { service: segs[1], path: '/' + segs.slice(2).join('/') };
    }
    if (url.origin === window.location.origin) return { service: url.pathname.startsWith('/api/') ? 'next-api' : 'web', path: url.pathname };
    return { service: url.host, path: url.pathname };
}

/** Pulls a readable message out of `{error:{message}}`, `{error:"x"}` or `{message}` envelopes. */
function errorFrom(payload: unknown): string | null {
    let data = payload;
    if (typeof data === 'string') {
        const s = data.trim();
        if (!s) return null;
        if (!s.startsWith('{')) return s.startsWith('<') ? null : s.slice(0, 300);
        try {
            data = JSON.parse(s);
        } catch {
            return s.slice(0, 300);
        }
    }
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, any>;
    const e = d.error;
    if (e && typeof e === 'object') return String(e.message || e.code || 'error').slice(0, 300);
    if (typeof e === 'string' && e) return e.slice(0, 300);
    if (typeof d.message === 'string' && d.success === false) return d.message.slice(0, 300);
    return null;
}

/** Cheap check before parsing a successful body for a business-error envelope. */
function looksLikeErrorEnvelope(text: string) {
    return text.length < 100000 && text.charAt(0) === '{' && /"error"\s*:\s*(\{|"[^"])|"success"\s*:\s*false/.test(text);
}

function currentIdentity(): AuditIdentity {
    if (cfg?.resolveIdentity) {
        try {
            return cfg.resolveIdentity() || {};
        } catch {
            return {};
        }
    }
    return identity;
}

// ---------------------------------------------------------------- queue

function storageKey() {
    return STORAGE_PREFIX + (cfg ? cfg.app : '') + ':' + sessionId;
}

function queuedCount() {
    return queue.reduce((n, b) => n + b.events.length, 0);
}

function persistSoon() {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
        persistTimer = null;
        persist();
    }, 1000);
}

function persist() {
    safe(() => {
        if (!queue.length) {
            localStorage.removeItem(storageKey());
            return;
        }
        try {
            localStorage.setItem(storageKey(), JSON.stringify(queue));
        } catch {
            // Quota: keep the newest half.
            trimTo(Math.floor(queuedCount() / 2));
            localStorage.setItem(storageKey(), JSON.stringify(queue));
        }
    });
}

function trimTo(max: number) {
    let excess = queuedCount() - max;
    while (excess > 0 && queue.length) {
        const first = queue[0];
        const drop = Math.min(excess, first.events.length);
        first.events.splice(0, drop);
        excess -= drop;
        if (!first.events.length) queue.shift();
    }
}

/** Adopts queues left behind by closed tabs. Live tabs re-send theirs; the server dedupes. */
function restore() {
    safe(() => {
        const prefix = STORAGE_PREFIX + (cfg ? cfg.app : '') + ':';
        const seen = new Set<string>();
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) keys.push(k);
        }
        keys.forEach((k) => {
            try {
                const batches = JSON.parse(localStorage.getItem(k) || '[]') as Batch[];
                batches.forEach((b) => {
                    const events = (b.events || []).filter((e) => e && e.event_id && !seen.has(e.event_id));
                    events.forEach((e) => seen.add(e.event_id));
                    if (events.length) queue.push({ tk: b.tk || null, events });
                });
            } catch {
                // Corrupt entry; drop it.
            }
            localStorage.removeItem(k);
        });
        trimTo(MAX_QUEUED_EVENTS);
        persist();
    });
}

function collapseKey(e: AuditEvent) {
    if (e.kind !== 'api' || !e.request || !e.response) return null;
    return [e.request.method, e.request.service, e.request.path, e.response.status, e.screen, JSON.stringify(e.request.body)].join('|');
}

function enqueue(e: AuditEvent, tk: string | null) {
    const last = queue[queue.length - 1];
    const key = collapseKey(e);
    if (key && last && last.tk === tk && !(sending && last === queue[0])) {
        // Polls and retries of the identical call collapse into one row with a count.
        const now = Date.parse(e.ts);
        for (let i = last.events.length - 1; i >= 0 && i >= last.events.length - 20; i--) {
            const prev = last.events[i];
            if (collapseKey(prev) === key && now - Date.parse(prev.ts) < COLLAPSE_MS) {
                prev.count += 1;
                prev.last_ts = e.ts;
                persistSoon();
                return;
            }
        }
    }
    if (last && last.tk === tk && last.events.length < MAX_EVENTS_PER_BATCH) last.events.push(e);
    else queue.push({ tk, events: [e] });
    trimTo(MAX_QUEUED_EVENTS);
    persistSoon();
    if (queuedCount() >= MAX_EVENTS_PER_BATCH) setTimeout(() => void flush(), 0);
}

function identityReady() {
    return identityKnown || !!cfg?.resolveIdentity;
}

/** `who` = null attributes the event to the session once it is known. */
function record(kind: Kind, who: AuditIdentity | null, fields: Partial<AuditEvent> & { screen?: string }) {
    const ts = new Date().toISOString();
    const screen = fields.screen ?? currentScreen();
    const build = () => {
        const id = who || currentIdentity();
        const e: AuditEvent = {
            event_id: randomId('e'),
            kind,
            action: fields.action ?? null,
            ts,
            count: 1,
            premise_id: id.premise_id || null,
            premise_name: id.premise_name || null,
            screen,
            session_id: sessionId,
            platform,
            actor: { name: id.name || null, mobile: id.mobile || null, designation: id.designation || null },
            request: fields.request,
            response: fields.response
        };
        if (!e.request) delete e.request;
        if (!e.response) delete e.response;
        enqueue(e, id.token || null);
    };
    // Until the session is known, hold events so they are attributed to the user.
    if (!identityReady()) held.push(build);
    else build();
}

function takePayload(batch: Batch) {
    let n = Math.min(batch.events.length, MAX_EVENTS_PER_BATCH);
    let payload = '';
    while (n > 0) {
        payload = JSON.stringify({ app: cfg!.app, token: batch.tk || undefined, events: batch.events.slice(0, n) });
        if (payload.length <= MAX_PAYLOAD_BYTES || n === 1) break;
        n = Math.max(1, Math.floor(n / 2));
    }
    return { n, payload };
}

async function flush(): Promise<void> {
    if (!cfg || !origFetch || sending || !queue.length || Date.now() < nextAttemptAt) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const batch = queue[0];
    const { n, payload } = takePayload(batch);
    sending = true;
    let delivered = false;
    let poison = false;
    try {
        const res = await origFetch(cfg.endpoint + '/audit/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: payload,
            credentials: 'omit',
            keepalive: payload.length < MAX_PAYLOAD_BYTES
        });
        delivered = res.ok;
        // A batch the server will never accept must not block the queue forever.
        poison = res.status === 400 || res.status === 413;
    } catch {
        delivered = false;
    }
    sending = false;
    if (delivered || poison) {
        batch.events.splice(0, n);
        if (!batch.events.length) queue.shift();
        backoff = 0;
        nextAttemptAt = 0;
        persist();
        if (queue.length) setTimeout(() => void flush(), 0);
    } else {
        backoff = Math.min(MAX_BACKOFF_MS, Math.max(FLUSH_MS, backoff * 2));
        nextAttemptAt = Date.now() + backoff;
    }
}

/** Best effort on page hide. Events stay queued and are re-sent later; the server dedupes. */
function beaconAll() {
    safe(() => {
        persist();
        if (!cfg || !navigator.sendBeacon) return;
        let budget = MAX_PAYLOAD_BYTES;
        for (const batch of queue) {
            const { payload } = takePayload(batch);
            if (payload.length > budget) break;
            if (!navigator.sendBeacon(cfg.endpoint + '/audit/ingest', new Blob([payload], { type: 'text/plain' }))) break;
            budget -= payload.length;
        }
    });
}

// ---------------------------------------------------------------- capture

function shouldSkip(url: URL, headers: Record<string, string>) {
    if (!cfg) return true;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    if (url.href.startsWith(cfg.endpoint)) return true;
    if (STATIC_FILE.test(url.pathname)) return true;
    if (url.origin === window.location.origin) {
        if (url.pathname.startsWith('/_next/') || NEXT_AUTH_NOISE.test(url.pathname)) return true;
        if (url.searchParams.has('_rsc') || headers['rsc'] || headers['next-router-state-tree'] || headers['next-action']) return true;
    }
    return false;
}

function authKind(url: URL): 'login' | 'logout' | null {
    if (!cfg) return null;
    if (cfg.logoutPaths?.some((r) => r.test(url.pathname))) return 'logout';
    if (cfg.loginPaths?.some((r) => r.test(url.pathname))) return 'login';
    return null;
}

function headersToObject(h: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!h) return out;
    if (typeof Headers !== 'undefined' && h instanceof Headers) {
        h.forEach((v, k) => {
            out[k.toLowerCase()] = v;
        });
    } else if (Array.isArray(h)) {
        h.forEach(([k, v]) => {
            out[String(k).toLowerCase()] = String(v);
        });
    } else if (typeof h === 'object') {
        Object.keys(h as object).forEach((k) => {
            out[k.toLowerCase()] = String((h as Record<string, unknown>)[k]);
        });
    }
    return out;
}

function begin(method: string, rawUrl: string, headers: Record<string, string>, body: unknown): CallInfo | null {
    const url = new URL(rawUrl, window.location.href);
    if (shouldSkip(url, headers)) return null;
    const m = (method || 'GET').toUpperCase();
    const info: CallInfo = {
        method: m,
        url,
        body: m === 'GET' || m === 'HEAD' ? null : capBody(readBody(body)),
        background: headers['x-background'] === '1',
        start: performance.now(),
        auth: authKind(url),
        identity: identityReady() ? currentIdentity() : null,
        screen: currentScreen()
    };
    if (info.auth === 'logout') {
        // Recorded up front, while the session that is ending can still be attributed.
        record('auth', info.identity, { action: 'logout', screen: info.screen });
        beaconAll();
    }
    return info;
}

function finish(info: CallInfo, status: number, errorMessage: string | null, businessError: boolean) {
    if (info.auth === 'logout') return;
    const { service, path } = serviceAndPath(info.url);
    const query = info.url.search ? sanitize(paramsToObject(info.url.searchParams)) : null;
    const response = {
        status,
        duration_ms: Math.round(performance.now() - info.start),
        error_message: errorMessage,
        ...(businessError ? { business_error: true } : {})
    };
    const request = { method: info.method, host: info.url.host, service, path, query, body: info.body, background: info.background };

    if (info.auth === 'login') {
        const failed = status === 0 || status >= 400 || businessError || !!errorMessage;
        if (failed) {
            const b = (info.body || {}) as Record<string, unknown>;
            const who = { mobile: String(b.mobile || b.identifier || b.username || '') || null };
            record('auth', who, { action: 'login_failed', screen: info.screen, request, response });
        } else {
            safe(() => sessionStorage.setItem(PENDING_LOGIN_KEY, String(Date.now())));
            checkPendingLogin();
        }
        return;
    }
    record('api', info.identity, { action: null, screen: info.screen, request, response });
}

/** Emits the sign-in event once the new session's token is available. */
function checkPendingLogin() {
    safe(() => {
        const at = Number(sessionStorage.getItem(PENDING_LOGIN_KEY) || 0);
        if (!at) return;
        if (Date.now() - at > PENDING_LOGIN_MS) {
            sessionStorage.removeItem(PENDING_LOGIN_KEY);
            return;
        }
        const who = currentIdentity();
        if (!who.token) return;
        sessionStorage.removeItem(PENDING_LOGIN_KEY);
        record('auth', who, { action: 'login' });
    });
}

function patchFetch() {
    origFetch = window.fetch.bind(window);
    const original = origFetch;
    window.fetch = function auditedFetch(input: any, init?: RequestInit): Promise<Response> {
        const box: { info: CallInfo | null } = { info: null };
        safe(() => {
            const isRequest = typeof Request !== 'undefined' && input instanceof Request;
            const url = isRequest ? input.url : String(input);
            const method = init?.method || (isRequest ? input.method : 'GET');
            const headers = headersToObject(init?.headers || (isRequest ? input.headers : null));
            box.info = begin(method, url, headers, init?.body);
        });
        const p = original(input, init);
        const i = box.info;
        if (i) {
            p.then(
                (res) => {
                    safe(() => {
                        const needsBody = res.status >= 400 || i.auth === 'login';
                        if (!needsBody) return finish(i, res.status, null, false);
                        res.clone()
                            .text()
                            .then((text) => {
                                let msg = errorFrom(text);
                                // next-auth reports a rejected sign-in as a 200 with ?error= in the redirect url.
                                if (!msg && i.auth === 'login' && /[?&]error=/.test(text)) msg = 'Sign-in rejected';
                                finish(i, res.status, msg, res.status < 400 && !!msg);
                            })
                            .catch(() => finish(i, res.status, null, false));
                    });
                },
                (err) => {
                    safe(() => {
                        if (err && err.name === 'AbortError') return;
                        finish(i, 0, (err && err.message) || 'Network error', false);
                    });
                }
            );
        }
        return p;
    } as typeof fetch;
}

function patchXhr() {
    const proto = XMLHttpRequest.prototype as any;
    const open = proto.open;
    const send = proto.send;
    const setHeader = proto.setRequestHeader;

    proto.open = function (this: any, method: string, url: string | URL) {
        safe(() => {
            this.__audit = { method, url: String(url), headers: {} as Record<string, string> };
        });
        return open.apply(this, arguments as any);
    };
    proto.setRequestHeader = function (this: any, name: string, value: string) {
        safe(() => {
            const k = String(name).toLowerCase();
            if (this.__audit && (k === 'x-background' || k === 'rsc')) this.__audit.headers[k] = String(value);
        });
        return setHeader.apply(this, arguments as any);
    };
    proto.send = function (this: any, body?: unknown) {
        safe(() => {
            const a = this.__audit;
            if (!a) return;
            const info = begin(a.method, a.url, a.headers, body);
            if (!info) return;
            const xhr = this as XMLHttpRequest & { __auditAborted?: boolean };
            xhr.addEventListener('abort', () => {
                xhr.__auditAborted = true;
            });
            xhr.addEventListener('loadend', () => {
                safe(() => {
                    if (xhr.__auditAborted) return;
                    const status = xhr.status;
                    let msg: string | null = null;
                    let business = false;
                    const rt = xhr.responseType;
                    if (rt === '' || rt === 'text' || rt === 'json') {
                        const payload = rt === 'json' ? xhr.response : xhr.responseText;
                        if (status >= 400 || status === 0) msg = errorFrom(payload) || (status === 0 ? 'Network error' : null);
                        else if (rt === 'json' ? !!payload && typeof payload === 'object' : looksLikeErrorEnvelope(String(payload || ''))) {
                            msg = errorFrom(payload);
                            business = !!msg;
                        }
                    } else if (status === 0) {
                        msg = 'Network error';
                    }
                    finish(info, status, msg, business);
                });
            });
        });
        return send.apply(this, arguments as any);
    };
}

function onLocationChange() {
    safe(() => {
        const path = window.location.pathname;
        if (path === lastPath) return;
        lastPath = path;
        checkPendingLogin();
        record('page_view', null, { action: 'view', screen: currentScreen() });
    });
}

function patchHistory() {
    (['pushState', 'replaceState'] as const).forEach((name) => {
        const original = history[name];
        history[name] = function (this: History, ...args: Parameters<History['pushState']>) {
            const result = original.apply(this, args);
            onLocationChange();
            return result;
        } as History['pushState'];
    });
    window.addEventListener('popstate', onLocationChange);
}

// ---------------------------------------------------------------- public API

export function initAuditTrail(config: AuditConfig) {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { __auditTrailStarted?: boolean };
    if (w.__auditTrailStarted) return;
    w.__auditTrailStarted = true;

    safe(() => {
        cfg = { ...config, endpoint: config.endpoint.replace(/\/+$/, '') };
        try {
            sessionId = sessionStorage.getItem('__audit_sid') || randomId('s');
            sessionStorage.setItem('__audit_sid', sessionId);
        } catch {
            sessionId = randomId('s');
        }
        platform = detectPlatform();
        restore();
        patchFetch();
        patchXhr();
        patchHistory();
        onLocationChange();

        if (!config.resolveIdentity) setTimeout(() => releaseHeld(), IDENTITY_WAIT_MS);
        setInterval(() => {
            checkPendingLogin();
            void flush();
        }, FLUSH_MS);
        window.addEventListener('online', () => {
            nextAttemptAt = 0;
            void flush();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') beaconAll();
        });
        window.addEventListener('pagehide', beaconAll);
        setTimeout(() => void flush(), 2000);
    });
}

function releaseHeld() {
    identityKnown = true;
    const pending = held;
    held = [];
    pending.forEach((fn) => safe(fn));
}

/** Push-style identity for session-provider apps. Pass `{}` when signed out. */
export function setAuditIdentity(next: AuditIdentity) {
    safe(() => {
        identity = { ...next };
        if (!identityKnown) releaseHeld();
        checkPendingLogin();
    });
}
