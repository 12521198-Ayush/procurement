import clsx from 'clsx';

/**
 * Status vocabulary shared by every table in the design. Keeping the mapping in
 * one place stops the same status rendering in two different colours.
 */
const TONES: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20'
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
    approved: 'green',
    received: 'green',
    paid: 'green',
    completed: 'green',
    active: 'green',
    in_stock: 'green',
    submitted: 'green',

    sent: 'blue',
    open: 'blue',
    under_review: 'blue',
    draft: 'slate',
    inactive: 'slate',

    pending: 'amber',
    partial: 'amber',
    partially_fulfilled: 'amber',
    low_stock: 'amber',
    awaiting_approval: 'amber',

    acknowledged: 'orange',
    requested: 'violet',

    rejected: 'red',
    expired: 'red',
    cancelled: 'red',
    out_of_stock: 'red'
};

function label(status: string) {
    return status
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export default function StatusPill({ status, className }: { status: string; className?: string }) {
    const key = String(status || '').toLowerCase().replace(/\s+/g, '_');
    const tone = STATUS_TONE[key] || 'slate';

    return (
        <span
            className={clsx(
                'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                TONES[tone],
                className
            )}
        >
            {label(key)}
        </span>
    );
}
