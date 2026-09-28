'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    Boxes,
    Building2,
    FileText,
    IndianRupee,
    PiggyBank,
    ShoppingCart
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { postCluster } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney, formatMoneyCompact } from '@/lib/format';

type PremiseRow = {
    premise_id: string;
    premise_name: string;
    bids_raised: number;
    open_rfqs: number;
    purchase_orders: number;
    active_vendors: number;
    spend_minor: number;
    pending_approvals: number;
    low_stock_items: number;
    budget_allocated_minor: number;
    budget_used_minor: number;
    budget_remaining_minor: number;
    budget_utilisation_percent: number;
};

type ClusterData = {
    premises: PremiseRow[];
    totals: Omit<PremiseRow, 'premise_id' | 'premise_name'> & { premises: number };
    currency: string;
    financial_year: string;
    window_days: number;
};

export default function ClusterPage() {
    const router = useRouter();
    const { switchPremise, activePremiseId, isMultiPremise, ready } = useAuth();
    const [data, setData] = useState<ClusterData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (ready && !isMultiPremise) router.replace('/dashboard');
    }, [ready, isMultiPremise, router]);

    useEffect(() => {
        let cancelled = false;
        postCluster<ClusterData>('/procurement/dashboard/cluster')
            .then((res) => !cancelled && setData(res))
            .catch((err) => !cancelled && setError(err.message))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, []);

    function openPremise(premiseId: string) {
        switchPremise(premiseId);
        router.push('/dashboard');
    }

    if (loading) {
        return (
            <div className="space-y-5">
                <div className="h-20 animate-pulse rounded-xl bg-slate-200" />
                <div className="h-80 animate-pulse rounded-xl bg-slate-200" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <Card>
                <EmptyState title="Could not load the cluster view" hint={error ?? undefined} />
            </Card>
        );
    }

    const { totals, premises } = data;
    const chartData = premises.map((p) => ({
        name: p.premise_name.length > 16 ? `${p.premise_name.slice(0, 15)}…` : p.premise_name,
        spend: p.spend_minor / 100
    }));

    return (
        <div className="space-y-5">
            <PageHeader
                title="Cluster View"
                subtitle={`Combined picture across the ${totals.premises} societies assigned to you. Last ${data.window_days} days.`}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Building2} tone="violet" label="Societies" value={totals.premises} />
                <StatCard icon={FileText} tone="blue" label="Bids Raised" value={totals.bids_raised} caption={`${totals.open_rfqs} still open`} />
                <StatCard icon={ShoppingCart} tone="emerald" label="Purchase Orders" value={totals.purchase_orders} caption={`${totals.active_vendors} active vendors`} />
                <StatCard
                    icon={IndianRupee}
                    tone="amber"
                    label="Total Spend"
                    value={formatMoneyCompact(totals.spend_minor, data.currency)}
                />
            </div>

            {(totals.pending_approvals > 0 || totals.low_stock_items > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <AlertTile
                        icon={AlertTriangle}
                        tone="amber"
                        label="Approvals waiting across the cluster"
                        value={totals.pending_approvals}
                    />
                    <AlertTile icon={Boxes} tone="rose" label="Items at or below minimum stock" value={totals.low_stock_items} />
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader title="Spend by society" />
                    {chartData.some((d) => d.spend > 0) ? (
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barSize={24}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" height={60} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        formatter={(v: number) => formatMoney(v * 100, data.currency)}
                                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                                    />
                                    <Bar dataKey="spend" fill="#34a4f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState title="No spend recorded yet" hint="Completed payments will appear here per society." />
                    )}
                </Card>

                <Card>
                    <CardHeader title={`Budget — FY ${data.financial_year}`} />
                    <div className="space-y-1">
                        <div className="flex items-baseline justify-between">
                            <span className="text-[13px] text-muted">Allocated</span>
                            <span className="text-[15px] font-semibold text-ink">
                                {formatMoney(totals.budget_allocated_minor, data.currency)}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-[13px] text-muted">Used</span>
                            <span className="text-[13px] font-medium text-ink">
                                {formatMoney(totals.budget_used_minor, data.currency)}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-[13px] text-muted">Remaining</span>
                            <span className="text-[13px] font-medium text-emerald-700">
                                {formatMoney(totals.budget_remaining_minor, data.currency)}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4">
                        <Utilisation percent={totals.budget_utilisation_percent} />
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
                        <PiggyBank className="mt-0.5 h-4 w-4 shrink-0" />
                        Budgets are set per society. This is the sum of every budget you have access to.
                    </p>
                </Card>
            </div>

            <Card padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                    <h3 className="text-[15px] font-semibold text-ink">Society breakdown</h3>
                    <span className="text-[12px] text-muted">Open a society to make changes in it</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px]">
                        <thead className="border-y border-line bg-slate-50/80">
                            <tr>
                                <th className="th text-left">Society</th>
                                <th className="th text-right">Bids</th>
                                <th className="th text-right">Open</th>
                                <th className="th text-right">POs</th>
                                <th className="th text-right">Vendors</th>
                                <th className="th text-right">Spend</th>
                                <th className="th text-right">Budget used</th>
                                <th className="th text-right">Approvals</th>
                                <th className="th" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {premises.map((p) => (
                                <tr key={p.premise_id} className={p.premise_id === activePremiseId ? 'bg-brand-50/40' : undefined}>
                                    <td className="td">
                                        <span className="font-medium text-ink">{p.premise_name}</span>
                                        {p.premise_id === activePremiseId && (
                                            <span className="ml-2 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                                                Current
                                            </span>
                                        )}
                                    </td>
                                    <td className="td text-right">{p.bids_raised}</td>
                                    <td className="td text-right">{p.open_rfqs}</td>
                                    <td className="td text-right">{p.purchase_orders}</td>
                                    <td className="td text-right">{p.active_vendors}</td>
                                    <td className="td text-right font-medium text-ink">
                                        {formatMoney(p.spend_minor, data.currency)}
                                    </td>
                                    <td className="td text-right">
                                        {p.budget_allocated_minor ? `${p.budget_utilisation_percent}%` : '—'}
                                    </td>
                                    <td className="td text-right">
                                        {p.pending_approvals ? (
                                            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[12px] font-medium text-amber-700">
                                                {p.pending_approvals}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="td text-right">
                                        <button
                                            type="button"
                                            onClick={() => openPremise(p.premise_id)}
                                            className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                                        >
                                            Open
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function Utilisation({ percent }: { percent: number }) {
    const capped = Math.min(percent, 100);
    const tone = percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
        <div>
            <div className="mb-1 flex justify-between text-[12px]">
                <span className="text-muted">Utilisation</span>
                <span className="font-medium text-ink">{percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${capped}%` }} />
            </div>
        </div>
    );
}

function AlertTile({
    icon: Icon,
    tone,
    label,
    value
}: {
    icon: typeof AlertTriangle;
    tone: 'amber' | 'rose';
    label: string;
    value: number;
}) {
    const tones = {
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        rose: 'border-rose-200 bg-rose-50 text-rose-800'
    };
    return (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}>
            <Icon className="h-5 w-5 shrink-0" />
            <p className="text-[13px]">
                <span className="text-[16px] font-semibold">{value}</span> {label}
            </p>
        </div>
    );
}
