'use client';

import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4080';

export const TOKEN_KEY = 'pp_access_token';
export const REFRESH_KEY = 'pp_refresh_token';
export const USER_KEY = 'pp_user';
export const PREMISE_KEY = 'pp_active_premise';

export const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });

/**
 * The society the user is currently working in. It is stamped onto every request
 * so a premise switch instantly re-scopes every screen without each page having
 * to know about it. The server re-checks it against the signed token, so this is
 * a convenience, not the access control.
 */
let activePremiseId: string | null = null;

export function setActivePremise(premiseId: string | null) {
    activePremiseId = premiseId;
    if (typeof window === 'undefined') return;
    if (premiseId) localStorage.setItem(PREMISE_KEY, premiseId);
    else localStorage.removeItem(PREMISE_KEY);
}

export function getActivePremise(): string | null {
    if (activePremiseId) return activePremiseId;
    if (typeof window === 'undefined') return null;
    activePremiseId = localStorage.getItem(PREMISE_KEY);
    return activePremiseId;
}

/**
 * The screen a request was made from, for the audit trail. Secret link tokens in
 * the path (vendor quotation / tax-invoice links) are masked before leaving the page.
 */
export function currentScreen(): string {
    if (typeof window === 'undefined') return '';
    return window.location.pathname.replace(/^(\/vendor\/(?:quotation|tax-invoice)\/)[^/]+/, '$1:token');
}

api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) config.headers.Authorization = `Bearer ${token}`;
        config.headers['x-screen'] = currentScreen();
    }

    const premiseId = getActivePremise();
    const body = config.data;
    // Anything that already names a scope (a premise switch, or the cluster view)
    // is left alone.
    if (
        premiseId &&
        body &&
        typeof body === 'object' &&
        !(body instanceof FormData) &&
        body.premise_id === undefined &&
        body.premise_scope === undefined
    ) {
        config.data = { ...body, premise_id: premiseId };
    }

    return config;
});

// Sign-in and vendor-link calls handle their own 401s.
const SESSION_FREE = /^\/procurement\/(auth\/|vendor\/)/;
let refreshing: Promise<string | null> | null = null;

/** One refresh at a time, however many requests failed together. */
function refreshAccessToken(): Promise<string | null> {
    if (!refreshing) {
        const refresh = localStorage.getItem(REFRESH_KEY);
        refreshing = (
            refresh
                ? axios
                      .post(`${BASE_URL}/procurement/auth/refresh`, { refresh_token: refresh }, { timeout: 15000 })
                      .then((res) => {
                          const data = res.data?.data;
                          if (!data?.access_token) return null;
                          localStorage.setItem(TOKEN_KEY, data.access_token);
                          if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                          return data.access_token as string;
                      })
                      .catch(() => null)
                : Promise.resolve(null)
        ).finally(() => {
            refreshing = null;
        });
    }
    return refreshing;
}

/** Clears the local session and sends the user to sign in again. */
export function endSession() {
    if (typeof window === 'undefined') return;
    [TOKEN_KEY, REFRESH_KEY, USER_KEY, PREMISE_KEY].forEach((k) => localStorage.removeItem(k));
    activePremiseId = null;
    if (!window.location.pathname.startsWith('/login')) window.location.replace('/login?expired=1');
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as (AxiosError['config'] & { _retried?: boolean }) | undefined;
    if (
        error.response?.status !== 401 ||
        !config ||
        typeof window === 'undefined' ||
        SESSION_FREE.test(config.url || '') ||
        window.location.pathname.startsWith('/vendor')
    ) {
        return Promise.reject(error);
    }

    if (!config._retried) {
        const token = await refreshAccessToken();
        if (token) {
            config._retried = true;
            config.headers.Authorization = `Bearer ${token}`;
            return api(config);
        }
    }

    endSession();
    return Promise.reject(error);
});

/**
 * The backend answers `{ error: null, data }` or `{ error: { code, message } }`,
 * and uses a real HTTP status either way. Unwrap both shapes into one place so
 * callers only ever deal with `data` or a thrown Error carrying a usable message.
 */
export type ApiError = Error & { code?: string; status?: number };

function toApiError(err: unknown): ApiError {
    const ax = err as AxiosError<{ error?: { code?: string; message?: string } }>;
    const payload = ax?.response?.data?.error;
    const error = new Error(
        payload?.message || ax?.message || 'Something went wrong. Please try again.'
    ) as ApiError;
    error.code = payload?.code;
    error.status = ax?.response?.status;
    return error;
}

/** `background` marks timed polls so the audit trail is not flooded with them. */
export async function post<T = any>(
    path: string,
    body: Record<string, unknown> = {},
    options: { background?: boolean } = {}
): Promise<T> {
    try {
        const res = await api.post(path, body, options.background ? { headers: { 'x-background': '1' } } : undefined);
        if (res.data?.error) throw { response: { data: res.data, status: res.status } };
        return res.data?.data as T;
    } catch (err) {
        throw toApiError(err);
    }
}

export async function get<T = any>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
        const res = await api.get(path, { params });
        if (res.data?.error) throw { response: { data: res.data, status: res.status } };
        return res.data?.data as T;
    } catch (err) {
        throw toApiError(err);
    }
}

/**
 * Reads across every society the user is assigned to instead of just the active
 * one. Only used by the cluster screens - writes always stay inside one society,
 * so there is deliberately no cluster equivalent of a create or update call.
 */
export function postCluster<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    return post<T>(path, { ...body, premise_scope: 'cluster' });
}

/** Records that the user opened a screen. Never blocks or surfaces an error. */
export function trackPageView(screen: string) {
    post('/procurement/activity/page-view', { screen }).catch(() => undefined);
}
