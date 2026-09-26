'use client';

import { useState } from 'react';
import { Download, IndianRupee, Receipt, Users } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatMoney, formatMoneyCompact } from '@/lib/format';

const PIE_COLORS = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const EXPORTS = [
    { value: 'vendors', label: 'Vendors' },
    { value: 'rfqs', label: 'RFQs' },
    { value: 'quotations', label: 'Quotations' },
    { value: 'purchase_orders', label: 'Purchase Orders' },
    { value: 'payments', label: 'Payments' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'budgets', label: 'Budgets' }
];

export default function ReportsPage() {
    const toast = useToast();
    const [tab, setTab] = useState('spend');
    const [range, setRange] = useState({ from: '', to: '' });

    const spend = useResource<any>('/procurement/reports/spend', range);
    const vendors = useResource<any>('/procurement/reports/vendor-performance', {});
    const budget = useResource<any>('/procurement/reports/budget-utilisation', {});
    const inventory = useResource<any>('/procurement/reports/inventory-valuation', {});

    async function exportReport(type: string) {
        try {
            const res = await api.post('/procurement/reports/export', { type }, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('Export downloaded');
        } catch {
            toast.error('Could not generate the export');
        }
    }

    const monthly = (spend.data?.by_month ?? []).map((m: any) => ({ label: m.label, value: m.total_minor / 100 }));
    const byDepartment = (spend.data?.by_department ?? []).map((d: any) => ({
        name: d.department_name,
        value: d.total_minor
    }));

    return (
        <div>
            <PageHeader title="Reports & Analytics" subtitle="Everything is computed live from your procurement records." />

            <div className="mb-4">
                <Tabs
                    tabs={[
                        { value: 'spend', label: 'Spend' },
                        { value: 'vendors', label: 'Vendor performance' },
                        { value: 'budget', label: 'Budget utilisation' },
                        { value: 'inventory', label: 'Inventory valuation' },
                        { value: 'exports', label: 'Exports' }
                    ]}
                    active={tab}
                    onChange={setTab}
                />
            </div>

            {tab === 'spend' && (
                <div className="space-y-5">
                    <Card>
                        <div className="flex flex-wrap items-end gap-3">
                            <Field label="From">
                                <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                            </Field>
                            <Field label="To">
                                <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
                            </Field>
                        </div>
                    </Card>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard icon={IndianRupee} tone="emerald" label="Total spend" value={formatMoneyCompact(spend.data?.total_spend_minor)} />
                        <StatCard icon={Receipt} tone="blue" label="Payments" value={spend.data?.payment_count ?? 0} />
                        <StatCard icon={Users} tone="violet" label="Vendors paid" value={spend.data?.by_vendor?.length ?? 0} />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <CardHeader title="Monthly spend" />
                            {monthly.some((m: any) => m.value > 0) ? (
                                <div className="h-[260px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthly} barSize={26}>
                                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                                            <Tooltip formatter={(v: number) => formatMoney(v * 100)} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <EmptyState title="No spend in this period" />
                            )}
                        </Card>

                        <Card>
                            <CardHeader title="By department" />
                            {byDepartment.length ? (
                                <>
                                    <div className="h-[180px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={byDepartment} dataKey="value" innerRadius={45} outerRadius={70} stroke="none">
                                                    {byDepartment.map((_: any, i: number) => (
                                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <ul className="mt-3 space-y-1.5 text-[13px]">
                                        {byDepartment.slice(0, 5).map((d: any, i: number) => (
                                            <li key={d.name} className="flex items-center justify-between">
                                                <span className="flex items-center gap-2 text-muted">
                                                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                    {d.name}
                                                </span>
                                                <span className="font-medium text-ink">{formatMoney(d.value)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <EmptyState title="No departmental spend yet" />
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {tab === 'vendors' && (
                <SimpleTable
                    loading={vendors.loading}
                    rows={vendors.data?.array ?? []}
                    empty="No vendor activity yet"
                    columns={[
                        { header: 'Vendor', render: (v: any) => <span className="font-medium text-ink">{v.company_name}</span> },
                        { header: 'RFQs', render: (v: any) => v.rfqs_received, align: 'right' },
                        { header: 'Quoted', render: (v: any) => v.quotations_submitted, align: 'right' },
                        { header: 'Response rate', render: (v: any) => `${v.response_rate_percent}%`, align: 'right' },
                        { header: 'Orders', render: (v: any) => v.purchase_orders, align: 'right' },
                        { header: 'Order value', render: (v: any) => formatMoney(v.order_value_minor), align: 'right' },
                        { header: 'Paid', render: (v: any) => formatMoney(v.paid_minor), align: 'right' }
                    ]}
                />
            )}

            {tab === 'budget' && (
                <SimpleTable
                    loading={budget.loading}
                    rows={budget.data?.array ?? []}
                    empty="No budgets allocated"
                    columns={[
                        { header: 'Department', render: (b: any) => <span className="font-medium text-ink">{b.department_name}</span> },
                        { header: 'Year', render: (b: any) => b.financial_year },
                        { header: 'Allocated', render: (b: any) => formatMoney(b.allocated_minor), align: 'right' },
                        { header: 'Used', render: (b: any) => formatMoney(b.used_minor), align: 'right' },
                        { header: 'Remaining', render: (b: any) => formatMoney(b.remaining_minor), align: 'right' },
                        {
                            header: 'Utilisation',
                            align: 'right',
                            render: (b: any) => (
                                <span className={b.is_exceeded ? 'font-medium text-rose-600' : ''}>{b.utilisation_percent}%</span>
                            )
                        }
                    ]}
                />
            )}

            {tab === 'inventory' && (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <StatCard icon={Receipt} tone="blue" label="Items" value={inventory.data?.total_items ?? 0} />
                        <StatCard icon={IndianRupee} tone="emerald" label="Stock value" value={formatMoneyCompact(inventory.data?.total_value_minor)} />
                    </div>
                    <SimpleTable
                        loading={inventory.loading}
                        rows={inventory.data?.array ?? []}
                        empty="No inventory items"
                        columns={[
                            { header: 'Item', render: (i: any) => <span className="font-medium text-ink">{i.name}</span> },
                            { header: 'SKU', render: (i: any) => i.sku },
                            { header: 'Quantity', render: (i: any) => `${i.quantity} ${i.unit}`, align: 'right' },
                            { header: 'Unit cost', render: (i: any) => formatMoney(i.unit_cost_minor), align: 'right' },
                            { header: 'Value', render: (i: any) => formatMoney(i.value_minor), align: 'right' }
                        ]}
                    />
                </div>
            )}

            {tab === 'exports' && (
                <Card>
                    <CardHeader title="Download data" />
                    <p className="mb-4 text-[13px] text-muted">Exports are generated as Excel workbooks with amounts in rupees.</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {EXPORTS.map((e) => (
                            <button
                                key={e.value}
                                type="button"
                                onClick={() => exportReport(e.value)}
                                className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                            >
                                <span className="text-[13px] font-medium text-slate-700">{e.label}</span>
                                <Download className="h-4 w-4 text-slate-400" />
                            </button>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

function SimpleTable({
    columns,
    rows,
    loading,
    empty
}: {
    columns: { header: string; render: (row: any) => React.ReactNode; align?: 'left' | 'right' }[];
    rows: any[];
    loading?: boolean;
    empty: string;
}) {
    if (loading) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;

    return (
        <Card padded={false}>
            {rows.length ? (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-line bg-slate-50/80">
                            <tr>
                                {columns.map((c) => (
                                    <th key={c.header} className={`th ${c.align === 'right' ? 'text-right' : ''}`}>
                                        {c.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {rows.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50/60">
                                    {columns.map((c) => (
                                        <td key={c.header} className={`td ${c.align === 'right' ? 'text-right' : ''}`}>
                                            {c.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState title={empty} />
            )}
        </Card>
    );
}
