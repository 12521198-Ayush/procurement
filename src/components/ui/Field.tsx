'use client';

import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export function Field({
    label,
    required,
    hint,
    error,
    children,
    className
}: {
    label?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            {label && (
                <label className="field-label">
                    {label}
                    {required && <span className="ml-0.5 text-rose-500">*</span>}
                </label>
            )}
            {children}
            {error ? (
                <p className="mt-1 text-[12px] text-rose-600">{error}</p>
            ) : hint ? (
                <p className="mt-1 text-[12px] text-slate-400">{hint}</p>
            ) : null}
        </div>
    );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    const { className, ...rest } = props;
    return <input {...rest} className={clsx('input', className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const { className, ...rest } = props;
    return (
        <textarea
            {...rest}
            className={clsx(
                'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10',
                className
            )}
        />
    );
}

export function Select({
    options,
    placeholder,
    className,
    ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string }[];
    placeholder?: string;
}) {
    return (
        <div className="relative">
            <select {...rest} className={clsx('input appearance-none pr-9', className)}>
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
    );
}

export function Checkbox({
    label,
    ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
    return (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
                type="checkbox"
                {...rest}
                className="h-4 w-4 rounded border-line text-brand-600 focus:ring-2 focus:ring-brand-500/30"
            />
            {label}
        </label>
    );
}
