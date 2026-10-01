'use client';

import { useCallback, useEffect, useState } from 'react';
import { vendorPost } from './vendor-api';

/** One-shot fetch through the vendor session (mirrors useResource). */
export function useVendorResource<T>(endpoint: string | null, body: Record<string, unknown> = {}) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!!endpoint);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);
    const key = JSON.stringify(body);

    useEffect(() => {
        if (!endpoint) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        vendorPost<T>(endpoint, JSON.parse(key))
            .then((res) => !cancelled && setData(res))
            .catch((err) => !cancelled && setError(err.message))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [endpoint, key, nonce]);

    const reload = useCallback(() => setNonce((n) => n + 1), []);
    return { data, loading, error, reload };
}

/** Paginated vendor list. */
export function useVendorList<T>(endpoint: string, filters: Record<string, unknown> = {}, limit = 20) {
    const [page, setPage] = useState(1);
    const key = JSON.stringify(filters);
    useEffect(() => setPage(1), [key]);
    const res = useVendorResource<{ array: T[]; total: number; page: number; limit: number }>(endpoint, { ...JSON.parse(key), page, limit });
    return {
        rows: res.data?.array ?? [],
        total: res.data?.total ?? 0,
        page,
        setPage,
        limit,
        loading: res.loading,
        error: res.error,
        reload: res.reload
    };
}
