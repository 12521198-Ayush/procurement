'use client';

import { initAuditTrail, type AuditIdentity } from '@/lib/audit/auditTrail';
import { PREMISE_KEY, TOKEN_KEY, USER_KEY } from '@/lib/api';
import { VENDOR_PROFILE_KEY, VENDOR_TOKEN_KEY } from '@/lib/vendor-api';

const AUDIT_API_BASE_URL = process.env.NEXT_PUBLIC_AUDIT_API_BASE_URL || 'https://api.servizing.app/audit-service';

let cachedRaw: string | null = null;
let cachedParsed: Record<string, any> | null = null;
function parsed(raw: string | null) {
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        try {
            cachedParsed = raw ? JSON.parse(raw) : null;
        } catch {
            cachedParsed = null;
        }
    }
    return cachedParsed;
}

/** Reads whichever session (buyer or vendor) the current screen runs under. */
function resolveIdentity(): AuditIdentity {
    if (window.location.pathname.startsWith('/vendor')) {
        const vendor = parsed(localStorage.getItem(VENDOR_PROFILE_KEY));
        return {
            token: localStorage.getItem(VENDOR_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY),
            name: vendor?.company_name || null,
            designation: 'Vendor'
        };
    }
    const user = parsed(localStorage.getItem(USER_KEY));
    const premiseId = localStorage.getItem(PREMISE_KEY) || user?.premise_id || null;
    const premise = (user?.premises || []).find((p: any) => p?.premise_id === premiseId);
    return {
        token: localStorage.getItem(TOKEN_KEY),
        name: user?.name || null,
        mobile: user?.mobile || null,
        designation: user?.role || null,
        premise_id: premiseId,
        premise_name: premise?.premise_name || null
    };
}

// Started at module load so the first screen's API calls are captured too.
if (typeof window !== 'undefined') {
    initAuditTrail({
        app: 'procurement',
        endpoint: AUDIT_API_BASE_URL,
        resolveIdentity,
        loginPaths: [/\/otp\/verify$/],
        logoutPaths: [/\/procurement\/auth\/logout$/],
        maskPath: (p) => p.replace(/^(\/vendor\/(?:quotation|tax-invoice)\/)[^/]+/, '$1:token'),
        serviceFor: (url) => (url.pathname.startsWith('/procurement/') ? 'procurement-service' : null)
    });
}

export default function AuditTracker() {
    return null;
}
