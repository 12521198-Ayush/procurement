import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

const TILES: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-600',
    blue: 'bg-brand-100 text-brand-600',
    accent: 'bg-accent-100 text-accent-600',
    cyan: 'bg-cyan-100 text-cyan-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600'
};

export default function StatCard({
    icon: Icon,
    tone = 'blue',
    label,
    value,
    trend,
    caption,
    compact = false
}: {
    icon: LucideIcon;
    tone?: keyof typeof TILES;
    label: string;
    value: string | number;
    trend?: number | null;
    caption?: string;
    compact?: boolean;
}) {
    const up = (trend ?? 0) >= 0;
    const TrendIcon = up ? ArrowUpRight : ArrowDownRight;
    const trendPill = trend !== undefined && trend !== null && (
        <span
            className={clsx(
                'inline-flex shrink-0 items-center gap-0.5 rounded-md font-semibold',
                compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
                up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            )}
        >
            <TrendIcon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            {up ? '+' : ''}
            {trend}%
        </span>
    );

    if (compact) {
        return (
            <div className="card px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TILES[tone])}>
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </div>
                    {trendPill}
                </div>
                <p className="mt-2.5 text-xl font-semibold leading-tight tracking-tight text-ink">{value}</p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted">{label}</p>
                {caption && <p className="truncate text-[10px] text-slate-400">{caption}</p>}
            </div>
        );
    }

    return (
        <div className="card card-pad">
            <div className="flex items-start justify-between gap-3">
                <div className={clsx('grid h-11 w-11 place-items-center rounded-xl', TILES[tone])}>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                {trendPill}
            </div>

            <p className="mt-4 text-[13px] font-medium text-muted">{label}</p>
            <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink">{value}</p>
            {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
        </div>
    );
}
