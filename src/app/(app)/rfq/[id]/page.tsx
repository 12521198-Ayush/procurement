'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Mail, Send, Users, XCircle } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/hooks';
import { countdown, formatDate, formatDateTime, formatMoney } from '@/lib/format';

const LIFECYCLE = ['draft', 'sent', 'quotation_received', 'vendor_selected', 'completed'];
const LIFECYCLE_LABELS: Record<string, string> = {
    draft: 'RFQ Created',
    sent: 'Sent to vendors',
    quotation_received: 'Quotations received',
    vendor_selected: 'Vendor selected',
    completed: 'Completed'
};

export default function RfqDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { can } = useAuth();
    const toast = useToast();
    const { data, loading, error, reload } = useResource<any>('/procurement/rfq/detail', { rfq_id: id });
    const [busy, setBusy] = useState(false);

    async function act(endpoint: string, successMessage: string) {
        setBusy(true);
        try {
            await post(endpoint, { rfq_id: id });
            toast.success(successMessage);
            reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    if (error || !data) {
        return (
            <Card>
                <EmptyState title="Could not load this RFQ" hint={error ?? undefined} />
            </Card>
        );
    }

    const timer = countdown(data.expires_at);
    const responded = data.vendors.filter((v: any) => v.has_responded).length;
    const stageIndex = Math.max(LIFECYCLE.indexOf(data.status), data.status === 'partially_responded' ? 1 : 0);

    return (
        <div className="space-y-5">
            <Link href="/rfq" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
                <ArrowLeft className="h-4 w-4" />
                Back to RFQs
            </Link>

            <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-semibold text-ink">{data.rfq_number}</h1>
                            <StatusPill status={data.status} />
                            {data.is_expired && <StatusPill status="expired" />}
                        </div>
                        <p className="mt-1 text-[14px] text-slate-700">{data.title}</p>
                        {data.description && <p className="mt-1 text-[13px] text-muted">{data.description}</p>}

                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px] text-slate-600">
                            {data.department_name && <span>Department: {data.department_name}</span>}
                            {data.category_name && <span>Category: {data.category_name}</span>}
                            {data.delivery_location && <span>Deliver to: {data.delivery_location}</span>}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                            <p className="text-[11px] uppercase tracking-wide text-muted">Closes</p>
                            <p className="text-[13px] font-medium text-ink">{formatDateTime(data.expires_at)}</p>
                            <p className={timer.expired ? 'text-[12px] font-medium text-rose-600' : 'text-[12px] font-medium text-amber-600'}>
                                {timer.text}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            {data.status === 'draft' && can('RFQ_SEND') && (
                                <button
                                    type="button"
                                    className="btn-primary"
                                    disabled={busy}
                                    onClick={() => act('/procurement/rfq/send', 'RFQ sent to vendors')}
                                >
                                    <Send className="h-4 w-4" />
                                    Send to vendors
                                </button>
                            )}
                            {responded > 0 && can('QUOTATION_COMPARE') && (
                                <Link href={`/quotations/compare/${data.rfq_id}`} className="btn-primary">
                                    Compare {responded} quotation{responded > 1 ? 's' : ''}
                                </Link>
                            )}
                            {['completed', 'cancelled'].indexOf(data.status) === -1 && can('RFQ_CANCEL') && (
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    disabled={busy}
                                    onClick={() => act('/procurement/rfq/cancel', 'RFQ cancelled and links revoked')}
                                >
                                    <XCircle className="h-4 w-4" />
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <ol className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
                    {LIFECYCLE.map((stage, index) => {
                        const reached = index <= stageIndex && data.status !== 'cancelled';
                        return (
                            <li key={stage} className="flex items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${
                                        reached ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'
                                    }`}
                                >
                                    {reached ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                                    {LIFECYCLE_LABELS[stage]}
                                </span>
                                {index < LIFECYCLE.length - 1 && <span className="h-px w-5 bg-line" />}
                            </li>
                        );
                    })}
                </ol>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card padded={false} className="lg:col-span-2">
                    <CardHeader title={`Items (${data.items.length})`} className="px-5 pt-5" />
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-y border-line bg-slate-50/80">
                                <tr>
                                    <th className="th">#</th>
                                    <th className="th">Item</th>
                                    <th className="th">Specification</th>
                                    <th className="th text-right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {data.items.map((item: any) => (
                                    <tr key={item.rfq_item_id}>
                                        <td className="td text-muted">{item.line_no}</td>
                                        <td className="td font-medium text-ink">{item.name}</td>
                                        <td className="td text-muted">{item.specification || '—'}</td>
                                        <td className="td text-right">
                                            {item.quantity} {item.unit}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card padded={false}>
                    <CardHeader title={`Vendors (${responded}/${data.vendors.length} responded)`} className="px-5 pt-5" />
                    {data.vendors.length ? (
                        <ul className="divide-y divide-line">
                            {data.vendors.map((v: any) => (
                                <li key={v.rfq_vendor_id} className="px-5 py-3.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-[13px] font-medium text-ink">{v.company_name}</p>
                                            <p className="truncate text-[11px] text-muted">{v.email}</p>
                                        </div>
                                        {v.has_responded ? (
                                            <span className="shrink-0 text-[12px] font-medium text-emerald-700">
                                                {formatMoney(v.grand_total_minor)}
                                            </span>
                                        ) : (
                                            <StatusPill status={v.invited_at ? 'pending' : 'draft'} />
                                        )}
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        {v.invited_at ? `Invited ${formatDate(v.invited_at)}` : 'Not yet invited'}
                                        {v.last_opened_at && ` · opened ${formatDate(v.last_opened_at)}`}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState title="No vendors selected" />
                    )}
                </Card>
            </div>

            {data.terms_and_conditions && (
                <Card>
                    <CardHeader title="Terms and conditions" />
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">
                        {data.terms_and_conditions}
                    </p>
                </Card>
            )}
        </div>
    );
}
