'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { BookOpen, Equal, Landmark, Plus, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import {
    BalancedBadge,
    Legend,
    ReportSkeleton,
    SearchBox,
    SummaryTile,
    TOOLTIP_STYLE,
    TypeBadge,
    clampPct
} from '@/components/accounting/AccountingUI';
import {
    ACCOUNT_TYPES,
    TYPE_STYLE,
    formatINR,
    formatINRCompact,
    percentOf,
    periodLabel,
    type AccountType,
    type BalanceSheet,
    type ChartOfAccounts,
    type Period,
    type ProfitAndLoss,
    type StatementLine,
    type TrialBalance
} from '@/lib/accounting';

const ASSET_SHADES = ['#1a7fd1', '#34a4f6', '#8ed2fd', '#17568b', '#59b8fa', '#bce3fe'];

/* ------------------------------------------------------------------ Hero */

export function Hero({ pnl, bs, tb }: { pnl: ProfitAndLoss; bs: BalanceSheet; tb: TrialBalance }) {
    const net = pnl.net_income;
    const margin = percentOf(net, pnl.summary.total_revenue);

    const tiles = [
        { label: 'Total revenue', value: pnl.summary.total_revenue, icon: TrendingUp, tone: 'text-emerald-300' },
        { label: 'Total expenses', value: pnl.summary.total_expenses, icon: TrendingDown, tone: 'text-amber-300' },
        { label: 'Total assets', value: bs.summary.total_assets, icon: Wallet, tone: 'text-sky-300' },
        { label: 'Ledger turnover', value: tb.grand_total_debits, icon: BookOpen, tone: 'text-violet-300' }
    ];

    return (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-700 to-brand-800 p-5 text-white shadow-pop sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-28 left-10 h-60 w-60 rounded-full bg-accent-400/10 blur-2xl" />

            <div className="relative grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2">
                    <div className="flex items-center gap-2 text-[12px] text-slate-300">
                        <Landmark className="h-4 w-4" />
                        {periodLabel(pnl.period)}
                    </div>
                    <p className="mt-4 text-[12px] font-medium uppercase tracking-wider text-slate-400">
                        {net >= 0 ? 'Net surplus' : 'Net deficit'}
                    </p>
                    <p className="mt-1 text-[34px] font-semibold leading-tight tracking-tight">{formatINR(net)}</p>
                    <p className="mt-1 text-[12px] text-slate-300">
                        <span className={clsx('font-semibold', net >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{margin}%</span> net
                        margin
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            Trial balance <BalancedBadge balanced={tb.is_balanced} dark />
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            Balance sheet <BalancedBadge balanced={bs.is_balanced} dark />
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:col-span-3">
                    {tiles.map(({ label, value, icon: Icon, tone }) => (
                        <div key={label} className="rounded-xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/10 backdrop-blur">
                            <div className="flex items-center gap-2 text-[12px] text-slate-300">
                                <Icon className={clsx('h-4 w-4', tone)} />
                                {label}
                            </div>
                            <p className="mt-2 text-2xl font-semibold tracking-tight" title={formatINR(value)}>
                                {formatINRCompact(value)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------- Overview */

export function Overview({ pnl, bs }: { pnl: ProfitAndLoss; bs: BalanceSheet }) {
    const flow = [...pnl.details.revenue, ...pnl.details.expenses].map((l) => ({
        name: l.account_name,
        value: l.balance,
        type: l.account_type
    }));
    const assets = bs.details.assets.filter((a) => a.balance > 0);
    const totalAssets = bs.summary.total_assets;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader
                        title="Income vs Expenditure"
                        action={
                            <div className="flex gap-3 text-[11px]">
                                <Legend color={TYPE_STYLE.Revenue.color} label="Revenue" />
                                <Legend color={TYPE_STYLE.Expense.color} label="Expense" />
                            </div>
                        }
                    />
                    {flow.length ? (
                        <div style={{ height: Math.max(220, flow.length * 48) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={flow} layout="vertical" barSize={18} margin={{ left: 8, right: 16 }}>
                                    <XAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                        tickFormatter={(v) => formatINRCompact(v)}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={170}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#334155' }}
                                    />
                                    <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v: number) => formatINR(v)} contentStyle={TOOLTIP_STYLE} />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                        {flow.map((f) => (
                                            <Cell key={f.name} fill={TYPE_STYLE[f.type].color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState title="No income or expenses in this period" />
                    )}
                </Card>

                <Card>
                    <CardHeader title="Where the money sits" />
                    {assets.length ? (
                        <>
                            <div className="relative mx-auto h-[170px] w-[170px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={assets} dataKey="balance" nameKey="account_name" innerRadius={56} outerRadius={80} paddingAngle={2} stroke="none">
                                            {assets.map((_, i) => (
                                                <Cell key={i} fill={ASSET_SHADES[i % ASSET_SHADES.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={TOOLTIP_STYLE} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                                    <div>
                                        <p className="text-base font-semibold text-ink">{formatINRCompact(totalAssets)}</p>
                                        <p className="text-[10px] text-muted">Assets</p>
                                    </div>
                                </div>
                            </div>
                            <ul className="mt-4 space-y-2 text-[12px]">
                                {assets.map((a, i) => (
                                    <li key={a.account_id} className="flex items-center justify-between gap-2">
                                        <Legend color={ASSET_SHADES[i % ASSET_SHADES.length]} label={a.account_name} />
                                        <span className="font-medium text-ink">{percentOf(a.balance, totalAssets)}%</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <EmptyState title="No asset balances" />
                    )}
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <EquationCard bs={bs} />
                <Card>
                    <CardHeader title="Revenue mix" />
                    <ShareList lines={pnl.details.revenue} total={pnl.summary.total_revenue} color={TYPE_STYLE.Revenue.color} empty="No revenue" />
                </Card>
                <Card>
                    <CardHeader title="Expense breakdown" />
                    <ShareList lines={pnl.details.expenses} total={pnl.summary.total_expenses} color={TYPE_STYLE.Expense.color} empty="No expenses" />
                </Card>
            </div>
        </div>
    );
}

function EquationCard({ bs }: { bs: BalanceSheet }) {
    const assets = bs.summary.total_assets;
    const liabilities = bs.summary.total_liabilities;
    const equity = bs.summary.total_liabilities_and_equity - liabilities;
    const max = Math.max(assets, bs.summary.total_liabilities_and_equity, 1);

    return (
        <Card>
            <CardHeader title="Accounting equation" action={<BalancedBadge balanced={bs.is_balanced} />} />
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 text-center">
                <EquationTerm label="Assets" value={assets} color={TYPE_STYLE.Asset.color} />
                <Equal className="h-4 w-4 text-slate-400" />
                <EquationTerm label="Liabilities" value={liabilities} color={TYPE_STYLE.Liability.color} />
                <Plus className="h-4 w-4 text-slate-400" />
                <EquationTerm label="Equity" value={equity} color={TYPE_STYLE.Equity.color} />
            </div>
            <div className="mt-5 space-y-2.5">
                <div>
                    <p className="mb-1 text-[11px] text-muted">Assets</p>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${(assets / max) * 100}%`, background: TYPE_STYLE.Asset.color }} />
                    </div>
                </div>
                <div>
                    <p className="mb-1 text-[11px] text-muted">Liabilities + Equity</p>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div style={{ width: `${(liabilities / max) * 100}%`, background: TYPE_STYLE.Liability.color }} />
                        <div style={{ width: `${(equity / max) * 100}%`, background: TYPE_STYLE.Equity.color }} />
                    </div>
                </div>
            </div>
            {bs.summary.current_year_earnings !== 0 && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted">
                    Equity includes {formatINR(bs.summary.current_year_earnings)} of current-year earnings.
                </p>
            )}
        </Card>
    );
}

function EquationTerm({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded-lg bg-slate-50 px-1.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
                {label}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-ink" title={formatINR(value)}>
                {formatINRCompact(value)}
            </p>
        </div>
    );
}

function ShareList({ lines, total, color, empty }: { lines: StatementLine[]; total: number; color: string; empty: string }) {
    if (!lines.length) return <EmptyState title={empty} />;
    return (
        <ul className="space-y-3.5">
            {[...lines]
                .sort((a, b) => b.balance - a.balance)
                .map((l) => {
                    const pct = percentOf(l.balance, total);
                    return (
                        <li key={l.account_id}>
                            <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                                <span className="truncate font-medium text-slate-700">{l.account_name}</span>
                                <span className="shrink-0 font-semibold text-ink">{formatINRCompact(l.balance)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full" style={{ width: `${clampPct(pct)}%`, background: color }} />
                                </div>
                                <span className="w-10 text-right text-[11px] text-muted">{pct}%</span>
                            </div>
                        </li>
                    );
                })}
        </ul>
    );
}

/* --------------------------------------------------------- Profit & Loss */

export function ProfitAndLossView({ pnl }: { pnl: ProfitAndLoss }) {
    const { total_revenue, total_expenses } = pnl.summary;
    const net = pnl.net_income;
    const topRevenue = [...pnl.details.revenue].sort((a, b) => b.balance - a.balance)[0];
    const topExpense = [...pnl.details.expenses].sort((a, b) => b.balance - a.balance)[0];
    const split = [
        { name: 'Expenses', value: Math.min(total_expenses, total_revenue) },
        { name: 'Surplus', value: Math.max(net, 0) }
    ];

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <Card padded={false} className="overflow-hidden lg:col-span-2">
                <StatementHeader title="Income & Expenditure Statement" period={pnl.period} />
                <StatementSection title="Revenue" color={TYPE_STYLE.Revenue.color} lines={pnl.details.revenue} base={total_revenue} baseLabel="of revenue" />
                <TotalRow label="Total revenue" value={total_revenue} />
                <StatementSection title="Expenses" color={TYPE_STYLE.Expense.color} lines={pnl.details.expenses} base={total_revenue} baseLabel="of revenue" />
                <TotalRow label="Total expenses" value={total_expenses} />
                <div
                    className={clsx(
                        'flex items-center justify-between px-5 py-4 text-white',
                        net >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-gradient-to-r from-rose-600 to-rose-500'
                    )}
                >
                    <div>
                        <p className="text-[13px] font-semibold">{net >= 0 ? 'Net surplus' : 'Net deficit'}</p>
                        <p className="text-[11px] text-white/80">{percentOf(net, total_revenue)}% of revenue</p>
                    </div>
                    <p className="text-xl font-semibold tabular-nums">{formatINR(net)}</p>
                </div>
            </Card>

            <Card>
                <CardHeader title="Margin analysis" />
                {total_revenue > 0 ? (
                    <>
                        <div className="relative mx-auto h-[170px] w-[170px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={split} dataKey="value" innerRadius={56} outerRadius={80} startAngle={90} endAngle={-270} stroke="none">
                                        <Cell fill={TYPE_STYLE.Expense.color} />
                                        <Cell fill={TYPE_STYLE.Revenue.color} />
                                    </Pie>
                                    <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={TOOLTIP_STYLE} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                                <div>
                                    <p className="text-xl font-semibold text-ink">{percentOf(net, total_revenue)}%</p>
                                    <p className="text-[10px] text-muted">Net margin</p>
                                </div>
                            </div>
                        </div>
                        <dl className="mt-5 divide-y divide-line text-[12px]">
                            <Ratio label="Expense ratio" value={`${percentOf(total_expenses, total_revenue)}%`} />
                            {topRevenue && <Ratio label="Largest income" value={topRevenue.account_name} />}
                            {topExpense && <Ratio label="Largest cost" value={topExpense.account_name} />}
                        </dl>
                    </>
                ) : (
                    <EmptyState title="No revenue in this period" />
                )}
            </Card>
        </div>
    );
}

function Ratio({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-muted">{label}</dt>
            <dd className="truncate text-right font-semibold text-ink">{value}</dd>
        </div>
    );
}

/* --------------------------------------------------------- Balance Sheet */

export function BalanceSheetView({ bs }: { bs: BalanceSheet }) {
    const s = bs.summary;
    const difference = s.total_assets - s.total_liabilities_and_equity;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
                <Card padded={false} className="overflow-hidden">
                    <StatementHeader title="Assets" period={bs.period} icon={Wallet} />
                    <StatementSection title="Assets" color={TYPE_STYLE.Asset.color} lines={bs.details.assets} base={s.total_assets} baseLabel="of assets" />
                    <GrandRow label="Total assets" value={s.total_assets} color={TYPE_STYLE.Asset.color} />
                </Card>

                <Card padded={false} className="overflow-hidden">
                    <StatementHeader title="Liabilities & Equity" period={bs.period} icon={Scale} />
                    <StatementSection
                        title="Liabilities"
                        color={TYPE_STYLE.Liability.color}
                        lines={bs.details.liabilities}
                        base={s.total_liabilities_and_equity}
                        baseLabel="of funding"
                    />
                    <TotalRow label="Total liabilities" value={s.total_liabilities} />
                    <StatementSection
                        title="Equity"
                        color={TYPE_STYLE.Equity.color}
                        lines={bs.details.equity}
                        base={s.total_liabilities_and_equity}
                        baseLabel="of funding"
                    />
                    <TotalRow label="Total equity" value={s.total_liabilities_and_equity - s.total_liabilities} />
                    <GrandRow label="Total liabilities & equity" value={s.total_liabilities_and_equity} color={TYPE_STYLE.Equity.color} />
                </Card>
            </div>

            <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-white">
                        <Scale className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-[13px] font-semibold text-ink">Assets = Liabilities + Equity</p>
                        <p className="text-[12px] text-muted">
                            {formatINR(s.total_assets)} vs {formatINR(s.total_liabilities_and_equity)}
                            {difference !== 0 && <span className="ml-1 font-semibold text-rose-600">(difference {formatINR(difference)})</span>}
                        </p>
                    </div>
                </div>
                <BalancedBadge balanced={bs.is_balanced} />
            </div>
        </div>
    );
}

/* --------------------------------------------------------- Trial Balance */

function balanceSide(type: AccountType, net: number) {
    if (!net) return '';
    const debitNormal = type === 'Asset' || type === 'Expense';
    return (net > 0) === debitNormal ? 'Dr' : 'Cr';
}

export function TrialBalanceView({ tb }: { tb: TrialBalance }) {
    const [type, setType] = useState<AccountType | 'all'>('all');
    const [query, setQuery] = useState('');

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return tb.accounts.filter(
            (a) =>
                (type === 'all' || a.account_type === type) &&
                (!q || a.account_name.toLowerCase().includes(q) || a.account_id.includes(q))
        );
    }, [tb.accounts, type, query]);

    const filtered = type !== 'all' || !!query.trim();
    const debits = rows.reduce((s, r) => s + r.total_debit, 0);
    const credits = rows.reduce((s, r) => s + r.total_credit, 0);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
                <SummaryTile label="Total debits" value={formatINR(tb.grand_total_debits)} accent="border-l-brand-500" />
                <SummaryTile label="Total credits" value={formatINR(tb.grand_total_credits)} accent="border-l-violet-500" />
                <SummaryTile
                    label="Difference"
                    value={formatINR(tb.grand_total_debits - tb.grand_total_credits)}
                    accent={tb.is_balanced ? 'border-l-emerald-500' : 'border-l-rose-500'}
                    extra={<BalancedBadge balanced={tb.is_balanced} />}
                />
            </div>

            <Card padded={false} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                        {(['all', ...ACCOUNT_TYPES] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={clsx(
                                    'rounded-full px-3 py-1 text-[12px] font-medium transition',
                                    type === t ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                )}
                            >
                                {t === 'all' ? 'All' : t}
                            </button>
                        ))}
                    </div>
                    <SearchBox value={query} onChange={setQuery} placeholder="Search account or code" />
                </div>

                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="th">Code</th>
                                    <th className="th">Account</th>
                                    <th className="th">Type</th>
                                    <th className="th text-right">Debit</th>
                                    <th className="th text-right">Credit</th>
                                    <th className="th text-right">Closing balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map((a) => {
                                    const side = balanceSide(a.account_type, a.net_balance);
                                    return (
                                        <tr key={a.account_id} className="hover:bg-slate-50/60">
                                            <td className="td font-mono text-[12px] text-slate-500">{a.account_id}</td>
                                            <td className="td font-medium text-ink">{a.account_name}</td>
                                            <td className="td">
                                                <TypeBadge type={a.account_type} />
                                            </td>
                                            <td className="td text-right tabular-nums">{a.total_debit ? formatINR(a.total_debit) : '—'}</td>
                                            <td className="td text-right tabular-nums">{a.total_credit ? formatINR(a.total_credit) : '—'}</td>
                                            <td className="td text-right font-semibold tabular-nums text-ink">
                                                {side ? (
                                                    <>
                                                        {formatINR(Math.abs(a.net_balance))}
                                                        <span
                                                            className={clsx(
                                                                'ml-1.5 rounded px-1 py-0.5 text-[10px] font-bold',
                                                                side === 'Dr' ? 'bg-brand-50 text-brand-700' : 'bg-violet-50 text-violet-700'
                                                            )}
                                                        >
                                                            {side}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="font-normal text-slate-400">Nil</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="border-t-2 border-navy-900/80 bg-slate-50">
                                <tr>
                                    <td className="td font-semibold text-ink" colSpan={3}>
                                        {filtered ? `Subtotal (${rows.length} of ${tb.accounts.length} accounts)` : 'Grand total'}
                                    </td>
                                    <td className="td text-right font-semibold tabular-nums text-ink">{formatINR(debits)}</td>
                                    <td className="td text-right font-semibold tabular-nums text-ink">{formatINR(credits)}</td>
                                    <td className="td text-right">{!filtered && <BalancedBadge balanced={tb.is_balanced} />}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="No accounts match" hint="Clear the filter or search to see every account." />
                )}
            </Card>
        </div>
    );
}

/* ----------------------------------------------------- Chart of Accounts */

export function ChartOfAccountsView({
    coa,
    loading,
    error,
    active
}: {
    coa: ChartOfAccounts | null;
    loading: boolean;
    error: string | null;
    active: TrialBalance;
}) {
    const [query, setQuery] = useState('');

    const activeIds = useMemo(
        () => new Set(active.accounts.filter((a) => a.total_debit || a.total_credit).map((a) => a.account_id)),
        [active.accounts]
    );

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = (coa?.accounts ?? []).filter(
            (a) => !q || a.account_name.toLowerCase().includes(q) || a.account_id.includes(q)
        );
        return ACCOUNT_TYPES.map((type) => ({
            type,
            accounts: list.filter((a) => a.account_type === type).sort((a, b) => a.account_id.localeCompare(b.account_id))
        })).filter((g) => g.accounts.length);
    }, [coa, query]);

    if (loading) return <ReportSkeleton compact />;
    if (error || !coa)
        return (
            <Card>
                <EmptyState title="Could not load the chart of accounts" hint={error ?? undefined} />
            </Card>
        );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">
                    <span className="font-semibold text-ink">{coa.count}</span> accounts ·{' '}
                    <span className="font-semibold text-ink">{activeIds.size}</span> with activity in this period
                </p>
                <SearchBox value={query} onChange={setQuery} placeholder="Search account or code" />
            </div>

            {groups.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    {groups.map((g) => (
                        <Card key={g.type} padded={false} className="overflow-hidden">
                            <div
                                className="flex items-center justify-between border-b border-line px-5 py-3.5"
                                style={{ boxShadow: `inset 3px 0 0 ${TYPE_STYLE[g.type].color}` }}
                            >
                                <div className="flex items-center gap-2.5">
                                    <TypeBadge type={g.type} />
                                    <span className="text-[12px] text-muted">{g.accounts[0].financial_statement}</span>
                                </div>
                                <span className="text-[12px] font-medium text-slate-500">{g.accounts.length} accounts</span>
                            </div>
                            <ul className="divide-y divide-line">
                                {g.accounts.map((a) => {
                                    const isActive = activeIds.has(a.account_id);
                                    return (
                                        <li key={a._id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/60">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[12px] font-semibold text-slate-600">
                                                    {a.account_id}
                                                </span>
                                                <span className="truncate text-[13px] font-medium text-slate-700">{a.account_name}</span>
                                            </div>
                                            <span
                                                className={clsx(
                                                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                    isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                                )}
                                            >
                                                {isActive ? 'Active' : 'No activity'}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <EmptyState title="No accounts match your search" />
                </Card>
            )}
        </div>
    );
}

/* ---------------------------------------------------------- Statement parts */

function StatementHeader({ title, period, icon: Icon = BookOpen }: { title: string; period: Period; icon?: typeof BookOpen }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-slate-50 to-white px-5 py-4">
            <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-900 text-white">
                    <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                    <h3 className="section-title">{title}</h3>
                    <p className="text-[11px] text-muted">{periodLabel(period)}</p>
                </div>
            </div>
        </div>
    );
}

function StatementSection({
    title,
    color,
    lines,
    base,
    baseLabel
}: {
    title: string;
    color: string;
    lines: StatementLine[];
    base: number;
    baseLabel: string;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 px-5 pb-1 pt-4">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
            </div>
            {lines.length ? (
                <ul>
                    {lines.map((l) => {
                        const pct = percentOf(l.balance, base);
                        return (
                            <li key={l.account_id} className="grid grid-cols-[1fr_auto] items-center gap-x-6 px-5 py-2.5 hover:bg-slate-50/60">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-slate-400">{l.account_id}</span>
                                        <span className="truncate text-[13px] font-medium text-slate-700">{l.account_name}</span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full" style={{ width: `${clampPct(pct)}%`, background: color }} />
                                        </div>
                                        <span className="text-[11px] text-muted">
                                            {pct}% {baseLabel}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-right text-[13px] font-semibold tabular-nums text-ink">{formatINR(l.balance)}</span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="px-5 py-2.5 text-[12px] text-slate-400">No balances</p>
            )}
        </div>
    );
}

function TotalRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="mt-2 flex items-center justify-between border-y border-line bg-slate-50/80 px-5 py-2.5">
            <span className="text-[13px] font-semibold text-slate-700">{label}</span>
            <span className="text-[14px] font-semibold tabular-nums text-ink">{formatINR(value)}</span>
        </div>
    );
}

function GrandRow({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center justify-between bg-navy-900 px-5 py-4 text-white" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
            <span className="text-[13px] font-semibold">{label}</span>
            <span className="text-lg font-semibold tabular-nums">{formatINR(value)}</span>
        </div>
    );
}
