'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type Toast = { id: number; tone: 'success' | 'error' | 'info'; message: string };

const ToastContext = createContext<{
    success: (m: string) => void;
    error: (m: string) => void;
    info: (m: string) => void;
} | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const push = useCallback((tone: Toast['tone'], message: string) => {
        const id = nextId++;
        setToasts((t) => [...t, { id, tone, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }, []);

    const value = useMemo(
        () => ({
            success: (m: string) => push('success', m),
            error: (m: string) => push('error', m),
            info: (m: string) => push('info', m)
        }),
        [push]
    );

    const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
    const tones = {
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        error: 'border-rose-200 bg-rose-50 text-rose-800',
        info: 'border-blue-200 bg-blue-50 text-blue-800'
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2">
                {toasts.map((t) => {
                    const Icon = icons[t.tone];
                    return (
                        <div
                            key={t.id}
                            role="status"
                            className={clsx(
                                'pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] shadow-pop',
                                tones[t.tone]
                            )}
                        >
                            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                            <p className="flex-1 leading-relaxed">{t.message}</p>
                            <button
                                type="button"
                                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                                aria-label="Dismiss"
                                className="opacity-60 transition hover:opacity-100"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}
