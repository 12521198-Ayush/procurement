'use client';

import axios, { AxiosError } from 'axios';
import { currentScreen, type ApiError } from './api';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4080';

// Kept apart from the procurement-user token so a vendor and a buyer can never
// share (or overwrite) one another's session in the same browser.
export const VENDOR_TOKEN_KEY = 'pp_vendor_token';
export const VENDOR_PROFILE_KEY = 'pp_vendor_profile';

export const vendorApi = axios.create({ baseURL: BASE_URL, timeout: 30000 });

vendorApi.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem(VENDOR_TOKEN_KEY);
        if (token) config.headers.Authorization = `Bearer ${token}`;
        config.headers['x-screen'] = currentScreen();
    }
    return config;
});

function toError(err: unknown): ApiError {
    const ax = err as AxiosError<{ error?: { code?: string; message?: string } }>;
    const payload = ax?.response?.data?.error;
    const error = new Error(payload?.message || ax?.message || 'Something went wrong. Please try again.') as ApiError;
    error.code = payload?.code;
    error.status = ax?.response?.status;
    return error;
}

export async function vendorPost<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    try {
        const res = await vendorApi.post(path, body);
        if (res.data?.error) throw { response: { data: res.data, status: res.status } };
        return res.data?.data as T;
    } catch (err) {
        const e = toError(err);
        // An expired or revoked session sends the vendor back to sign in.
        if ((e.status === 401 || e.code === 'unauthorized') && typeof window !== 'undefined' && !path.includes('/otp/')) {
            localStorage.removeItem(VENDOR_TOKEN_KEY);
            localStorage.removeItem(VENDOR_PROFILE_KEY);
            window.location.href = '/vendor/login';
        }
        throw e;
    }
}

/** Downloads a binary response (PDF/XLSX) through the vendor session. */
export async function vendorDownload(path: string, body: Record<string, unknown>, filename: string) {
    const res = await vendorApi.post(path, body, { responseType: 'blob' });
    saveBlob(res.data, filename);
}

export function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export const P = '/procurement/vendor/portal/';

/** Records that the vendor opened a portal screen. Never blocks or surfaces an error. */
export function trackVendorPageView(screen: string) {
    vendorApi.post('/procurement/vendor/activity/page-view', { screen }).catch(() => undefined);
}
