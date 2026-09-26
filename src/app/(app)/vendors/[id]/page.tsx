'use client';

import Link from 'next/link';
import { ArrowLeft, Building2, FileText, Mail, MapPin, Phone, Receipt, ShoppingCart, Star } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { useResource } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

export default function VendorDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { data, loading, error } = useResource<any>('/procurement/vendors/detail', { vendor_id: id });

    if (loading) {
        return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    }

    if (error || !data) {
        return (
            <Card>
                <EmptyState title="Could not load this vendor" hint={error ?? undefined} />
            </Card>
        );
    }

    const { vendor, performance, recent_quotations, recent_orders } = data;

    return (
        <div className="space-y-5">
            <Link href="/vendors" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
                <ArrowLeft className="h-4 w-4" />
                Back to vendors
            </Link>

            <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-4">
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                            <Building2 className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-semibold text-ink">{vendor.company_name}</h1>
                                <StatusPill status={vendor.status} />
                            </div>
                            <p className="mt-0.5 text-[13px] text-muted">{vendor.contact_person}</p>
                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-slate-600">
                                <span className="inline-flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                                    {vendor.email}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                    +91 {String(vendor.mobile || '').replace(/^000?91/, '')}
                                </span>
                                {vendor.city && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                        {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
                        <dt className="text-muted">GST</dt>
                        <dd className="font-medium text-ink">{vendor.gst_number || '—'}</dd>
                        <dt className="text-muted">PAN</dt>
                        <dd className="font-medium text-ink">{vendor.pan_number || '—'}</dd>
                    </dl>
                </div>

                {vendor.categories?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
                        {vendor.categories.map((c: any) => (
                            <span key={c.category_id} className="rounded-md bg-slate-100 px-2.5 py-1 text-[12px] text-slate-600">
                                {c.name}
                            </span>
                        ))}
                    </div>
                )}
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={FileText} label="RFQs received" value={performance.rfqs_received} />
                <MetricCard
                    icon={Star}
                    label="Response rate"
                    value={`${performance.response_rate_percent}%`}
                    caption={`${performance.quotations_submitted} quotations submitted`}
                />
                <MetricCard icon={ShoppingCart} label="Purchase orders" value={performance.purchase_orders} />
                <MetricCard
                    icon={Receipt}
                    label="Total order value"
                    value={formatMoney(performance.total_order_value_minor)}
                    caption={`${formatMoney(performance.paid_minor)} paid`}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card padded={false}>
                    <CardHeader title="Recent quotations" className="px-5 pt-5" />
                    {recent_quotations?.length ? (
                        <Rows
                            rows={recent_quotations.map((qt: any) => ({
                                key: qt.quotation_id,
                                primary: qt.quotation_number,
                                secondary: formatDate(qt.submitted_at),
                                amount: formatMoney(qt.grand_total_minor, qt.currency),
                                status: qt.status
                            }))}
                        />
                    ) : (
                        <EmptyState title="No quotations submitted yet" />
                    )}
                </Card>

                <Card padded={false}>
                    <CardHeader title="Recent purchase orders" className="px-5 pt-5" />
                    {recent_orders?.length ? (
                        <Rows
                            rows={recent_orders.map((po: any) => ({
                                key: po.po_id,
                                primary: po.po_number,
                                secondary: formatDate(po.created_at),
                                amount: formatMoney(po.grand_total_minor, po.currency),
                                status: po.status,
                                href: `/purchase-orders/${po.po_id}`
                            }))}
                        />
                    ) : (
                        <EmptyState title="No purchase orders yet" />
                    )}
                </Card>
            </div>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
    caption
}: {
    icon: typeof FileText;
    label: string;
    value: string | number;
    caption?: string;
}) {
    return (
        <Card>
            <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
                    <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                    <p className="text-[12px] text-muted">{label}</p>
                    <p className="truncate text-lg font-semibold text-ink">{value}</p>
                </div>
            </div>
            {caption && <p className="mt-2 text-[11px] text-slate-400">{caption}</p>}
        </Card>
    );
}

function Rows({
    rows
}: {
    rows: { key: string; primary: string; secondary: string; amount: string; status: string; href?: string }[];
}) {
    return (
        <ul className="divide-y divide-line">
            {rows.map((r) => {
                const content = (
                    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{r.primary}</p>
                            <p className="text-[11px] text-muted">{r.secondary}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[13px] font-medium text-ink">{r.amount}</span>
                            <StatusPill status={r.status} />
                        </div>
                    </div>
                );
                return (
                    <li key={r.key} className="transition hover:bg-slate-50">
                        {r.href ? <Link href={r.href}>{content}</Link> : content}
                    </li>
                );
            })}
        </ul>
    );
}
