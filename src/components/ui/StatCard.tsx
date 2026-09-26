import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

const TILES: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-600',
    blue: 'bg-blue-100 text-blue-600',
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
    caption
}: {
    icon: LucideIcon;
    tone?: keyof typeof TILES;
    label: string;
    value: string | number;
    trend?: number | null;
    caption?: string;
}) {
    const up = (trend ?? 0) >= 0;
    const TrendIcon = up ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="card card-pad">
            <div className="flex items-start justify-between gap-3">
                <div className={clsx('grid h-11 w-11 place-items-center rounded-xl', TILES[tone])}>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                {trend !== undefined && trend !== null && (
                    <span
                        className={clsx(
                            'inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-semibold',
                            up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        )}
                    >
                        <TrendIcon className="h-3.5 w-3.5" />
                        {up ? '+' : ''}
                        {trend}%
                    </span>
                )}
            </div>

            <p className="mt-4 text-[13px] font-medium text-muted">{label}</p>
            <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink">{value}</p>
            {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
        </div>
    );
}
