'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { post } from './api';
import { useAuth } from './auth';

type ListResult<T> = { array: T[]; total: number; page: number; limit: number } & Record<string, any>;

/**
 * Paginated list fetching for every listing screen. Filters are sent as-is to the
 * endpoint; changing them resets to page 1.
 */
export function useList<T>(endpoint: string, filters: Record<string, unknown> = {}, options: { limit?: number } = {}) {
    const { activePremiseId } = useAuth();
    const [data, setData] = useState<ListResult<T> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const key = JSON.stringify(filters);
    const reloadRef = useRef(0);

    useEffect(() => {
        setPage(1);
    }, [key, activePremiseId]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await post<ListResult<T>>(endpoint, {
                ...JSON.parse(key),
                page,
                limit: options.limit ?? 20
            });
            setData(res);
        } catch (err: any) {
            setError(err.message);
            setData(null);
        } finally {
            setLoading(false);
        }
        // The premise is stamped on by the request interceptor, so it is a
        // dependency here even though it never appears in the body.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endpoint, key, page, options.limit, activePremiseId]);

    useEffect(() => {
        load();
    }, [load, reloadRef.current]);

    const reload = useCallback(() => {
        reloadRef.current += 1;
        load();
    }, [load]);

    return {
        rows: data?.array ?? [],
        meta: data,
        total: data?.total ?? 0,
        limit: data?.limit ?? options.limit ?? 20,
        page,
        setPage,
        loading,
        error,
        reload
    };
}

/** One-shot fetch for detail screens and dashboards. */
export function useResource<T>(endpoint: string | null, body: Record<string, unknown> = {}) {
    const { activePremiseId } = useAuth();
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

        post<T>(endpoint, JSON.parse(key))
            .then((res) => !cancelled && setData(res))
            .catch((err) => !cancelled && setError(err.message))
            .finally(() => !cancelled && setLoading(false));

        return () => {
            cancelled = true;
        };
    }, [endpoint, key, nonce, activePremiseId]);

    return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/** Debounced value, used so search boxes do not fire a request per keystroke. */
export function useDebounced<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/** Options for a `<Select>`, loaded from a list endpoint. */
export function useOptions(endpoint: string, idKey: string, labelKey = 'name') {
    const { activePremiseId } = useAuth();
    const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

    useEffect(() => {
        let cancelled = false;
        post<ListResult<any>>(endpoint, { limit: 200, is_active: 'yes' })
            .then((res) => {
                if (cancelled) return;
                setOptions((res.array || []).map((r) => ({ value: r[idKey], label: r[labelKey] })));
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [endpoint, idKey, labelKey, activePremiseId]);

    return options;
}
