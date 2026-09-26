'use client';

import { useEffect } from 'react';
import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';

export default function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md'
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        // Stop the page behind the dialog from scrolling.
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [open, onClose]);

    if (!open) return null;

    const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={clsx('relative my-8 w-full rounded-2xl bg-white shadow-pop', widths[size])}
            >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                    <div>
                        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
                        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-6 py-5">{children}</div>

                {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
            </div>
        </div>
    );
}

export function SubmitButton({
    busy,
    children,
    ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
    return (
        <button {...rest} className="btn-primary" disabled={busy || rest.disabled}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
}
