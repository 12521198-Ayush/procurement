'use client';

import Link from 'next/link';
import { ArrowRight, Landmark, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { BalancedBadge } from '@/components/accounting/AccountingUI';
import { percentOf, presetPeriod, useReport, type BalanceSheet, type ProfitAndLoss } from '@/lib/accounting';
import { formatMoney, formatMoneyCompact } from '@/lib/format';

export default function FinancialSnapshot() {
    const period = presetPeriod('fy');
    const pnl = useReport<ProfitAndLoss>('profit-and-loss', period);
    const bs = useReport<BalanceSheet>('balance-sheet', period);

    const fyStart = Number(period.startDate.slice(0, 4));
    const fyLabel = `FY ${fyStart}-${String(fyStart + 1).slice(2)}`;

    if (pnl.loading || bs.loading) return <div className="h-[196px] animate-pulse rounded-2xl bg-slate-200" />;

    if (!pnl.data || !bs.data) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-white px-5 py-4">
                <p className="text-[13px] text-muted">Financial snapshot is unavailable right now. {pnl.error || bs.error}</p>
                <button
                    type="button"
                    className="btn-ghost h-8 text-[12px]"
                    onClick={() => {
                        pnl.reload();
                        bs.reload();
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    const { total_revenue, total_expenses } = pnl.data.summary;
    const net = pnl.data.net_income;
    const margin = percentOf(net, total_revenue);
    const expenseShare = Math.min(100, percentOf(total_expenses, total_revenue));
    const balanced = bs.data.is_balanced;

    const tiles = [
        { label: 'Revenue', value: total_revenue, icon: TrendingUp, tone: 'text-emerald-300' },
        { label: 'Expenses', value: total_expenses, icon: TrendingDown, tone: 'text-amber-300' },
        { label: 'Total assets', value: bs.data.summary.total_assets, icon: Wallet, tone: 'text-sky-300' },
        { label: 'Liabilities', value: bs.data.summary.total_liabilities, icon: Scale, tone: 'text-rose-300' }
    ];

    return (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-700 to-brand-800 p-5 text-white shadow-pop sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-accent-400/10 blur-2xl" />

            <div className="relative grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                            <Landmark className="h-4 w-4" />
                        </span>
                        <p className="text-[13px] font-semibold tracking-wide text-slate-200">Financial Snapshot</p>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200">{fyLabel}</span>
                        <BalancedBadge balanced={balanced} dark />
                    </div>

                    <p className="mt-5 text-[12px] font-medium uppercase tracking-wider text-slate-400">Net income</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight" title={formatMoney(net)}>
                        {formatMoneyCompact(net)}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-300">
                        <span className={net >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>{margin}%</span> net margin
                        on revenue
                    </p>

                    <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-[11px] text-slate-300">
                            <span>Expenses use {expenseShare}% of revenue</span>
                            <span>{formatMoneyCompact(total_revenue)}</span>
                        </div>
                        <div className="flex h-2 overflow-hidden rounded-full bg-emerald-400/80">
                            <div className="h-full bg-accent-400" style={{ width: `${expenseShare}%` }} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:col-span-3">
                    {tiles.map(({ label, value, icon: Icon, tone }) => (
                        <div key={label} className="rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-inset ring-white/10 backdrop-blur">
                            <div className="flex items-center gap-2 text-[12px] text-slate-300">
                                <Icon className={`h-4 w-4 ${tone}`} />
                                {label}
                            </div>
                            <p className="mt-2 text-xl font-semibold tracking-tight" title={formatMoney(value)}>
                                {formatMoneyCompact(value)}
                            </p>
                        </div>
                    ))}
                    <Link
                        href="/accounts"
                        className="col-span-2 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-navy-900 transition hover:bg-brand-50"
                    >
                        Open P&amp;L, Balance Sheet &amp; Trial Balance
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
