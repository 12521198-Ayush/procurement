import clsx from 'clsx';

export function Card({
    children,
    className,
    padded = true
}: {
    children: React.ReactNode;
    className?: string;
    padded?: boolean;
}) {
    return <div className={clsx('card', padded && 'card-pad', className)}>{children}</div>;
}

export function CardHeader({
    title,
    action,
    className
}: {
    title: string;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={clsx('mb-4 flex items-center justify-between gap-3', className)}>
            <h3 className="section-title">{title}</h3>
            {action}
        </div>
    );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-600">{title}</p>
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
    );
}
