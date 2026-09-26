'use client';

import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4080';

export const TOKEN_KEY = 'pp_access_token';
export const REFRESH_KEY = 'pp_refresh_token';
export const USER_KEY = 'pp_user';

export const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
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

export async function post<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    try {
        const res = await api.post(path, body);
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
