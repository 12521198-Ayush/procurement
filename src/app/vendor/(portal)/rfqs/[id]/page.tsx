'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Award, Clock, Download, Loader2, Lock, Save, Send } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import DocumentPanel from '@/components/procurement/DocumentPanel';
import Timeline from '@/components/procurement/Timeline';
import { P, vendorDownload, vendorPost } from '@/lib/vendor-api';
import { useVendorResource } from '@/lib/vendor-hooks';
import { countdown, formatDate, formatDateTime, formatMoney } from '@/lib/format';

type Line = { rfq_item_id: string; name: string; quantity: number; unit: string; specification?: string; unit_price: string; discount_percent: string; tax_percent: string };

export default function VendorRfqDetailPage({ params }: { params: { id: string } }) {
    const toast = useToast();
    const { data, loading, error, reload } = useVendorResource<any>(P + 'rfqs/detail', { rfq_id: params.id });
    const [lines, setLines] = useState<Line[]>([]);
    const [extras, setExtras] = useState({ shipping_charges: '', other_charges: '' });
    const [meta, setMeta] = useState({ vendor_quotation_number: '', valid_until: '', delivery_days: '', delivery_terms: '', payment_terms: '', warranty: '', remarks: '' });
    const [totals, setTotals] = useState<any>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirm, setConfirm] = useState(false);

    // Seed the form from the saved quotation (draft or the latest submitted version).
    useEffect(() => {
        if (!data) return;
        const saved: Record<string, any> = {};
        (data.quotation_items || []).forEach((i: any) => (saved[i.rfq_item_id] = i));
        setLines(
            data.items.map((i: any) => {
                const s = saved[i.rfq_item_id];
                return {
                    rfq_item_id: i.rfq_item_id, name: i.name, quantity: i.quantity, unit: i.unit, specification: i.specification,
                    unit_price: s ? (s.unit_price_minor / 100).toFixed(2) : '',
                    discount_percent: s && s.discount_minor && s.unit_price_minor ? String(+((s.discount_minor / (s.unit_price_minor * s.quantity)) * 100).toFixed(2)) : '',
                    tax_percent: s && s.unit_price_minor ? String(+((s.tax_minor / Math.max(s.unit_price_minor * s.quantity - (s.discount_minor || 0), 1)) * 100).toFixed(2)) : '18'
                };
            })
        );
        const q = data.quotation;
        if (q) {
            setExtras({ shipping_charges: q.shipping_minor ? (q.shipping_minor / 100).toFixed(2) : '', other_charges: q.other_charges_minor ? (q.other_charges_minor / 100).toFixed(2) : '' });
            setMeta({
                vendor_quotation_number: q.vendor_quotation_number || '', valid_until: q.valid_until ? String(q.valid_until).slice(0, 10) : '',
                delivery_days: q.delivery_days != null ? String(q.delivery_days) : '', delivery_terms: q.delivery_terms || '', payment_terms: q.payment_terms || '',
                warranty: q.warranty || '', remarks: q.remarks || ''
            });
        }
    }, [data]);

    useEffect(() => {
        if (!data?.can_edit || !lines.some((l) => l.unit_price)) return;
        const t = setTimeout(() => {
            vendorPost(P + 'quotations/preview', { rfq_id: params.id, items: payload(lines), ...extras }).then(setTotals).catch(() => undefined);
        }, 400);
        return () => clearTimeout(t);
    }, [lines, extras, data?.can_edit, params.id]);

    async function save(submit: boolean) {
        setBusy(submit ? 'submit' : 'save');
        try {
            const res = await vendorPost(P + (submit ? 'quotations/submit' : 'quotations/save'), {
                rfq_id: params.id, items: payload(lines), ...extras, ...meta, delivery_days: meta.delivery_days ? Number(meta.delivery_days) : null
            });
            toast.success(submit ? `Quotation ${res.quotation_number}${res.version > 1 ? ' v' + res.version : ''} submitted` : 'Draft saved');
            setConfirm(false);
            reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(null);
        }
    }

    if (loading && !data) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    if (error || !data) return <Card><EmptyState title="Could not load this RFQ" hint={error ?? undefined} /></Card>;

    const { rfq, quotation } = data;
    const timer = countdown(rfq.expires_at);
    const isRevision = quotation && quotation.status === 'submitted';

    return (
        <div className="space-y-5">
            <Link href="/vendor/rfqs" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to RFQs</Link>

            <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-semibold text-ink">{rfq.rfq_number}</h1>
                            <StatusPill status={data.stage} />
                        </div>
                        <p className="mt-1 text-[14px] text-slate-700">{rfq.title}</p>
                        {rfq.description && <p className="mt-1 text-[13px] text-muted">{rfq.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-slate-600">
                            <span>Closes {formatDateTime(rfq.expires_at)}</span>
                            <span>Bids open {formatDateTime(rfq.bid_opening_at)}</span>
                            {rfq.delivery_location && <span>Deliver to {rfq.delivery_location}</span>}
                            {rfq.expected_delivery_date && <span>Needed by {formatDate(rfq.expected_delivery_date)}</span>}
                            <span>Revisions {rfq.allow_quotation_revision ? 'allowed until close' : 'not allowed'}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {data.submission_open && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-700"><Clock className="h-3.5 w-3.5" />{timer.text}</span>
                        )}
                        <button type="button" className="btn-ghost h-9" onClick={() => vendorDownload(P + 'rfqs/pdf', { rfq_id: rfq.rfq_id }, `${rfq.rfq_number}.pdf`).catch(() => toast.error('Could not download the PDF'))}>
                            <Download className="h-4 w-4" /> RFQ PDF
                        </button>
                    </div>
                </div>
                {data.stage === 'awarded' && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                        <span className="flex items-center gap-2"><Award className="h-4 w-4" /> Your quotation was selected.</span>
                        {data.purchase_order && <Link href={`/vendor/orders/${data.purchase_order.po_id}`} className="font-medium underline">Open {data.purchase_order.po_number} →</Link>}
                    </div>
                )}
                {!data.submission_open && quotation && quotation.status === 'submitted' && (
                    <p className="mt-4 flex items-center gap-2 rounded-lg bg-violet-50 px-4 py-3 text-[13px] text-violet-800">
                        <Lock className="h-4 w-4" /> Submissions are closed. Your quotation stays sealed until the buyer opens bids{rfq.bids_opened ? ' (bids have been opened and are under evaluation).' : '.'}
                    </p>
                )}
            </Card>

            <Card padded={false}>
                <CardHeader title={data.can_edit ? (isRevision ? 'Revise your quotation' : 'Your prices') : 'Items'} className="px-5 pt-5" />
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead className="border-y border-line bg-slate-50/80">
                            <tr>
                                <th className="th">Item</th>
                                <th className="th text-right">Qty</th>
                                <th className="th text-right">Unit price</th>
                                <th className="th text-right">Discount %</th>
                                <th className="th text-right">Tax %</th>
                                <th className="th text-right">Line total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {lines.map((l, i) => (
                                <tr key={l.rfq_item_id}>
                                    <td className="td">
                                        <p className="font-medium text-ink">{l.name}</p>
                                        {l.specification && <p className="text-[11px] text-muted">{l.specification}</p>}
                                    </td>
                                    <td className="td text-right">{l.quantity} {l.unit}</td>
                                    {data.can_edit ? (
                                        <>
                                            <td className="td w-36"><input className="input h-9 text-right" inputMode="decimal" value={l.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} placeholder="0.00" aria-label={`Unit price ${l.name}`} /></td>
                                            <td className="td w-24"><input className="input h-9 text-right" inputMode="decimal" value={l.discount_percent} onChange={(e) => update(i, { discount_percent: e.target.value })} placeholder="0" aria-label={`Discount ${l.name}`} /></td>
                                            <td className="td w-24"><input className="input h-9 text-right" inputMode="decimal" value={l.tax_percent} onChange={(e) => update(i, { tax_percent: e.target.value })} aria-label={`Tax ${l.name}`} /></td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="td text-right">{l.unit_price ? formatMoney(Math.round(Number(l.unit_price) * 100)) : '—'}</td>
                                            <td className="td text-right">{l.discount_percent || '—'}</td>
                                            <td className="td text-right">{l.unit_price ? l.tax_percent : '—'}</td>
                                        </>
                                    )}
                                    <td className="td text-right font-medium">{data.can_edit ? (totals?.lines?.[i] ? formatMoney(totals.lines[i].total_minor) : '—') : (data.quotation_items[i] ? formatMoney(data.quotation_items[i].total_minor) : '—')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data.can_edit && (
                    <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
                        <Labelled label="Shipping charges" value={extras.shipping_charges} onChange={(v) => setExtras({ ...extras, shipping_charges: v })} />
                        <Labelled label="Other charges" value={extras.other_charges} onChange={(v) => setExtras({ ...extras, other_charges: v })} />
                        <Labelled label="Your quotation no." value={meta.vendor_quotation_number} onChange={(v) => setMeta({ ...meta, vendor_quotation_number: v })} />
                        <Labelled label="Valid until" type="date" value={meta.valid_until} onChange={(v) => setMeta({ ...meta, valid_until: v })} />
                        <Labelled label="Delivery (days)" value={meta.delivery_days} onChange={(v) => setMeta({ ...meta, delivery_days: v })} />
                        <Labelled label="Delivery terms" value={meta.delivery_terms} onChange={(v) => setMeta({ ...meta, delivery_terms: v })} />
                        <Labelled label="Payment terms" value={meta.payment_terms} onChange={(v) => setMeta({ ...meta, payment_terms: v })} />
                        <Labelled label="Warranty" value={meta.warranty} onChange={(v) => setMeta({ ...meta, warranty: v })} />
                        <div className="sm:col-span-2 lg:col-span-4"><Labelled label="Remarks" value={meta.remarks} onChange={(v) => setMeta({ ...meta, remarks: v })} /></div>
                    </div>
                )}
                {(totals || quotation) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-slate-50 px-5 py-4">
                        <div className="text-[13px] text-muted">
                            {quotation && `${quotation.quotation_number} · ${quotation.status === 'draft' ? 'draft' : 'version ' + (quotation.version || 1)}${quotation.submitted_at ? ' · submitted ' + formatDateTime(quotation.submitted_at) : ''}`}
                        </div>
                        <div className="text-right">
                            <p className="text-[12px] text-muted">Grand total (calculated by the server)</p>
                            <p className="text-lg font-semibold text-ink">{formatMoney(data.can_edit && totals ? totals.grand_total_minor : quotation?.grand_total_minor, rfq.currency)}</p>
                        </div>
                    </div>
                )}
                {data.can_edit && (
                    <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
                        {!isRevision && (
                            <button type="button" className="btn-ghost" onClick={() => save(false)} disabled={!!busy}>
                                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
                            </button>
                        )}
                        <button type="button" className="btn-primary" onClick={() => setConfirm(true)} disabled={!!busy || !lines.every((l) => l.unit_price)}>
                            <Send className="h-4 w-4" /> {isRevision ? 'Submit revision' : 'Submit quotation'}
                        </button>
                    </div>
                )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <DocumentPanel client="vendor" entityType="rfq" entityId={rfq.rfq_id} title="RFQ documents from the buyer" canUpload={false} />
                {quotation ? (
                    <DocumentPanel client="vendor" entityType="quotation" entityId={quotation.quotation_id} title="Your quotation documents" hint="Visible to the buyer only after bid opening" canUpload={data.can_edit} canDelete={data.can_edit} />
                ) : (
                    <Card><CardHeader title="Your quotation documents" /><p className="text-[13px] text-muted">Save a draft first, then attach your quotation PDF, technical and commercial documents.</p></Card>
                )}
            </div>

            {rfq.terms_and_conditions && (
                <Card><CardHeader title="Terms and conditions" /><p className="whitespace-pre-wrap text-[13px] text-slate-600">{rfq.terms_and_conditions}</p></Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Revision history" />
                    {data.revisions.length ? (
                        <ul className="divide-y divide-line text-[13px]">
                            {data.revisions.map((r: any) => (
                                <li key={r.version} className="flex items-center justify-between py-2">
                                    <span>Version {r.version} · submitted {formatDateTime(r.submitted_at)}</span>
                                    <span className="text-muted">{formatMoney(r.grand_total_minor, rfq.currency)} · superseded {formatDateTime(r.superseded_at)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[13px] text-muted">No earlier versions.</p>
                    )}
                </Card>
                <Card>
                    <CardHeader title="Timeline" />
                    <Timeline events={data.events} />
                </Card>
            </div>

            <Modal open={confirm} onClose={() => setConfirm(false)} title={isRevision ? 'Submit this revision?' : 'Submit your quotation?'} size="sm"
                description={rfq.allow_quotation_revision ? 'You can revise it until the RFQ closes; every version is kept.' : 'Once submitted it is final and cannot be changed.'}
                footer={<><button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button><button type="button" className="btn-primary" onClick={() => save(true)} disabled={!!busy}>{busy === 'submit' && <Loader2 className="h-4 w-4 animate-spin" />}Submit</button></>}
            >
                <p className="text-[13px] text-slate-600">Grand total: <span className="font-semibold text-ink">{formatMoney(totals?.grand_total_minor, rfq.currency)}</span></p>
            </Modal>
        </div>
    );

    function update(index: number, patch: Partial<Line>) {
        setLines((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    }
}

function payload(lines: Line[]) {
    return lines.map((l) => ({
        rfq_item_id: l.rfq_item_id, name: l.name, quantity: l.quantity, unit: l.unit,
        unit_price: l.unit_price || 0, discount_percent: l.discount_percent || 0, tax_percent: l.tax_percent || 0
    }));
}

function Labelled({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <label className="block">
            <span className="field-label">{label}</span>
            <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}
