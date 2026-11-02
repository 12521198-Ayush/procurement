'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Boxes,
    FilePlus2,
    FileText,
    IndianRupee,
    Quote,
    Receipt,
    ShoppingCart,
    UserPlus,
    Users
} from 'lucide-react';
import {
    Bar,
    BarChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import StatusPill from '@/components/ui/StatusPill';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney, formatMoneyCompact, timeAgo } from '@/lib/format';

type Summary = {
    kpis: {
        bids_raised: { value: number; trend: number };
        active_vendors: { value: number; trend: number };
        purchase_orders: { value: number; trend: number };
        total_spend: { value_minor: number; currency: string; trend: number };
    };
    alerts: { pending_approvals: number; rfq_expiring_today: number; low_stock_items: number };
    // Optional so the page still renders against an older API build.
    rfq_status?: { status: string; count: number }[];
    po_status?: { status: string; count: number }[];
    top_vendors?: { vendor_id: string; vendor_name: string; total_minor: number; payments: number }[];
    spend_by_department?: { department_id: string | null; department_name: string; total_minor: number }[];
    budget: {
        total_minor: number;
        used_minor: number;
        remaining_minor: number;
        utilisation_percent: number;
        currency: string;
    };
    spending_overview: { label: string; spent_minor: number }[];
    recent_activity: {
        action: string;
        entity_type: string;
        user_name: string;
        remarks: string | null;
        ts: string;
    }[];
    recent_quotations: {
        quotation_id: string;
        quotation_number: string;
        vendor_name: string;
        grand_total_minor: number;
        currency: string;
        status: string;
        submitted_at: string;
    }[];
};

const QUICK_ACTIONS = [
    { href: '/rfq/new', label: 'Raise Bid / RFQ', icon: FilePlus2, tone: 'bg-brand-50 text-brand-600' },
    { href: '/quotations', label: 'View Quotations', icon: Quote, tone: 'bg-violet-50 text-violet-600' },
    { href: '/quotations', label: 'Create Purchase Order', icon: ShoppingCart, tone: 'bg-emerald-50 text-emerald-600' },
    { href: '/payments', label: 'Make Payment', icon: Receipt, tone: 'bg-amber-50 text-amber-600' },
    { href: '/inventory', label: 'Request Stock', icon: Boxes, tone: 'bg-accent-50 text-accent-600' },
    { href: '/vendors/new', label: 'Add Vendor', icon: UserPlus, tone: 'bg-rose-50 text-rose-600' }
];

const CHART_COLORS = ['#34a4f6', '#fbb12c', '#8b5cf6', '#10b981', '#ef4444', '#17568b', '#94a3b8'];

export default function DashboardPage() {
    const { user, activePremiseId, activePremiseName } = useAuth();
    const [data, setData] = useState<Summary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        post<Summary>('/procurement/dashboard/summary')
            .then((res) => !cancelled && setData(res))
            .catch((err) => !cancelled && setError(err.message))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [activePremiseId]);

    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const chartData = (data?.spending_overview ?? []).map((m) => ({
        label: m.label,
        spent: m.spent_minor / 100
    }));

    const budgetPie = data
        ? [
              { name: 'Used', value: data.budget.used_minor },
              { name: 'Remaining', value: data.budget.remaining_minor }
          ]
        : [];

    if (loading) return <DashboardSkeleton />;

    if (error) {
        return (
            <Card>
                <EmptyState title="Could not load your dashboard" hint={error} />
            </Card>
        );
    }

    return (
        <div className="space-y-5">
            {/* Greeting */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-ink">
                        {greeting}, {user?.name?.split(' ')[0]}
                    </h1>
                    <p className="mt-0.5 text-[13px] text-muted">
                        {activePremiseName
                            ? `Here's what's happening at ${activePremiseName} today.`
                            : "Here's what's happening with your procurement today."}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[13px] font-medium text-ink">{today}</p>
                    <p className="text-[11px] text-muted">{user?.role}</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    compact
                    icon={FileText}
                    tone="violet"
                    label="Total Bids Raised"
                    value={data!.kpis.bids_raised.value}
                    trend={data!.kpis.bids_raised.trend}
                    caption="vs last 30 days"
                />
                <StatCard
                    compact
                    icon={Users}
                    tone="blue"
                    label="Active Vendors"
                    value={data!.kpis.active_vendors.value}
                    trend={data!.kpis.active_vendors.trend}
                    caption="vs last 30 days"
                />
                <StatCard
                    compact
                    icon={ShoppingCart}
                    tone="emerald"
                    label="Purchase Orders"
                    value={data!.kpis.purchase_orders.value}
                    trend={data!.kpis.purchase_orders.trend}
                    caption="vs last 30 days"
                />
                <StatCard
                    compact
                    icon={IndianRupee}
                    tone="amber"
                    label="Total Spend (This Month)"
                    value={formatMoneyCompact(
                        data!.kpis.total_spend.value_minor,
                        data!.kpis.total_spend.currency
                    )}
                    trend={data!.kpis.total_spend.trend}
                    caption="vs last 30 days"
                />
            </div>

            {/* Pipeline analytics */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader title="RFQ Pipeline" />
                    <Donut
                        data={(data!.rfq_status ?? []).map((r) => ({ name: humaniseAction(r.status), value: r.count }))}
                        centerLabel="RFQs"
                        format={(v) => String(v)}
                        emptyTitle="No RFQs yet"
                        emptyHint="Raise a bid to see it move through the pipeline."
                    />
                </Card>

                <Card>
                    <CardHeader title="Purchase Order Status" />
                    <BarList
                        rows={(data!.po_status ?? []).map((r) => ({ label: humaniseAction(r.status), value: r.count, display: String(r.count) }))}
                        emptyTitle="No purchase orders yet"
                        emptyHint="Select a winning quotation to create one."
                    />
                </Card>

                <Card>
                    <CardHeader title="Spend by Department" action={<span className="text-[11px] text-muted">This FY</span>} />
                    <Donut
                        data={(data!.spend_by_department ?? []).map((r) => ({ name: r.department_name, value: r.total_minor }))}
                        centerLabel="Spent"
                        format={(v) => formatMoneyCompact(v)}
                        emptyTitle="No spend recorded"
                        emptyHint="Completed payments are split by department here."
                    />
                </Card>
            </div>

            {/* Spending + quick actions */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader title="Spending Overview" />
                    {chartData.some((d) => d.spent > 0) ? (
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barSize={26}>
                                    <XAxis
                                        dataKey="label"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        formatter={(v: number) => formatMoney(v * 100)}
                                        contentStyle={{
                                            borderRadius: 10,
                                            border: '1px solid #e2e8f0',
                                            fontSize: 12
                                        }}
                                    />
                                    <Bar dataKey="spent" fill="#34a4f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState
                            title="No spending recorded yet"
                            hint="Completed payments will appear here as a monthly trend."
                        />
                    )}
                </Card>

                <Card>
                    <CardHeader title="Quick Actions" />
                    <div className="grid grid-cols-2 gap-3">
                        {QUICK_ACTIONS.map(({ href, label, icon: Icon, tone }) => (
                            <Link
                                key={href}
                                href={href}
                                className="group rounded-xl border border-line p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                            >
                                <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>
                                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                                </span>
                                <span className="mt-2.5 block text-[12px] font-medium leading-snug text-slate-700 group-hover:text-brand-700">
                                    {label}
                                </span>
                            </Link>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Budget + activity + vendors */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader title="Budget Overview" />
                    {data!.budget.total_minor > 0 ? (
                        <div className="flex items-center gap-5">
                            <div className="relative h-[130px] w-[130px] shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={budgetPie}
                                            dataKey="value"
                                            innerRadius={44}
                                            outerRadius={62}
                                            startAngle={90}
                                            endAngle={-270}
                                            stroke="none"
                                        >
                                            <Cell fill="#34a4f6" />
                                            <Cell fill="#e2e8f0" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                                    <div className="text-center">
                                        <p className="text-xl font-semibold text-ink">
                                            {data!.budget.utilisation_percent}%
                                        </p>
                                        <p className="text-[10px] text-muted">Used</p>
                                    </div>
                                </div>
                            </div>
                            <dl className="min-w-0 flex-1 space-y-3 text-[13px]">
                                <LegendRow color="#34a4f6" label="Used" value={formatMoney(data!.budget.used_minor)} />
                                <LegendRow color="#e2e8f0" label="Remaining" value={formatMoney(data!.budget.remaining_minor)} />
                                <div className="border-t border-line pt-3">
                                    <dt className="text-muted">Total Budget</dt>
                                    <dd className="mt-0.5 font-semibold text-ink">
                                        {formatMoney(data!.budget.total_minor)}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    ) : (
                        <EmptyState
                            title="No budget allocated"
                            hint="Set department budgets to track utilisation here."
                        />
                    )}
                </Card>

                <Card>
                    <CardHeader title="Recent Activity" />
                    {data!.recent_activity.length ? (
                        <ul className="space-y-4">
                            {data!.recent_activity.map((a, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-medium text-slate-700">
                                            {humaniseAction(a.action)}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-muted">
                                            {a.user_name} · {timeAgo(a.ts)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState title="Nothing has happened yet" hint="Actions you take will be listed here." />
                    )}
                </Card>

                <Card>
                    <CardHeader
                        title="Top Vendors by Spend"
                        action={
                            <Link href="/vendors" className="text-[12px] font-medium text-brand-600 hover:text-brand-700">
                                View all
                            </Link>
                        }
                    />
                    <BarList
                        rows={(data!.top_vendors ?? []).map((v) => ({
                            label: v.vendor_name,
                            value: v.total_minor,
                            display: formatMoneyCompact(v.total_minor)
                        }))}
                        emptyTitle="No vendor payments yet"
                        emptyHint="Vendors you pay this financial year will rank here."
                    />
                </Card>
            </div>

            {/* Recent quotations */}
            <Card padded={false}>
                <div className="flex items-center justify-between px-5 py-4">
                    <h3 className="section-title">Recent Quotations</h3>
                    <Link href="/quotations" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">
                        View all
                    </Link>
                </div>
                {data!.recent_quotations.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-y border-line bg-slate-50/80">
                                <tr>
                                    <th className="th">Quotation No.</th>
                                    <th className="th">Vendor</th>
                                    <th className="th">Amount</th>
                                    <th className="th">Status</th>
                                    <th className="th">Submitted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {data!.recent_quotations.map((q) => (
                                    <tr key={q.quotation_id} className="hover:bg-slate-50/60">
                                        <td className="td font-medium text-ink">{q.quotation_number}</td>
                                        <td className="td">{q.vendor_name}</td>
                                        <td className="td font-medium">
                                            {formatMoney(q.grand_total_minor, q.currency)}
                                        </td>
                                        <td className="td">
                                            <StatusPill status={q.status} />
                                        </td>
                                        <td className="td text-muted">{timeAgo(q.submitted_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No quotations received yet"
                        hint="Raise an RFQ and invite vendors to start receiving quotations."
                    />
                )}
            </Card>
        </div>
    );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-muted">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="truncate">{label}</span>
            </span>
            <span className="shrink-0 font-medium text-ink">{value}</span>
        </div>
    );
}

function Donut({
    data,
    centerLabel,
    format,
    emptyTitle,
    emptyHint
}: {
    data: { name: string; value: number }[];
    centerLabel: string;
    format: (v: number) => string;
    emptyTitle: string;
    emptyHint: string;
}) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (!total) return <EmptyState title={emptyTitle} hint={emptyHint} />;

    return (
        <div className="flex items-center gap-5">
            <div className="relative h-[130px] w-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} stroke="none">
                            {data.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(v: number) => format(v)}
                            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                        <p className="text-base font-semibold text-ink">{format(total)}</p>
                        <p className="text-[10px] text-muted">{centerLabel}</p>
                    </div>
                </div>
            </div>
            <dl className="min-w-0 flex-1 space-y-2 text-[12px]">
                {data.slice(0, 6).map((d, i) => (
                    <LegendRow key={d.name} color={CHART_COLORS[i % CHART_COLORS.length]} label={d.name} value={format(d.value)} />
                ))}
            </dl>
        </div>
    );
}

function BarList({
    rows,
    emptyTitle,
    emptyHint
}: {
    rows: { label: string; value: number; display: string }[];
    emptyTitle: string;
    emptyHint: string;
}) {
    const max = Math.max(0, ...rows.map((r) => r.value));
    if (!max) return <EmptyState title={emptyTitle} hint={emptyHint} />;

    return (
        <ul className="space-y-3.5">
            {rows.map((r, i) => (
                <li key={r.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate font-medium text-slate-700">{r.label}</span>
                        <span className="shrink-0 font-semibold text-ink">{r.display}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${(r.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

function humaniseAction(action: string) {
    return action
        .toLowerCase()
        .split('_')
        .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');
}

function DashboardSkeleton() {
    return (
        <div className="space-y-5">
            <div className="h-12 w-64 animate-pulse rounded-lg bg-slate-200" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[112px] animate-pulse rounded-xl bg-slate-200" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="h-[330px] animate-pulse rounded-xl bg-slate-200 lg:col-span-2" />
                <div className="h-[330px] animate-pulse rounded-xl bg-slate-200" />
            </div>
        </div>
    );
}
