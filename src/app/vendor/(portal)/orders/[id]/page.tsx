'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, FilePlus2, Loader2, Receipt, Send, Truck, X } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import DocumentPanel from '@/components/procurement/DocumentPanel';
import Timeline from '@/components/procurement/Timeline';
import { NextStepCard, type NextStep } from '@/components/procurement/Lifecycle';
import { P, vendorDownload, vendorPost } from '@/lib/vendor-api';
import { useVendorResource } from '@/lib/vendor-hooks';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

type Selected = { type: 'proforma_invoice' | 'dispatch' | 'tax_invoice' | 'payment_receipt'; id: string } | null;

const TAB_FOR: Record<NonNullable<Selected>['type'], string> = { proforma_invoice: 'pi', dispatch: 'dispatch', tax_invoice: 'invoice', payment_receipt: 'payments' };

/** The vendor's next action on this order (or what they are waiting on). */
function vendorNextStep(data: any): NextStep {
    const po = data.purchase_order;
    const a = data.actions;
    const href = `/vendor/orders/${po.po_id}`;
    const s = (stage: string | null, actor: NextStep['actor'], title: string, description: string | null, cta: string | null = null, action: string | null = null): NextStep =>
        ({ stage, actor, title, description, cta, href: cta ? href : null, action });

    if (po.status === 'cancelled') return s('po', null, 'Order cancelled', po.cancel_reason || 'Nothing further to do on this order.');
    if (po.status === 'vendor_rejected') return s('po', null, 'You rejected this order', po.vendor_remarks || null);
    if (a.can_respond) return s('po', 'vendor', 'Accept or reject this purchase order', 'Check the items, delivery address and payment terms, then respond.', 'Accept order', 'accept');

    const draftPi = data.proforma_invoices.find((p: any) => ['draft', 'rejected'].includes(p.status));
    if (draftPi) {
        return s('pi', 'vendor', `${draftPi.status === 'rejected' ? 'Revise and resubmit' : 'Submit'} proforma invoice ${draftPi.proforma_number}`,
            draftPi.review_remarks ? `Buyer: ${draftPi.review_remarks}` : 'Attach the signed PI, then submit it for review.', 'Open proforma', `open:proforma_invoice:${draftPi.proforma_id}`);
    }
    const draftDispatch = data.dispatches.find((d: any) => d.status === 'draft');
    if (draftDispatch) {
        return s('dispatch', 'vendor', `Submit dispatch ${draftDispatch.dispatch_number}`, 'Upload the delivery challan (and LR / packing list), then submit to mark the goods as dispatched.',
            'Open dispatch', `open:dispatch:${draftDispatch.dispatch_id}`);
    }
    if (a.can_dispatch) return s('dispatch', 'vendor', 'Dispatch the goods', 'Enter the quantities shipped and transport details, upload the delivery challan and submit.', 'Mark as dispatched', 'dispatch');

    const inv = data.tax_invoices.find((t: any) => ['requested', 'draft', 'rejected'].includes(t.status));
    if (inv) {
        return s('invoice', 'vendor', inv.status === 'rejected' ? 'Correct and resubmit your tax invoice' : 'Upload your tax invoice',
            inv.review_remarks ? `Buyer: ${inv.review_remarks}` : 'Fill in the invoice details, attach the invoice PDF and submit.', 'Open invoice', `open:tax_invoice:${inv.tax_invoice_id}`);
    }
    const receipt = data.payment_receipts.find((r: any) => r.status === 'issued');
    if (receipt) return s('receipt', 'vendor', `Acknowledge payment receipt ${receipt.receipt_number}`, `${formatMoney(receipt.amount_minor, receipt.currency)} was paid to you.`, 'Open receipt', `open:payment_receipt:${receipt.receipt_id}`);

    const reviewing = data.proforma_invoices.find((p: any) => ['submitted', 'under_review'].includes(p.status));
    if (reviewing) return s('pi', 'buyer', `Buyer is reviewing ${reviewing.proforma_number}`, 'You will be notified when it is approved or rejected.');
    const inTransit = data.dispatches.find((d: any) => ['dispatched', 'partially_received'].includes(d.status));
    if (inTransit) return s('grn', 'buyer', `Waiting for the buyer to receive ${inTransit.dispatch_number}`, 'A goods receipt (GRN) is posted once the delivery is checked.');
    if (po.remaining_minor > 0) return s('payment', 'buyer', 'Waiting for payment', `${formatMoney(po.remaining_minor, po.currency)} outstanding on this order.`);
    if (data.tax_invoices.some((t: any) => t.status === 'received')) return s('invoice', 'buyer', 'Buyer is verifying your tax invoice', 'You will be notified when it is approved or rejected.');
    if (a.can_invoice) return s('invoice', 'vendor', 'Raise your tax invoice', 'The order is paid; submit the GST tax invoice to close it.', 'Raise invoice', 'invoice');
    return s(null, null, 'Nothing pending', 'Every step on this order is complete.');
}

export default function VendorOrderPage({ params }: { params: { id: string } }) {
    const toast = useToast();
    const { data, loading, error, reload } = useVendorResource<any>(P + 'orders/detail', { po_id: params.id });
    const [tab, setTab] = useState('items');
    const [busy, setBusy] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [form, setForm] = useState<null | 'pi' | 'dispatch' | 'invoice'>(null);
    const [editInvoice, setEditInvoice] = useState<any>(null);
    const [selected, setSelected] = useState<Selected>(null);

    async function run(path: string, body: Record<string, unknown>, message: string) {
        setBusy(true);
        try {
            const res = await vendorPost(P + path, body);
            toast.success(message);
            reload();
            return res;
        } catch (err: any) {
            toast.error(err.message);
            return null;
        } finally {
            setBusy(false);
        }
    }

    if (loading && !data) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    if (error || !data) return <Card><EmptyState title="Could not load this purchase order" hint={error ?? undefined} /></Card>;

    const po = data.purchase_order;
    const a = data.actions;
    const tabs = [
        { value: 'items', label: 'Items' },
        { value: 'pi', label: 'Proforma invoices', count: data.proforma_invoices.length },
        { value: 'dispatch', label: 'Dispatches', count: data.dispatches.length },
        { value: 'grn', label: 'Goods receipts', count: data.goods_receipts.length },
        { value: 'invoice', label: 'Invoices', count: data.tax_invoices.length },
        { value: 'payments', label: 'Payments', count: data.payments.length },
        { value: 'documents', label: 'Documents', count: data.documents.length },
        { value: 'timeline', label: 'Timeline' }
    ];

    const sel = selected && findSelected(data, selected);

    function runNextStep(step: NextStep) {
        const action = step.action || '';
        if (action === 'accept') return void run('orders/respond', { po_id: po.po_id, action: 'accept' }, 'Purchase order accepted');
        if (action === 'dispatch') return setForm('dispatch');
        if (action === 'invoice') return setForm('invoice');
        if (action.startsWith('open:')) {
            const [, type, id] = action.split(':') as [string, NonNullable<Selected>['type'], string];
            setTab(TAB_FOR[type]);
            setSelected({ type, id });
        }
    }

    return (
        <div className="space-y-5">
            <Link href="/vendor/orders" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to purchase orders</Link>

            <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-semibold text-ink">{po.po_number}</h1>
                            <StatusPill status={po.status === 'acknowledged' ? 'accepted' : po.status} />
                        </div>
                        <p className="mt-1 text-[13px] text-muted">
                            {po.rfq_number ? `${po.rfq_number} · ` : ''}issued {formatDate(po.sent_at)} · deliver by {formatDate(po.expected_delivery_date)}
                        </p>
                        <p className="mt-1 text-[13px] text-slate-600">Deliver to: {po.delivery_address || '—'} · Payment terms: {po.payment_terms || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-ghost" onClick={() => vendorDownload(P + 'orders/pdf', { po_id: po.po_id }, `${po.po_number}.pdf`).catch(() => toast.error('Could not download the PDF'))}>
                            <Download className="h-4 w-4" /> PO PDF
                        </button>
                        {a.can_respond && (
                            <>
                                <button type="button" className="btn-ghost text-rose-600" onClick={() => setRejecting(true)} disabled={busy}><X className="h-4 w-4" /> Reject</button>
                                <button type="button" className="btn-primary" onClick={() => run('orders/respond', { po_id: po.po_id, action: 'accept' }, 'Purchase order accepted')} disabled={busy}><Check className="h-4 w-4" /> Accept order</button>
                            </>
                        )}
                        {a.can_raise_pi && <button type="button" className="btn-ghost" onClick={() => setForm('pi')}><FilePlus2 className="h-4 w-4" /> Proforma invoice</button>}
                        {a.can_dispatch && <button type="button" className="btn-ghost" onClick={() => setForm('dispatch')}><Truck className="h-4 w-4" /> Dispatch goods</button>}
                        {a.can_invoice && <button type="button" className="btn-ghost" onClick={() => setForm('invoice')}><Receipt className="h-4 w-4" /> Tax invoice</button>}
                    </div>
                </div>
                <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-4">
                    <Fig label="Order value" value={formatMoney(po.grand_total_minor, po.currency)} />
                    <Fig label="Paid to you" value={formatMoney(po.paid_minor, po.currency)} tone="text-emerald-700" />
                    <Fig label="Outstanding" value={formatMoney(po.remaining_minor, po.currency)} tone="text-amber-700" />
                    <Fig label="Invoiced" value={formatMoney(po.invoiced_minor, po.currency)} />
                </div>
                <div className="mt-4">
                    <NextStepCard step={vendorNextStep(data)} viewer="vendor" localPath={`/vendor/orders/${po.po_id}`} onLocal={runNextStep} />
                </div>
            </Card>

            <Tabs tabs={tabs} active={tab} onChange={setTab} />

            {tab === 'items' && (
                <Card padded={false}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-line bg-slate-50/80">
                                <tr>
                                    <th className="th">Item</th>
                                    <th className="th text-right">Ordered</th>
                                    <th className="th text-right">Dispatched</th>
                                    <th className="th text-right">Received</th>
                                    <th className="th text-right">To dispatch</th>
                                    <th className="th text-right">Unit price</th>
                                    <th className="th text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {data.items.map((i: any) => (
                                    <tr key={i.po_item_id}>
                                        <td className="td font-medium text-ink">{i.name}</td>
                                        <td className="td text-right">{i.quantity} {i.unit}</td>
                                        <td className="td text-right">{i.dispatched_quantity || 0}</td>
                                        <td className="td text-right">{i.received_quantity || 0}</td>
                                        <td className="td text-right">{i.remaining_to_dispatch}</td>
                                        <td className="td text-right">{formatMoney(i.unit_price_minor, i.currency)}</td>
                                        <td className="td text-right font-medium">{formatMoney(i.total_minor, i.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {tab === 'pi' && <RecordList rows={data.proforma_invoices} empty="No proforma invoices yet." onOpen={(r) => setSelected({ type: 'proforma_invoice', id: r.proforma_id })}
                render={(r) => [r.proforma_number + (r.vendor_pi_number ? ` · ${r.vendor_pi_number}` : ''), formatMoney(r.grand_total_minor ?? r.amount_minor, r.currency), r.status, r.review_remarks ? `Buyer: ${r.review_remarks}` : formatDate(r.submitted_at || r.created_at)]} />}
            {tab === 'dispatch' && <RecordList rows={data.dispatches} empty="Nothing dispatched yet." onOpen={(r) => setSelected({ type: 'dispatch', id: r.dispatch_id })}
                render={(r) => [r.dispatch_number, r.items.map((l: any) => `${l.name} x${l.quantity}`).join(', '), r.status, [r.transporter_name, r.vehicle_number, r.lr_number && 'LR ' + r.lr_number].filter(Boolean).join(' · ') || formatDate(r.dispatch_date)]} />}
            {tab === 'invoice' && <RecordList rows={data.tax_invoices} empty="No invoices yet." onOpen={(r) => setSelected({ type: 'tax_invoice', id: r.tax_invoice_id })}
                render={(r) => [r.invoice_number || 'Requested by buyer', formatMoney(r.amount_minor, r.currency), r.status, r.review_remarks ? `Buyer: ${r.review_remarks}` : formatDate(r.invoice_date || r.created_at)]} />}
            {tab === 'payments' && (
                <Card padded={false}>
                    {data.payments.length ? (
                        <ul className="divide-y divide-line">
                            {data.payments.map((p: any) => {
                                const receipt = data.payment_receipts.find((r: any) => r.payment_id === p.payment_id);
                                return (
                                    <li key={p.payment_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                                        <div>
                                            <p className="text-[13px] font-medium text-ink">{p.payment_number}{p.proforma_number ? ` · ${p.proforma_number}` : ''}</p>
                                            <p className="text-[11px] text-muted">{p.payment_method || '—'}{p.reference_number ? ` · ref ${p.reference_number}` : ''} · {formatDate(p.paid_at || p.created_at)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-medium">{formatMoney(p.amount_minor, p.currency)}</span>
                                            <StatusPill status={p.status} />
                                            {receipt && (
                                                <button type="button" className="text-[12px] font-medium text-brand-600 hover:underline" onClick={() => setSelected({ type: 'payment_receipt', id: receipt.receipt_id })}>
                                                    Receipt {receipt.receipt_number}{receipt.status === 'acknowledged' ? ' ✓' : ''}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <EmptyState title="No payments yet" />
                    )}
                </Card>
            )}
            {tab === 'grn' && (
                <div className="space-y-3">
                    {data.goods_receipts.length ? data.goods_receipts.map((g: any) => (
                        <Card key={g.grn_id}>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[13px] font-semibold text-ink">{g.grn_number}{g.dispatch_number ? ` · ${g.dispatch_number}` : ''}</p>
                                <span className="text-[12px] text-muted">Posted {formatDateTime(g.posted_at)}</span>
                            </div>
                            <table className="w-full text-[13px]">
                                <thead><tr className="text-left text-[11px] uppercase text-muted"><th className="py-1">Item</th><th className="py-1 text-right">Dispatched</th><th className="py-1 text-right">Received</th><th className="py-1 text-right">Accepted</th><th className="py-1 text-right">Rejected</th><th className="py-1 text-right">Short</th></tr></thead>
                                <tbody className="divide-y divide-line">
                                    {g.items.map((l: any, i: number) => (
                                        <tr key={i}><td className="py-1.5">{l.name}</td><td className="py-1.5 text-right">{l.dispatched_quantity ?? '—'}</td><td className="py-1.5 text-right">{l.received_quantity}</td><td className="py-1.5 text-right text-emerald-700">{l.accepted_quantity}</td><td className="py-1.5 text-right text-rose-700">{l.rejected_quantity}</td><td className="py-1.5 text-right">{l.short_quantity || 0}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                            {g.inspection_remarks && <p className="mt-2 text-[12px] text-slate-600">Inspection: {g.inspection_remarks}</p>}
                        </Card>
                    )) : <Card><EmptyState title="No goods receipts posted yet" /></Card>}
                </div>
            )}
            {tab === 'documents' && (
                <div className="space-y-4">
                    <DocumentPanel client="vendor" entityType="purchase_order" entityId={po.po_id} title="Purchase order documents" hint="Upload your signed PO copy here" canUpload={['sent', 'acknowledged', 'partially_fulfilled'].includes(po.status)} canDelete={false} />
                    <Card>
                        <CardHeader title="All documents on this order" />
                        <ul className="divide-y divide-line text-[13px]">
                            {data.documents.map((d: any) => (
                                <li key={d.document_id} className="flex justify-between gap-3 py-2"><span className="truncate">{d.original_filename}</span><span className="shrink-0 text-[11px] text-muted">{d.entity_type.replace(/_/g, ' ')} · {d.category.replace(/_/g, ' ')}</span></li>
                            ))}
                            {!data.documents.length && <li className="py-2 text-muted">No documents yet.</li>}
                        </ul>
                    </Card>
                </div>
            )}
            {tab === 'timeline' && <Card><CardHeader title="Timeline" /><Timeline events={data.events} /></Card>}

            {/* Reject PO */}
            <Modal open={rejecting} onClose={() => setRejecting(false)} title={`Reject ${po.po_number}?`} description="The buyer is notified with your reason." size="sm"
                footer={<><button type="button" className="btn-ghost" onClick={() => setRejecting(false)}>Cancel</button><SubmitButton form="reject-po" type="submit" busy={busy}>Reject order</SubmitButton></>}>
                <form id="reject-po" onSubmit={async (e) => { e.preventDefault(); if (await run('orders/respond', { po_id: po.po_id, action: 'reject', remarks: String(new FormData(e.currentTarget).get('remarks') || '') }, 'Purchase order rejected')) setRejecting(false); }}>
                    <Field label="Reason" required><Textarea name="remarks" rows={3} required /></Field>
                </form>
            </Modal>

            {form === 'pi' && <PiForm po={po} items={data.items} onClose={() => setForm(null)} onSaved={(pi) => { setForm(null); reload(); setTab('pi'); setSelected({ type: 'proforma_invoice', id: pi.proforma_id }); }} />}
            {form === 'dispatch' && <DispatchForm po={po} items={data.items} onClose={() => setForm(null)} onSaved={(d) => { setForm(null); reload(); setTab('dispatch'); setSelected({ type: 'dispatch', id: d.dispatch_id }); }} />}
            {form === 'invoice' && <InvoiceForm po={po} grns={data.goods_receipts} existing={editInvoice} onClose={() => { setForm(null); setEditInvoice(null); }} onSaved={(t) => { setForm(null); setEditInvoice(null); reload(); setTab('invoice'); setSelected({ type: 'tax_invoice', id: t.tax_invoice_id }); }} />}

            {sel && (
                <Modal open onClose={() => setSelected(null)} size="lg" title={sel.title} description={sel.subtitle}
                    footer={<RecordActions selected={selected!} record={sel.record} busy={busy} run={run} onDone={() => setSelected(null)} onEditInvoice={(r) => { setSelected(null); setEditInvoice(r); setForm('invoice'); }} />}>
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2"><StatusPill status={sel.record.status} />{sel.record.review_remarks && <span className="text-[12px] text-rose-700">Buyer remarks: {sel.record.review_remarks}</span>}</div>
                        {sel.body}
                        <DocumentPanel client="vendor" entityType={selected!.type} entityId={selected!.id} bare canUpload={sel.editable} canDelete={sel.editable} />
                    </div>
                </Modal>
            )}
        </div>
    );
}

function findSelected(data: any, s: NonNullable<Selected>) {
    if (s.type === 'proforma_invoice') {
        const r = data.proforma_invoices.find((x: any) => x.proforma_id === s.id);
        if (!r) return null;
        return {
            record: r, title: `Proforma invoice ${r.proforma_number}`, subtitle: r.vendor_pi_number ? `Your ref ${r.vendor_pi_number}` : undefined,
            editable: ['draft', 'submitted', 'rejected'].includes(r.status),
            body: <LineSummary lines={r.items} currency={r.currency} total={r.grand_total_minor ?? r.amount_minor} hint="Attach the signed PI and bank details before submitting." />
        };
    }
    if (s.type === 'dispatch') {
        const r = data.dispatches.find((x: any) => x.dispatch_id === s.id);
        if (!r) return null;
        return {
            record: r, title: `Dispatch ${r.dispatch_number}`, subtitle: [r.transporter_name, r.vehicle_number, r.lr_number && 'LR ' + r.lr_number].filter(Boolean).join(' · ') || undefined,
            editable: ['draft', 'dispatched'].includes(r.status),
            body: (
                <div className="space-y-2 text-[13px]">
                    <ul className="divide-y divide-line rounded-lg border border-line">{r.items.map((l: any) => <li key={l.po_item_id} className="flex justify-between px-3 py-2"><span>{l.name}</span><span>{l.quantity} {l.unit}{l.accepted_quantity != null ? ` · accepted ${l.accepted_quantity}` : ''}</span></li>)}</ul>
                    {r.status === 'draft' && <p className="text-[12px] text-amber-700">Upload the delivery challan (and packing list / LR / bill of lading) - a dispatch cannot be submitted without documents.</p>}
                </div>
            )
        };
    }
    if (s.type === 'tax_invoice') {
        const r = data.tax_invoices.find((x: any) => x.tax_invoice_id === s.id);
        if (!r) return null;
        return {
            record: r, title: `Invoice ${r.invoice_number || '(requested)'}`, subtitle: formatMoney(r.amount_minor, r.currency),
            editable: ['draft', 'requested', 'received', 'rejected'].includes(r.status),
            body: <p className="text-[13px] text-slate-600">Date {formatDate(r.invoice_date)} · GST {r.gst_number || '—'} · Tax {formatMoney(r.tax_minor || 0, r.currency)}{r.irn ? ` · IRN ${r.irn}` : ''}{r.eway_bill_number ? ` · E-way ${r.eway_bill_number}` : ''}</p>
        };
    }
    const r = data.payment_receipts.find((x: any) => x.receipt_id === s.id);
    if (!r) return null;
    return {
        record: r, title: `Payment receipt ${r.receipt_number}`, subtitle: `${formatMoney(r.amount_minor, r.currency)} · ${r.payment_number}`, editable: true,
        body: <p className="text-[13px] text-slate-600">Paid {formatDateTime(r.paid_at)} by {r.payment_method || '—'}{r.reference_number ? ` (ref ${r.reference_number})` : ''}. {r.status === 'acknowledged' ? `Acknowledged ${formatDateTime(r.acknowledged_at)}.` : 'Please acknowledge receipt of this payment.'}</p>
    };
}

function RecordActions({ selected, record, busy, run, onDone, onEditInvoice }: { selected: NonNullable<Selected>; record: any; busy: boolean; run: (p: string, b: Record<string, unknown>, m: string) => Promise<any>; onDone: () => void; onEditInvoice: (r: any) => void }) {
    const close = <button type="button" className="btn-ghost" onClick={onDone}>Close</button>;
    if (selected.type === 'proforma_invoice' && ['draft', 'rejected'].includes(record.status)) {
        return <>{close}
            <button type="button" className="btn-ghost text-rose-600" disabled={busy} onClick={async () => (await run('proforma/cancel', { proforma_id: record.proforma_id }, 'Proforma invoice cancelled')) && onDone()}>Cancel PI</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={async () => (await run('proforma/submit', { proforma_id: record.proforma_id }, 'Proforma invoice submitted for review')) && onDone()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit PI</button>
        </>;
    }
    if (selected.type === 'proforma_invoice' && record.status === 'submitted') {
        return <>{close}<button type="button" className="btn-ghost text-rose-600" disabled={busy} onClick={async () => (await run('proforma/cancel', { proforma_id: record.proforma_id }, 'Proforma invoice withdrawn')) && onDone()}>Withdraw</button></>;
    }
    if (selected.type === 'dispatch' && ['draft', 'dispatched'].includes(record.status)) {
        return <>{close}
            <button type="button" className="btn-ghost text-rose-600" disabled={busy} onClick={async () => (await run('dispatches/cancel', { dispatch_id: record.dispatch_id }, 'Dispatch cancelled')) && onDone()}>Cancel dispatch</button>
            {record.status === 'draft' && <button type="button" className="btn-primary" disabled={busy} onClick={async () => (await run('dispatches/submit', { dispatch_id: record.dispatch_id }, 'Goods marked as dispatched')) && onDone()}><Truck className="h-4 w-4" /> Submit dispatch</button>}
        </>;
    }
    if (selected.type === 'tax_invoice' && ['draft', 'rejected', 'requested'].includes(record.status)) {
        return <>{close}<button type="button" className="btn-ghost" onClick={() => onEditInvoice(record)}>Edit details</button><button type="button" className="btn-primary" disabled={busy || !record.invoice_number} title={record.invoice_number ? undefined : 'Edit the invoice number first'} onClick={async () => (await run('invoices/submit', { tax_invoice_id: record.tax_invoice_id }, 'Invoice submitted to the buyer')) && onDone()}><Send className="h-4 w-4" /> Submit invoice</button></>;
    }
    if (selected.type === 'payment_receipt' && record.status === 'issued') {
        return <>{close}<button type="button" className="btn-primary" disabled={busy} onClick={async () => (await run('receipts/acknowledge', { receipt_id: record.receipt_id }, 'Payment receipt acknowledged')) && onDone()}><Check className="h-4 w-4" /> Acknowledge receipt</button></>;
    }
    return close;
}

function PiForm({ po, items, onClose, onSaved }: { po: any; items: any[]; onClose: () => void; onSaved: (pi: any) => void }) {
    const toast = useToast();
    const [type, setType] = useState('items');
    const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.po_item_id, String(i.quantity)])));
    const [busy, setBusy] = useState(false);

    async function save(f: FormData) {
        setBusy(true);
        try {
            const pi = await vendorPost(P + 'proforma/save', {
                po_id: po.po_id, pi_type: type,
                items: type === 'items' ? items.map((i) => ({ po_item_id: i.po_item_id, quantity: Number(qty[i.po_item_id] || 0) })).filter((l) => l.quantity > 0) : undefined,
                amount: type === 'advance' ? f.get('amount') : undefined,
                description: f.get('description') || undefined,
                include_charges: f.get('include_charges') === 'on',
                vendor_pi_number: f.get('vendor_pi_number') || undefined,
                invoice_date: f.get('invoice_date') || undefined,
                valid_until: f.get('valid_until') || undefined,
                expected_delivery_date: f.get('expected_delivery_date') || undefined,
                payment_terms: f.get('payment_terms') || undefined,
                shipping_terms: f.get('shipping_terms') || undefined,
                notes: f.get('notes') || undefined,
                bank_details: { bank_name: f.get('bank_name') || undefined, account_name: f.get('account_name') || undefined, account_number: f.get('account_number') || undefined, ifsc: f.get('ifsc') || undefined, upi_id: f.get('upi_id') || undefined }
            });
            toast.success(`Draft ${pi.proforma_number} saved - attach documents and submit`);
            onSaved(pi);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open onClose={onClose} size="xl" title="New proforma invoice" description={`Against ${po.po_number}. Prices are taken from the purchase order.`}
            footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><SubmitButton form="pi-form" type="submit" busy={busy}>Save draft</SubmitButton></>}>
            <form id="pi-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}>
                <Field label="PI type"><Select value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'items', label: 'Itemised (quantities from the PO)' }, { value: 'advance', label: 'Advance / lump sum' }]} /></Field>
                {type === 'items' ? (
                    <div className="overflow-x-auto rounded-lg border border-line">
                        <table className="w-full"><thead className="bg-slate-50"><tr><th className="th">Item</th><th className="th text-right">Ordered</th><th className="th text-right">Unit price</th><th className="th text-right">Bill qty</th></tr></thead>
                            <tbody className="divide-y divide-line">{items.map((i) => (
                                <tr key={i.po_item_id}><td className="td">{i.name}</td><td className="td text-right">{i.quantity} {i.unit}</td><td className="td text-right">{formatMoney(i.unit_price_minor, i.currency)}</td>
                                    <td className="td w-28"><input className="input h-9 text-right" inputMode="decimal" value={qty[i.po_item_id] ?? ''} onChange={(e) => setQty({ ...qty, [i.po_item_id]: e.target.value })} aria-label={`Quantity ${i.name}`} /></td></tr>
                            ))}</tbody></table>
                        <label className="flex items-center gap-2 px-4 py-2 text-[13px] text-slate-600"><input type="checkbox" name="include_charges" className="h-4 w-4 rounded border-line" /> Include the PO&apos;s shipping and other charges</label>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Amount" required><Input name="amount" inputMode="decimal" required /></Field>
                        <Field label="Description"><Input name="description" placeholder={`Advance against ${po.po_number}`} /></Field>
                    </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Your PI number"><Input name="vendor_pi_number" /></Field>
                    <Field label="PI date"><Input name="invoice_date" type="date" /></Field>
                    <Field label="Valid until"><Input name="valid_until" type="date" /></Field>
                    <Field label="Expected delivery"><Input name="expected_delivery_date" type="date" /></Field>
                    <Field label="Payment terms"><Input name="payment_terms" defaultValue={po.payment_terms || ''} /></Field>
                    <Field label="Shipping terms"><Input name="shipping_terms" defaultValue={po.delivery_terms || ''} /></Field>
                    <Field label="Bank name"><Input name="bank_name" /></Field>
                    <Field label="Account name"><Input name="account_name" /></Field>
                    <Field label="Account number"><Input name="account_number" /></Field>
                    <Field label="IFSC"><Input name="ifsc" /></Field>
                    <Field label="UPI ID"><Input name="upi_id" /></Field>
                </div>
                <p className="text-[12px] text-muted">Bank fields left empty fall back to the details on your vendor record.</p>
                <Field label="Notes"><Textarea name="notes" rows={2} /></Field>
            </form>
        </Modal>
    );
}

function DispatchForm({ po, items, onClose, onSaved }: { po: any; items: any[]; onClose: () => void; onSaved: (d: any) => void }) {
    const toast = useToast();
    const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.po_item_id, String(i.remaining_to_dispatch)])));
    const [busy, setBusy] = useState(false);

    async function save(f: FormData) {
        setBusy(true);
        try {
            const d = await vendorPost(P + 'dispatches/save', {
                po_id: po.po_id,
                items: items.map((i) => ({ po_item_id: i.po_item_id, quantity: Number(qty[i.po_item_id] || 0) })).filter((l) => l.quantity > 0),
                dispatch_date: f.get('dispatch_date') || undefined,
                expected_arrival_date: f.get('expected_arrival_date') || undefined,
                transporter_name: f.get('transporter_name') || undefined,
                vehicle_number: f.get('vehicle_number') || undefined,
                lr_number: f.get('lr_number') || undefined,
                lr_date: f.get('lr_date') || undefined,
                bill_of_lading_number: f.get('bill_of_lading_number') || undefined,
                eway_bill_number: f.get('eway_bill_number') || undefined,
                delivery_challan_number: f.get('delivery_challan_number') || undefined,
                remarks: f.get('remarks') || undefined
            });
            toast.success(`Draft ${d.dispatch_number} saved - upload the challan, then submit`);
            onSaved(d);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open onClose={onClose} size="xl" title="New dispatch" description="Quantities cannot exceed what remains to be dispatched on the PO."
            footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><SubmitButton form="dispatch-form" type="submit" busy={busy}>Save draft</SubmitButton></>}>
            <form id="dispatch-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}>
                <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full"><thead className="bg-slate-50"><tr><th className="th">Item</th><th className="th text-right">Ordered</th><th className="th text-right">Remaining</th><th className="th text-right">Dispatch now</th></tr></thead>
                        <tbody className="divide-y divide-line">{items.map((i) => (
                            <tr key={i.po_item_id}><td className="td">{i.name}</td><td className="td text-right">{i.quantity} {i.unit}</td><td className="td text-right">{i.remaining_to_dispatch}</td>
                                <td className="td w-28"><input className="input h-9 text-right" inputMode="decimal" value={qty[i.po_item_id] ?? ''} onChange={(e) => setQty({ ...qty, [i.po_item_id]: e.target.value })} disabled={!i.remaining_to_dispatch} aria-label={`Dispatch quantity ${i.name}`} /></td></tr>
                        ))}</tbody></table>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Dispatch date"><Input name="dispatch_date" type="date" /></Field>
                    <Field label="Expected arrival"><Input name="expected_arrival_date" type="date" /></Field>
                    <Field label="Delivery challan no."><Input name="delivery_challan_number" /></Field>
                    <Field label="Transporter"><Input name="transporter_name" /></Field>
                    <Field label="Vehicle number"><Input name="vehicle_number" /></Field>
                    <Field label="LR number"><Input name="lr_number" /></Field>
                    <Field label="LR date"><Input name="lr_date" type="date" /></Field>
                    <Field label="Bill of lading no."><Input name="bill_of_lading_number" /></Field>
                    <Field label="E-way bill no."><Input name="eway_bill_number" /></Field>
                </div>
                <Field label="Remarks"><Textarea name="remarks" rows={2} /></Field>
            </form>
        </Modal>
    );
}

function InvoiceForm({ po, grns, existing, onClose, onSaved }: { po: any; grns: any[]; existing?: any; onClose: () => void; onSaved: (t: any) => void }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const major = (m: number | null | undefined) => (m != null ? (m / 100).toFixed(2) : '');
    async function save(f: FormData) {
        setBusy(true);
        try {
            const t = await vendorPost(P + 'invoices/save', {
                po_id: po.po_id,
                tax_invoice_id: existing?.tax_invoice_id,
                invoice_number: f.get('invoice_number'), invoice_date: f.get('invoice_date') || undefined,
                amount: f.get('amount'), subtotal: f.get('subtotal') || undefined, tax: f.get('tax') || undefined,
                gst_number: f.get('gst_number') || undefined, irn: f.get('irn') || undefined, eway_bill_number: f.get('eway_bill_number') || undefined,
                grn_id: f.get('grn_id') || undefined, notes: f.get('notes') || undefined
            });
            toast.success('Invoice draft saved - attach the invoice PDF and submit');
            onSaved(t);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <Modal open onClose={onClose} size="lg" title="Commercial / tax invoice" description={`Against ${po.po_number} (order value ${formatMoney(po.grand_total_minor, po.currency)}).`}
            footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><SubmitButton form="invoice-form" type="submit" busy={busy}>Save draft</SubmitButton></>}>
            <form id="invoice-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}>
                <Field label="Invoice number" required><Input name="invoice_number" required defaultValue={existing?.invoice_number || ''} /></Field>
                <Field label="Invoice date"><Input name="invoice_date" type="date" defaultValue={existing?.invoice_date ? String(existing.invoice_date).slice(0, 10) : ''} /></Field>
                <Field label="Invoice total (incl. tax)" required><Input name="amount" inputMode="decimal" required defaultValue={major(existing?.amount_minor)} /></Field>
                <Field label="Tax amount"><Input name="tax" inputMode="decimal" defaultValue={major(existing?.tax_minor)} /></Field>
                <Field label="Taxable value"><Input name="subtotal" inputMode="decimal" defaultValue={major(existing?.subtotal_minor)} /></Field>
                <Field label="GSTIN"><Input name="gst_number" defaultValue={existing?.gst_number || ''} /></Field>
                <Field label="E-invoice IRN"><Input name="irn" defaultValue={existing?.irn || ''} /></Field>
                <Field label="E-way bill no."><Input name="eway_bill_number" defaultValue={existing?.eway_bill_number || ''} /></Field>
                <Field label="Against GRN" className="sm:col-span-2"><Select name="grn_id" placeholder="Not linked" options={grns.map((g) => ({ value: g.grn_id, label: g.grn_number }))} /></Field>
                <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" rows={2} /></Field>
            </form>
        </Modal>
    );
}

function RecordList({ rows, render, onOpen, empty }: { rows: any[]; render: (r: any) => [string, string, string, string]; onOpen: (r: any) => void; empty: string }) {
    if (!rows.length) return <Card><EmptyState title={empty} /></Card>;
    return (
        <Card padded={false}>
            <ul className="divide-y divide-line">
                {rows.map((r, i) => {
                    const [title, amount, status, sub] = render(r);
                    return (
                        <li key={i}>
                            <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
                                <div className="min-w-0"><p className="truncate text-[13px] font-medium text-ink">{title}</p><p className="truncate text-[11px] text-muted">{sub}</p></div>
                                <div className="flex shrink-0 items-center gap-3"><span className="text-[13px]">{amount}</span><StatusPill status={status} /></div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

function LineSummary({ lines, currency, total, hint }: { lines: any[]; currency: string; total: number; hint?: string }) {
    return (
        <div className="space-y-2">
            <ul className="divide-y divide-line rounded-lg border border-line text-[13px]">
                {(lines || []).map((l: any) => <li key={l.line_no} className="flex justify-between px-3 py-2"><span>{l.name} × {l.quantity}</span><span>{formatMoney(l.total_minor, currency)}</span></li>)}
                <li className="flex justify-between bg-slate-50 px-3 py-2 font-semibold"><span>Total</span><span>{formatMoney(total, currency)}</span></li>
            </ul>
            {hint && <p className="text-[12px] text-muted">{hint}</p>}
        </div>
    );
}

function Fig({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
    return <div><p className="text-[12px] text-muted">{label}</p><p className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</p></div>;
}
