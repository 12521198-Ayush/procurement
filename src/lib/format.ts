const MINOR_UNITS: Record<string, number> = { INR: 100, USD: 100, EUR: 100, GBP: 100, JPY: 1 };

/**
 * The backend stores money as integer minor units. Never convert with floats on
 * the way in - divide only at the moment of display.
 */
export function formatMoney(minor: number | null | undefined, currency = 'INR') {
    const divisor = MINOR_UNITS[currency] ?? 100;
    const value = (minor ?? 0) / divisor;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
    }).format(value);
}

/** Compact form for KPI tiles: ₹3.45L, ₹1.2Cr. */
export function formatMoneyCompact(minor: number | null | undefined, currency = 'INR') {
    const divisor = MINOR_UNITS[currency] ?? 100;
    const value = (minor ?? 0) / divisor;
    const symbol = currency === 'INR' ? '₹' : '';

    if (currency === 'INR') {
        if (Math.abs(value) >= 1e7) return `${symbol}${(value / 1e7).toFixed(2)}Cr`;
        if (Math.abs(value) >= 1e5) return `${symbol}${(value / 1e5).toFixed(2)}L`;
    }
    return formatMoney(minor, currency);
}

export function formatDate(value: string | Date | null | undefined) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

export function formatDateTime(value: string | Date | null | undefined) {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function timeAgo(value: string | Date | null | undefined) {
    if (!value) return '';
    const diff = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/** Remaining time until an RFQ closes. Display only - the server owns the real deadline. */
export function countdown(expiresAt: string | Date | null | undefined) {
    if (!expiresAt) return { text: '—', expired: true };
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return { text: 'Expired', expired: true };

    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);

    if (days > 0) return { text: `${days}d ${hours}h left`, expired: false };
    if (hours > 0) return { text: `${hours}h ${mins}m left`, expired: false };
    return { text: `${mins}m left`, expired: false };
}
