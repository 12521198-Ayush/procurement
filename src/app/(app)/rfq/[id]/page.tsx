'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, FolderOpen, Lock, Send, XCircle } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import BidOpeningPanel from '@/components/procurement/BidOpeningPanel';
import DocumentPanel from '@/components/procurement/DocumentPanel';
import QuotationDetailModal from '@/components/procurement/QuotationDetailModal';
import { type TimelineEvent } from '@/components/procurement/Timeline';
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

// Only decision points are shown here; the full event log lives in the procurement file.
const MILESTONE_EVENTS = new Set([
    'RFQ_CREATED',
    'RFQ_PUBLISHED',
    'QUOTATION_SUBMITTED',
    'QUOTATION_REVISED',
    'RFQ_CLOSED',
    'BID_OPENED',
    'VENDOR_SELECTED',
    'RFQ_CANCELLED',
    'PO_CREATED',
    'PO_SENT',
    'PROCUREMENT_COMPLETED'
]);

export default function RfqDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { can } = useAuth();
    const toast = useToast();
    const { data, loading, error, reload } = useResource<any>('/procurement/rfq/detail', { rfq_id: id });
    const timeline = useResource<{ array: TimelineEvent[] }>('/procurement/lifecycle/events', { rfq_id: id });
    const [busy, setBusy] = useState(false);
    const [viewing, setViewing] = useState<string | null>(null);

    async function act(endpoint: string, successMessage: string, extra: Record<string, unknown> = {}) {
        setBusy(true);
        try {
            await post(endpoint, { rfq_id: id, ...extra });
            toast.success(successMessage);
            reload();
            timeline.reload();
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
    const sealed = !!data.bid?.sealed;
    const isOpenForBids = ['sent', 'open', 'partially_responded', 'quotation_received'].includes(data.status) && !data.is_expired;
    const canViewQuotes = responded > 0 && !sealed && can('QUOTATION_VIEW');
    const compareHref = can('QUOTATION_COMPARE') ? `/quotations/compare/${data.rfq_id}` : undefined;
    const milestones = (timeline.data?.array || []).filter((e) => MILESTONE_EVENTS.has(e.event_type));

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
                            <span>Bids open: {formatDateTime(data.bid?.opening_at || data.expires_at)}</span>
                            <span>Revisions: {data.allow_quotation_revision ? 'allowed' : 'not allowed'}</span>
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

                        <div className="flex flex-wrap justify-end gap-2">
                            <Link href={`/lifecycle?rfq=${data.rfq_id}`} className="btn-ghost">
                                <FolderOpen className="h-4 w-4" />
                                Procurement file
                            </Link>
                            {sealed && isOpenForBids && can('RFQ_EDIT') && (
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    disabled={busy}
                                    onClick={() =>
                                        act(
                                            '/procurement/rfq/revision-policy',
                                            data.allow_quotation_revision ? 'Revisions disabled' : 'Vendors may now revise their quotations',
                                            { allow: !data.allow_quotation_revision }
                                        )
                                    }
                                >
                                    {data.allow_quotation_revision ? 'Stop revisions' : 'Allow revisions'}
                                </button>
                            )}
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
                            {responded > 0 && !sealed && can('QUOTATION_COMPARE') && (
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

            {!['draft', 'cancelled'].includes(data.status) && <BidOpeningPanel rfqId={data.rfq_id} onOpened={() => { reload(); timeline.reload(); }} />}

            <div className="grid gap-4 lg:grid-cols-3">
                <Card padded={false} className="lg:col-span-2">
                    <CardHeader
                        title={`Vendor quotations (${responded}/${data.vendors.length} responded)`}
                        className="px-5 pt-5"
                        action={canViewQuotes && compareHref && responded > 1 ? <Link href={compareHref} className="btn-ghost h-8">Compare</Link> : undefined}
                    />
                    {data.vendors.length ? (
                        <ul className="divide-y divide-line">
                            {data.vendors.map((v: any) => {
                                const clickable = canViewQuotes && v.has_responded && v.quotation_id;
                                const row = (
                                    <>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium text-ink">{v.company_name}</p>
                                            <p className="truncate text-[11px] text-muted">
                                                {v.has_responded
                                                    ? `Quoted${v.revision_count > 0 ? ` · revised ${v.revision_count}x` : ''}`
                                                    : v.invited_at
                                                      ? `Invited ${formatDate(v.invited_at)}${v.last_opened_at ? ' · viewed' : ' · not yet viewed'}`
                                                      : 'Not yet invited'}
                                            </p>
                                        </div>
                                        {v.has_responded ? (
                                            sealed ? (
                                                <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-violet-700">
                                                    <Lock className="h-3.5 w-3.5" /> Sealed
                                                </span>
                                            ) : (
                                                <span className="shrink-0 text-[14px] font-semibold text-emerald-700">{formatMoney(v.grand_total_minor)}</span>
                                            )
                                        ) : (
                                            <StatusPill status={v.invited_at ? 'pending' : 'draft'} />
                                        )}
                                        {clickable && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                                    </>
                                );
                                return (
                                    <li key={v.rfq_vendor_id}>
                                        {clickable ? (
                                            <button
                                                type="button"
                                                onClick={() => setViewing(v.quotation_id)}
                                                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"
                                            >
                                                {row}
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-3 px-5 py-3.5">{row}</div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <EmptyState title="No vendors selected" />
                    )}
                </Card>

                <Card padded={false}>
                    <CardHeader
                        title="Key milestones"
                        className="px-5 pt-5"
                        action={
                            <Link href={`/lifecycle?rfq=${data.rfq_id}`} className="text-[12px] font-medium text-brand-700 hover:underline">
                                Full history
                            </Link>
                        }
                    />
                    {timeline.loading ? (
                        <div className="m-5 h-24 animate-pulse rounded-lg bg-slate-100" />
                    ) : milestones.length ? (
                        <ol className="px-5 pb-5">
                            {milestones.map((e, i) => (
                                <li key={e.event_id} className="relative flex gap-3 pb-4 last:pb-0">
                                    {i < milestones.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden />}
                                    <span
                                        className={`relative z-[1] mt-1 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white ${
                                            /CANCELLED/.test(e.event_type) ? 'bg-rose-500' : i === milestones.length - 1 ? 'bg-brand-600' : 'bg-slate-300'
                                        }`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-medium text-ink">
                                            {e.label}
                                            {e.vendor_name && <span className="font-normal text-muted"> · {e.vendor_name}</span>}
                                        </p>
                                        <p className="text-[11px] text-muted">
                                            {formatDateTime(e.ts)}
                                            {e.amount_minor != null ? ` · ${formatMoney(e.amount_minor, e.currency || 'INR')}` : ''}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <EmptyState title="No activity yet" />
                    )}
                </Card>
            </div>

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
                    {data.terms_and_conditions && (
                        <details className="border-t border-line px-5 py-3 text-[13px]">
                            <summary className="cursor-pointer select-none font-medium text-slate-700">Terms and conditions</summary>
                            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-600">{data.terms_and_conditions}</p>
                        </details>
                    )}
                </Card>

                <DocumentPanel
                    entityType="rfq"
                    entityId={data.rfq_id}
                    title="RFQ documents"
                    hint="Shared with invited vendors"
                    canUpload={can('RFQ_EDIT') && can('DOCUMENT_UPLOAD') && !['cancelled', 'completed'].includes(data.status)}
                    canDelete={can('DOCUMENT_DELETE') && data.status === 'draft'}
                />
            </div>

            <QuotationDetailModal quotationId={viewing} compareHref={compareHref} onClose={() => setViewing(null)} />
        </div>
    );
}
