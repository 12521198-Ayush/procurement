'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import BidOpeningPanel from '@/components/procurement/BidOpeningPanel';
import Timeline from '@/components/procurement/Timeline';
import { LifecycleStepper, RelatedDocuments } from '@/components/procurement/Lifecycle';
import { post } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { humanize } from '@/lib/files';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';

const KEYS = ['po', 'rfq', 'quotation_id', 'proforma_id', 'payment_id', 'receipt_id', 'dispatch_id', 'grn_id', 'tax_invoice_id'] as const;

/**
 * The procurement file: one place to understand a whole transaction from RFQ to
 * ledger - opened from any document in the chain.
 */
export default function ProcurementFilePage({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
    const toast = useToast();
    const body: Record<string, string> = {};
    KEYS.forEach((k) => {
        const v = searchParams?.[k];
        if (v) body[k === 'po' ? 'po_id' : k === 'rfq' ? 'rfq_id' : k] = v;
    });
    const { data, loading, error, reload } = useResource<any>(Object.keys(body).length ? '/procurement/lifecycle/detail' : null, body);
    const [tab, setTab] = useState('overview');

    if (!Object.keys(body).length) return <Card><EmptyState title="Open a procurement file from an RFQ, PO or any related document." /></Card>;
    if (loading) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    if (error || !data) return <Card><EmptyState title="Could not load this procurement" hint={error ?? undefined} /></Card>;

    const { rfq, purchase_order: po, financial } = data;

    async function openDoc(id: string) {
        try {
            const res = await post<{ url: string }>('/procurement/documents/download', { document_id: id, inline: true });
            window.open(res.url, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const tabs = [
        { value: 'overview', label: 'Overview' },
        { value: 'documents', label: 'Documents', count: data.documents.length },
        { value: 'timeline', label: 'Timeline', count: data.events.length },
        { value: 'related', label: 'Related records', count: data.related.length },
        { value: 'financial', label: 'Financial' },
        { value: 'delivery', label: 'Delivery' }
    ];

    return (
        <div className="space-y-5">
            <Link href={po ? `/purchase-orders/${po.po_id}` : rfq ? `/rfq/${rfq.rfq_id}` : '/dashboard'} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
                <ArrowLeft className="h-4 w-4" /> Back
            </Link>

            <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[12px] font-medium uppercase tracking-wide text-muted">Procurement file</p>
                        <h1 className="text-lg font-semibold text-ink">
                            {rfq ? `${rfq.rfq_number} · ${rfq.title}` : po?.po_number}
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                            {rfq && <StatusPill status={rfq.status} />}
                            {po && (
                                <>
                                    <span>{po.po_number}</span>
                                    <StatusPill status={po.status} />
                                    <span>{po.vendor_name}</span>
                                </>
                            )}
                        </p>
                    </div>
                    {financial && (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-[13px] sm:grid-cols-4">
                            <Fig label="Order value" value={formatMoney(financial.order_value_minor, financial.currency)} />
                            <Fig label="PI billed" value={formatMoney(financial.pi_billed_minor, financial.currency)} />
                            <Fig label="Paid" value={formatMoney(financial.paid_minor, financial.currency)} />
                            <Fig label="Outstanding" value={formatMoney(financial.outstanding_minor, financial.currency)} />
                        </div>
                    )}
                </div>
                <div className="mt-5 border-t border-line pt-5">
                    <LifecycleStepper stages={data.stages} />
                </div>
            </Card>

            {rfq && rfq.bid?.sealed && !['draft', 'cancelled'].includes(rfq.status) && <BidOpeningPanel rfqId={rfq.rfq_id} onOpened={reload} />}

            <Tabs tabs={tabs} active={tab} onChange={setTab} />

            {tab === 'overview' && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader title="RFQ & quotations" />
                        {rfq ? (
                            <div className="space-y-3 text-[13px]">
                                <p className="text-slate-600">
                                    Sent {formatDate(rfq.sent_at)} · closes {formatDateTime(rfq.expires_at)} · bids open {formatDateTime(rfq.bid?.opening_at)}
                                    {rfq.bid_opened_at && ` · opened ${formatDateTime(rfq.bid_opened_at)} by ${rfq.bid_opened_by_name || 'user'}`}
                                </p>
                                <ul className="divide-y divide-line rounded-lg border border-line">
                                    {data.quotations.map((x: any) => (
                                        <li key={x.quotation_id} className="flex items-center justify-between px-3 py-2">
                                            <span>
                                                {x.vendor_name} <span className="text-muted">· {x.quotation_number}{x.version > 1 ? ` v${x.version}` : ''}</span>
                                            </span>
                                            <span className="flex items-center gap-2">
                                                {x.sealed ? (
                                                    <span className="inline-flex items-center gap-1 text-violet-700"><Lock className="h-3.5 w-3.5" /> Sealed</span>
                                                ) : (
                                                    formatMoney(x.grand_total_minor, x.currency)
                                                )}
                                                <StatusPill status={x.status} />
                                            </span>
                                        </li>
                                    ))}
                                    {!data.quotations.length && <li className="px-3 py-2 text-muted">No quotations yet.</li>}
                                </ul>
                            </div>
                        ) : (
                            <p className="text-[13px] text-muted">This purchase order was not raised from an RFQ.</p>
                        )}
                    </Card>
                    <Card>
                        <CardHeader title="Latest activity" />
                        <Timeline events={data.events.slice(-6).reverse()} />
                    </Card>
                </div>
            )}

            {tab === 'documents' && (
                <Card padded={false}>
                    <CardHeader title="Every document in this procurement" className="px-5 pt-5" />
                    {data.documents.length ? (
                        <table className="w-full">
                            <thead className="border-y border-line bg-slate-50/80">
                                <tr>
                                    <th className="th">Document</th>
                                    <th className="th">Stage</th>
                                    <th className="th">Type</th>
                                    <th className="th">Uploaded by</th>
                                    <th className="th">When</th>
                                    <th className="th" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {data.documents.map((d: any) => (
                                    <tr key={d.document_id}>
                                        <td className="td font-medium text-ink">
                                            {d.original_filename}
                                            {d.version > 1 && <span className="ml-1.5 text-[11px] text-violet-700">v{d.version}</span>}
                                        </td>
                                        <td className="td">{humanize(d.entity_type)}</td>
                                        <td className="td">{humanize(d.category)}</td>
                                        <td className="td">{d.uploaded_by_name}{d.uploaded_by_type === 'vendor' ? ' (vendor)' : ''}</td>
                                        <td className="td">{formatDateTime(d.uploaded_at)}</td>
                                        <td className="td text-right">
                                            <button type="button" className="text-[13px] font-medium text-brand-600 hover:underline" onClick={() => openDoc(d.document_id)}>
                                                {d.previewable ? 'Preview' : 'Download'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <EmptyState title="No documents yet" />
                    )}
                </Card>
            )}

            {tab === 'timeline' && (
                <Card>
                    <CardHeader title="Complete history" />
                    <Timeline events={data.events} />
                </Card>
            )}

            {tab === 'related' && (
                <Card>
                    <CardHeader title="Related records" />
                    <RelatedDocuments related={data.related} />
                </Card>
            )}

            {tab === 'financial' && (
                <div className="grid gap-4 lg:grid-cols-3">
                    <ListCard title="Proforma invoices" rows={data.proforma_invoices} render={(p: any) => [p.proforma_number, formatMoney(p.grand_total_minor ?? p.amount_minor, p.currency), p.status, `/proforma-invoices?id=${p.proforma_id}`]} />
                    <ListCard title="Payments" rows={data.payments} render={(p: any) => [`${p.payment_number}${p.proforma_number ? ' · ' + p.proforma_number : ''}`, formatMoney(p.amount_minor, p.currency), p.status, `/purchase-orders/${p.po_id}?tab=financial`]} />
                    <ListCard title="Receipts & invoices" rows={[...data.payment_receipts.map((r: any) => ({ ...r, _k: 'r' })), ...data.tax_invoices.map((t: any) => ({ ...t, _k: 't' }))]}
                        render={(r: any) => r._k === 'r'
                            ? [`Receipt ${r.receipt_number}`, formatMoney(r.amount_minor, r.currency), r.status, `/purchase-orders/${r.po_id}?tab=financial`]
                            : [`Invoice ${r.invoice_number || '(requested)'}`, formatMoney(r.amount_minor, r.currency), r.status, `/tax-invoices?id=${r.tax_invoice_id}`]}
                    />
                    {po && (
                        <Card className="lg:col-span-3">
                            <Link href={`/vendor-ledger?vendor=${po.vendor_id}&po=${po.po_id}`} className="text-[13px] font-medium text-brand-600">Open the vendor ledger for {po.vendor_name} →</Link>
                        </Card>
                    )}
                </div>
            )}

            {tab === 'delivery' && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <ListCard title="Dispatches (DC / packing list / LR)" rows={data.dispatches} render={(d: any) => [`${d.dispatch_number}${d.lr_number ? ' · LR ' + d.lr_number : ''}`, formatDate(d.dispatch_date), d.status, `/receiving?dispatch=${d.dispatch_id}`]} />
                    <ListCard title="Goods receipts" rows={data.goods_receipts} render={(g: any) => [g.grn_number, formatDate(g.grn_date || g.received_at), g.status || 'posted', `/receiving?grn=${g.grn_id}`]} />
                    {data.purchase_order_items?.length > 0 && (
                        <Card padded={false} className="lg:col-span-2">
                            <CardHeader title="Quantities" className="px-5 pt-5" />
                            <table className="w-full">
                                <thead className="border-y border-line bg-slate-50/80">
                                    <tr>
                                        <th className="th">Item</th>
                                        <th className="th text-right">Ordered</th>
                                        <th className="th text-right">Dispatched</th>
                                        <th className="th text-right">Received</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {data.purchase_order_items.map((i: any) => (
                                        <tr key={i.po_item_id}>
                                            <td className="td">{i.name}</td>
                                            <td className="td text-right">{i.quantity} {i.unit}</td>
                                            <td className="td text-right">{i.dispatched_quantity || 0}</td>
                                            <td className="td text-right">{i.received_quantity || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

function Fig({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[11px] text-muted">{label}</p>
            <p className="font-semibold text-ink">{value}</p>
        </div>
    );
}

function ListCard({ title, rows, render }: { title: string; rows: any[]; render: (r: any) => [string, string, string, string] }) {
    return (
        <Card padded={false}>
            <CardHeader title={title} className="px-5 pt-5" />
            {rows.length ? (
                <ul className="divide-y divide-line">
                    {rows.map((r, i) => {
                        const [label, value, status, href] = render(r);
                        return (
                            <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                                <Link href={href} className="min-w-0 truncate font-medium text-brand-700 hover:underline">{label}</Link>
                                <span className="flex shrink-0 items-center gap-2">{value}<StatusPill status={status} /></span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <EmptyState title="None yet" />
            )}
        </Card>
    );
}
