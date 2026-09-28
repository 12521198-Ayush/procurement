'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    Boxes,
    CheckCircle2,
    ClipboardList,
    Clock,
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
    { href: '/rfq/new', label: 'Raise Bid / RFQ', icon: FilePlus2, tone: 'bg-blue-50 text-blue-600' },
    { href: '/quotations', label: 'View Quotations', icon: Quote, tone: 'bg-violet-50 text-violet-600' },
    { href: '/purchase-orders/new', label: 'Create Purchase Order', icon: ShoppingCart, tone: 'bg-emerald-50 text-emerald-600' },
    { href: '/payments', label: 'Make Payment', icon: Receipt, tone: 'bg-amber-50 text-amber-600' },
    { href: '/inventory', label: 'Request Stock', icon: Boxes, tone: 'bg-sky-50 text-sky-600' },
    { href: '/vendors/new', label: 'Add Vendor', icon: UserPlus, tone: 'bg-rose-50 text-rose-600' }
];

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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={FileText}
                    tone="violet"
                    label="Total Bids Raised"
                    value={data!.kpis.bids_raised.value}
                    trend={data!.kpis.bids_raised.trend}
                    caption="vs last 30 days"
                />
                <StatCard
                    icon={Users}
                    tone="blue"
                    label="Active Vendors"
                    value={data!.kpis.active_vendors.value}
                    trend={data!.kpis.active_vendors.trend}
                    caption="vs last 30 days"
                />
                <StatCard
                    icon={ShoppingCart}
                    tone="emerald"
                    label="Purchase Orders"
                    value={data!.kpis.purchase_orders.value}
                    trend={data!.kpis.purchase_orders.trend}
                    caption="vs last 30 days"
                />
                <StatCard
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
                                    <Bar dataKey="spent" fill="#2563eb" radius={[4, 4, 0, 0]} />
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

            {/* Budget + activity + alerts */}
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
                                            <Cell fill="#2563eb" />
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
                                <LegendRow color="#2563eb" label="Used" value={formatMoney(data!.budget.used_minor)} />
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

                <div className="space-y-4">
                    <AlertCard
                        icon={ClipboardList}
                        tone="bg-blue-50 text-blue-600"
                        count={data!.alerts.pending_approvals}
                        label="Pending Approvals"
                        hint="Awaiting your action"
                        href="/budget"
                    />
                    <AlertCard
                        icon={Clock}
                        tone="bg-amber-50 text-amber-600"
                        count={data!.alerts.rfq_expiring_today}
                        label="RFQ Expiry"
                        hint="Closing within 24 hours"
                        href="/rfq"
                    />
                    <AlertCard
                        icon={AlertTriangle}
                        tone="bg-rose-50 text-rose-600"
                        count={data!.alerts.low_stock_items}
                        label="Low Stock Items"
                        hint="At or below minimum level"
                        href="/inventory"
                    />
                </div>
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
            <span className="flex items-center gap-2 text-muted">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                {label}
            </span>
            <span className="font-medium text-ink">{value}</span>
        </div>
    );
}

function AlertCard({
    icon: Icon,
    tone,
    count,
    label,
    hint,
    href
}: {
    icon: typeof CheckCircle2;
    tone: string;
    count: number;
    label: string;
    hint: string;
    href: string;
}) {
    return (
        <Link href={href} className="card card-pad flex items-center gap-4 transition hover:border-brand-200">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
                <p className="text-xl font-semibold leading-none text-ink">{count}</p>
                <p className="mt-1 text-[13px] font-medium text-slate-700">{label}</p>
                <p className="text-[11px] text-muted">{hint}</p>
            </div>
        </Link>
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[132px] animate-pulse rounded-xl bg-slate-200" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="h-[330px] animate-pulse rounded-xl bg-slate-200 lg:col-span-2" />
                <div className="h-[330px] animate-pulse rounded-xl bg-slate-200" />
            </div>
        </div>
    );
}
