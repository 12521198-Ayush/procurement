'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, FileText, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatBytes, humanize } from '@/lib/files';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

type Detail = {
    quotation: any;
    items: any[];
    vendor: any;
    documents: any[];
    revisions: { version: number; grand_total_minor: number; currency: string; submitted_at: string }[];
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-0.5 text-[13px] font-medium text-ink">{value || '—'}</p>
        </div>
    );
}

/** What one vendor quoted: the headline numbers, terms, line items and attachments. */
export default function QuotationDetailModal({
    quotationId,
    compareHref,
    onClose
}: {
    quotationId: string | null;
    compareHref?: string;
    onClose: () => void;
}) {
    const toast = useToast();
    const { data, loading, error } = useResource<Detail>(quotationId ? '/procurement/quotations/detail' : null, { quotation_id: quotationId });
    const [opening, setOpening] = useState<string | null>(null);

    async function openDocument(documentId: string) {
        setOpening(documentId);
        try {
            const res = await post<{ url: string }>('/procurement/documents/download', { document_id: documentId, inline: true });
            window.open(res.url, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setOpening(null);
        }
    }

    if (!quotationId) return null;
    const qt = data?.quotation;

    return (
        <Modal
            open
            onClose={onClose}
            size="lg"
            title={qt ? `${qt.vendor_name}` : 'Quotation'}
            description={qt ? `${qt.quotation_number}${qt.vendor_quotation_number ? ' · Vendor ref ' + qt.vendor_quotation_number : ''} · submitted ${formatDateTime(qt.submitted_at)}` : undefined}
            footer={
                <>
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        Close
                    </button>
                    {compareHref && (
                        <Link href={compareHref} className="btn-primary">
                            Compare quotations
                        </Link>
                    )}
                </>
            }
        >
            {loading && <div className="h-40 animate-pulse rounded-lg bg-slate-100" />}
            {!loading && (error || !data) && <EmptyState title="Could not load this quotation" hint={error ?? undefined} />}
            {!loading && data && qt && (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted">Grand total</p>
                            <p className="text-xl font-semibold text-ink">{formatMoney(qt.grand_total_minor, qt.currency)}</p>
                            <p className="text-[11px] text-muted">
                                Subtotal {formatMoney(qt.subtotal_minor, qt.currency)}
                                {qt.discount_minor > 0 && ` · Discount −${formatMoney(qt.discount_minor, qt.currency)}`}
                                {qt.tax_minor > 0 && ` · Tax ${formatMoney(qt.tax_minor, qt.currency)}`}
                                {qt.shipping_minor > 0 && ` · Shipping ${formatMoney(qt.shipping_minor, qt.currency)}`}
                                {qt.other_charges_minor > 0 && ` · Other ${formatMoney(qt.other_charges_minor, qt.currency)}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusPill status={qt.status} />
                            {qt.revision_count > 0 && <span className="text-[11px] text-muted">v{qt.version} · revised {qt.revision_count}x</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Fact label="Delivery" value={qt.delivery_days != null ? `${qt.delivery_days} days` : qt.delivery_terms} />
                        <Fact label="Payment terms" value={qt.payment_terms} />
                        <Fact label="Warranty" value={qt.warranty} />
                        <Fact label="Valid until" value={qt.valid_until ? formatDate(qt.valid_until) : null} />
                    </div>

                    {data.vendor && (data.vendor.contact_person || data.vendor.email || data.vendor.phone) && (
                        <p className="text-[12px] text-muted">
                            Contact: {[data.vendor.contact_person, data.vendor.email, data.vendor.phone].filter(Boolean).join(' · ')}
                        </p>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-line">
                        <table className="w-full">
                            <thead className="border-b border-line bg-slate-50/80">
                                <tr>
                                    <th className="th">Item</th>
                                    <th className="th text-right">Qty</th>
                                    <th className="th text-right">Unit price</th>
                                    <th className="th text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {data.items.map((line) => (
                                    <tr key={line.quotation_item_id}>
                                        <td className="td">
                                            <p className="font-medium text-ink">{line.name}</p>
                                            {line.description && <p className="text-[11px] text-muted">{line.description}</p>}
                                        </td>
                                        <td className="td text-right">
                                            {line.quantity} {line.unit}
                                        </td>
                                        <td className="td text-right">{formatMoney(line.unit_price_minor, line.currency)}</td>
                                        <td className="td text-right font-medium text-ink">{formatMoney(line.total_minor, line.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {qt.remarks && (
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted">Vendor remarks</p>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-700">{qt.remarks}</p>
                        </div>
                    )}

                    {data.documents.length > 0 && (
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted">Attachments ({data.documents.length})</p>
                            <ul className="mt-1.5 divide-y divide-line rounded-xl border border-line">
                                {data.documents.map((doc) => (
                                    <li key={doc.document_id} className="flex items-center gap-3 px-3 py-2">
                                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium text-ink">{doc.original_filename}</p>
                                            <p className="text-[11px] text-muted">
                                                {humanize(doc.category)} · {formatBytes(doc.size_bytes)}
                                                {doc.note ? ` · ${doc.note}` : ''}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-ghost h-8 px-2"
                                            disabled={opening === doc.document_id}
                                            onClick={() => openDocument(doc.document_id)}
                                            aria-label={`Open ${doc.original_filename}`}
                                        >
                                            {opening === doc.document_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {data.revisions.length > 0 && (
                        <details className="text-[12px] text-muted">
                            <summary className="cursor-pointer select-none font-medium text-slate-600">Earlier versions ({data.revisions.length})</summary>
                            <ul className="mt-1.5 space-y-1 pl-4">
                                {data.revisions.map((r) => (
                                    <li key={r.version}>
                                        v{r.version} · {formatMoney(r.grand_total_minor, r.currency)} · {formatDateTime(r.submitted_at)}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </Modal>
    );
}
