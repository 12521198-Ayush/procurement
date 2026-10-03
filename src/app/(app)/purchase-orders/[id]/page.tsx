'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Ban, CheckCircle2, Download, FileText, FolderOpen, PackageCheck, Paperclip, Receipt, Send } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import DocumentPanel from '@/components/procurement/DocumentPanel';
import Timeline from '@/components/procurement/Timeline';
import { LifecycleStepper, NextStepCard, RelatedDocuments, type NextStep } from '@/components/procurement/Lifecycle';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/hooks';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

const PAYABLE_PI = ['approved', 'payment_pending', 'partially_paid'];

export default function PurchaseOrderDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { tab?: string; action?: string } }) {
    const { id } = params;
    const { can } = useAuth();
    const toast = useToast();
    const { data, loading, error, reload } = useResource<any>('/procurement/purchase-orders/detail', { po_id: id });
    const life = useResource<any>('/procurement/lifecycle/detail', { po_id: id });

    const [tab, setTab] = useState(searchParams?.tab || 'overview');
    const [busy, setBusy] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [payPi, setPayPi] = useState('');
    const [cancelOpen, setCancelOpen] = useState(false);
    const [proofFor, setProofFor] = useState<any>(null);

    function refresh() {
        reload();
        life.reload();
    }

    async function run(endpoint: string, body: Record<string, unknown>, message: string) {
        setBusy(true);
        try {
            await post(endpoint, { po_id: id, ...body });
            toast.success(message);
            refresh();
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function downloadPdf() {
        try {
            const res = await api.post('/procurement/purchase-orders/pdf', { po_id: id }, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${data.purchase_order.po_number}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Could not generate the PDF');
        }
    }

    async function recordPayment(form: FormData) {
        setBusy(true);
        try {
            const created = await post('/procurement/payments/create', {
                po_id: id,
                proforma_id: form.get('proforma_id') || undefined,
                amount: form.get('amount'),
                payment_method: form.get('payment_method'),
                reference_number: form.get('reference_number'),
                notes: form.get('notes') || undefined
            });
            if (form.get('mark_paid') === 'on') {
                const settled = await post('/procurement/payments/mark-paid', { payment_id: created.payment_id });
                toast.success(settled.receipt ? `Payment recorded - receipt ${settled.receipt.receipt_number} issued` : 'Payment recorded');
            } else {
                toast.success('Payment initiated');
            }
            setPayOpen(false);
            refresh();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const payablePis = useMemo(() => (data?.proforma_invoices || []).filter((p: any) => PAYABLE_PI.includes(p.status)), [data]);

    function openPay() {
        setPayPi(payablePis[0]?.proforma_id || '');
        setPayOpen(true);
    }

    // Arriving from a "Record payment" next-step link opens the payment form once.
    const autoPay = useRef(searchParams?.action === 'pay');
    const tabsRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!autoPay.current || !data) return;
        autoPay.current = false;
        setPayPi(payablePis[0]?.proforma_id || '');
        setPayOpen(true);
    }, [data, payablePis]);

    function runNextStep(step: NextStep) {
        if (step.action === 'pay') return openPay();
        if (step.action === 'request_invoice') return void run('/procurement/tax-invoices/request', {}, 'Tax invoice requested from the vendor');
        setTab(new URLSearchParams(step.href?.split('?')[1] || '').get('tab') || 'overview');
        tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (loading) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    if (error || !data) {
        return (
            <Card>
                <EmptyState title="Could not load this purchase order" hint={error ?? undefined} />
            </Card>
        );
    }

    const po = data.purchase_order;
    const fullyPaid = po.remaining_minor === 0 && po.grand_total_minor > 0;
    const issued = !['draft', 'pending_approval', 'approved', 'cancelled', 'vendor_rejected'].includes(po.status);
    const selectedPi = payablePis.find((p: any) => p.proforma_id === payPi);

    const tabs = [
        { value: 'overview', label: 'Overview' },
        { value: 'financial', label: 'Financial', count: data.proforma_invoices.length + data.payments.length },
        { value: 'delivery', label: 'Delivery', count: data.dispatches.length + data.goods_receipts.length },
        { value: 'documents', label: 'Documents' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'related', label: 'Related records' }
    ];

    return (
        <div className="space-y-5">
            <Link href="/purchase-orders" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
                <ArrowLeft className="h-4 w-4" />
                Back to purchase orders
            </Link>

            <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-semibold text-ink">{po.po_number}</h1>
                            <StatusPill status={po.status} />
                        </div>
                        <p className="mt-1 text-[13px] text-muted">
                            {po.vendor_name}
                            {po.rfq_number && (
                                <>
                                    {' · from '}
                                    <Link href={`/rfq/${po.rfq_id}`} className="text-brand-600 hover:underline">
                                        {po.rfq_number}
                                    </Link>
                                </>
                            )}
                            {po.accepted_at && ` · accepted ${formatDate(po.accepted_at)}`}
                        </p>
                        {po.requires_approval && po.status === 'pending_approval' && (
                            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                                This exceeded the department budget, so it needs approval before it can be sent.
                            </p>
                        )}
                        {po.status === 'vendor_rejected' && (
                            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">Rejected by the vendor: {po.vendor_remarks}</p>
                        )}
                        {po.status === 'cancelled' && po.cancel_reason && (
                            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">Cancelled: {po.cancel_reason}</p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link href={`/lifecycle?po=${po.po_id}`} className="btn-ghost">
                            <FolderOpen className="h-4 w-4" />
                            Procurement file
                        </Link>
                        <button type="button" className="btn-ghost" onClick={downloadPdf}>
                            <Download className="h-4 w-4" />
                            PDF
                        </button>
                        {['draft', 'approved'].includes(po.status) && can('PO_SEND') && (
                            <button type="button" className="btn-primary" onClick={() => run('/procurement/purchase-orders/send', {}, 'Purchase order emailed to the vendor')} disabled={busy}>
                                <Send className="h-4 w-4" />
                                Send to vendor
                            </button>
                        )}
                        {po.status === 'sent' && can('PO_CREATE') && (
                            <button
                                type="button"
                                className="btn-ghost"
                                disabled={busy}
                                onClick={() => run('/procurement/purchase-orders/status', { status: 'acknowledged', remarks: 'Acceptance received offline' }, 'Vendor acceptance recorded')}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Record acceptance
                            </button>
                        )}
                        {['acknowledged', 'partially_fulfilled', 'sent'].includes(po.status) && can('GRN_CREATE') && (
                            <Link href={`/receiving?po=${po.po_id}`} className="btn-ghost">
                                <PackageCheck className="h-4 w-4" />
                                Receive goods
                            </Link>
                        )}
                        {!fullyPaid && issued && can('PAYMENT_CREATE') && (
                            <button type="button" className="btn-primary" onClick={openPay}>
                                <Receipt className="h-4 w-4" />
                                Record payment
                            </button>
                        )}
                        {fullyPaid && !data.tax_invoices.length && can('PAYMENT_CREATE') && (
                            <button type="button" className="btn-primary" onClick={() => run('/procurement/tax-invoices/request', {}, 'Tax invoice requested from the vendor')} disabled={busy}>
                                <FileText className="h-4 w-4" />
                                Request tax invoice
                            </button>
                        )}
                        {data.can_cancel && can('PO_CANCEL') && (
                            <button type="button" className="btn-ghost text-rose-600" onClick={() => setCancelOpen(true)}>
                                <Ban className="h-4 w-4" />
                                Cancel PO
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-4">
                    <Money label="Order value" value={formatMoney(po.grand_total_minor, po.currency)} />
                    <Money label="Paid" value={formatMoney(po.paid_minor, po.currency)} tone="text-emerald-700" />
                    <Money label="Outstanding" value={formatMoney(po.remaining_minor, po.currency)} tone="text-amber-700" />
                    <Money label="Invoiced" value={formatMoney(po.invoiced_minor || 0, po.currency)} />
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${po.grand_total_minor ? Math.min((po.paid_minor / po.grand_total_minor) * 100, 100) : 0}%` }}
                    />
                </div>

                {life.data?.stages && (
                    <div className="mt-5 border-t border-line pt-5">
                        <LifecycleStepper stages={life.data.stages} next={life.data.next_step?.stage} />
                    </div>
                )}
                {life.data?.next_step && (
                    <div className="mt-4">
                        <NextStepCard step={life.data.next_step} localPath={`/purchase-orders/${id}`} onLocal={runNextStep} />
                    </div>
                )}
            </Card>

            <div ref={tabsRef} className="scroll-mt-4">
                <Tabs tabs={tabs} active={tab} onChange={setTab} />
            </div>

            {tab === 'overview' && (
                <Card padded={false}>
                    <CardHeader title="Items" className="px-5 pt-5" />
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-y border-line bg-slate-50/80">
                                <tr>
                                    <th className="th">Item</th>
                                    <th className="th text-right">Ordered</th>
                                    <th className="th text-right">Dispatched</th>
                                    <th className="th text-right">Received</th>
                                    <th className="th text-right">Unit price</th>
                                    <th className="th text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {data.items.map((item: any) => (
                                    <tr key={item.po_item_id}>
                                        <td className="td font-medium text-ink">{item.name}</td>
                                        <td className="td text-right">
                                            {item.quantity} {item.unit}
                                        </td>
                                        <td className="td text-right">{item.dispatched_quantity || 0}</td>
                                        <td className="td text-right">{item.received_quantity || 0}</td>
                                        <td className="td text-right">{formatMoney(item.unit_price_minor, item.currency)}</td>
                                        <td className="td text-right font-medium">{formatMoney(item.total_minor, item.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="grid gap-x-6 gap-y-2 border-t border-line px-5 py-4 text-[13px] text-slate-600 sm:grid-cols-2">
                        <p>Delivery address: {po.delivery_address || '—'}</p>
                        <p>Expected delivery: {formatDate(po.expected_delivery_date)}</p>
                        <p>Payment terms: {po.payment_terms || '—'}</p>
                        <p>Delivery terms: {po.delivery_terms || '—'}</p>
                    </div>
                </Card>
            )}

            {tab === 'financial' && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card padded={false}>
                        <CardHeader title="Proforma invoices" className="px-5 pt-5" action={<Link href={`/proforma-invoices?po=${po.po_id}`} className="text-[13px] font-medium text-brand-600">Review →</Link>} />
                        {data.proforma_invoices.filter((p: any) => p.status !== 'draft').length ? (
                            <ul className="divide-y divide-line">
                                {data.proforma_invoices.filter((p: any) => p.status !== 'draft').map((p: any) => (
                                    <li key={p.proforma_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                                        <div className="min-w-0">
                                            <Link href={`/proforma-invoices?id=${p.proforma_id}`} className="truncate text-[13px] font-medium text-brand-700 hover:underline">
                                                {p.proforma_number}
                                            </Link>
                                            <p className="text-[11px] text-muted">
                                                {p.vendor_pi_number ? `Vendor ref ${p.vendor_pi_number} · ` : ''}
                                                {formatDate(p.submitted_at || p.created_at)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-medium">{formatMoney(p.grand_total_minor ?? p.amount_minor, p.currency)}</span>
                                            <StatusPill status={p.status} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState title="No proforma invoices" hint="The vendor raises PIs from their portal." />
                        )}
                    </Card>

                    <Card padded={false}>
                        <CardHeader title="Payments & receipts" className="px-5 pt-5" />
                        {data.payments.length ? (
                            <ul className="divide-y divide-line">
                                {data.payments.map((p: any) => {
                                    const receipt = data.payment_receipts.find((r: any) => r.payment_id === p.payment_id);
                                    return (
                                        <li key={p.payment_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] font-medium text-ink">{p.payment_number}</p>
                                                <p className="text-[11px] text-muted">
                                                    {p.proforma_number ? `${p.proforma_number} · ` : ''}
                                                    {p.payment_method || 'method n/a'} · {formatDate(p.paid_at || p.created_at)}
                                                    {receipt ? ` · receipt ${receipt.receipt_number}${receipt.status === 'acknowledged' ? ' (acknowledged)' : ''}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[13px] font-medium">{formatMoney(p.amount_minor, p.currency)}</span>
                                                <StatusPill status={p.status} />
                                                {p.status === 'pending' && can('PAYMENT_MARK_PAID') && (
                                                    <button
                                                        type="button"
                                                        className="text-[12px] font-medium text-brand-600 hover:underline"
                                                        disabled={busy}
                                                        onClick={() => run('/procurement/payments/mark-paid', { payment_id: p.payment_id }, 'Payment marked as paid')}
                                                    >
                                                        Mark paid
                                                    </button>
                                                )}
                                                <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" title="Payment documents" onClick={() => setProofFor(p)}>
                                                    <Paperclip className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <EmptyState title="No payments recorded" />
                        )}
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader
                            title="Tax invoices"
                            action={<Link href={`/vendor-ledger?vendor=${po.vendor_id}&po=${po.po_id}`} className="text-[13px] font-medium text-brand-600">Vendor ledger →</Link>}
                        />
                        {data.tax_invoices.filter((t: any) => t.status !== 'draft').length ? (
                            <ul className="divide-y divide-line">
                                {data.tax_invoices.filter((t: any) => t.status !== 'draft').map((t: any) => (
                                    <li key={t.tax_invoice_id} className="flex items-center justify-between gap-3 py-2.5">
                                        <Link href={`/tax-invoices?id=${t.tax_invoice_id}`} className="text-[13px] font-medium text-brand-700 hover:underline">
                                            {t.invoice_number || 'Requested'}
                                        </Link>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px]">{formatMoney(t.amount_minor, t.currency)}</span>
                                            <StatusPill status={t.status} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[13px] text-muted">No tax invoice yet.</p>
                        )}
                    </Card>
                </div>
            )}

            {tab === 'delivery' && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card padded={false}>
                        <CardHeader title="Dispatches" className="px-5 pt-5" />
                        {data.dispatches.filter((d: any) => d.status !== 'draft').length ? (
                            <ul className="divide-y divide-line">
                                {data.dispatches.filter((d: any) => d.status !== 'draft').map((d: any) => (
                                    <li key={d.dispatch_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                                        <div className="min-w-0">
                                            <Link href={`/receiving?dispatch=${d.dispatch_id}`} className="text-[13px] font-medium text-brand-700 hover:underline">
                                                {d.dispatch_number}
                                            </Link>
                                            <p className="text-[11px] text-muted">
                                                {formatDate(d.dispatch_date)} · {[d.transporter_name, d.vehicle_number, d.lr_number && `LR ${d.lr_number}`].filter(Boolean).join(' · ') || 'no transport details'}
                                            </p>
                                        </div>
                                        <StatusPill status={d.status} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState title="Nothing dispatched yet" />
                        )}
                    </Card>
                    <Card padded={false}>
                        <CardHeader title="Goods receipts" className="px-5 pt-5" />
                        {data.goods_receipts.length ? (
                            <ul className="divide-y divide-line">
                                {data.goods_receipts.map((g: any) => (
                                    <li key={g.grn_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                                        <div className="min-w-0">
                                            <Link href={`/receiving?grn=${g.grn_id}`} className="text-[13px] font-medium text-brand-700 hover:underline">
                                                {g.grn_number}
                                            </Link>
                                            <p className="text-[11px] text-muted">
                                                {formatDate(g.grn_date || g.received_at)} · {g.received_by_name}
                                                {g.dispatch_number ? ` · ${g.dispatch_number}` : ''}
                                            </p>
                                        </div>
                                        <StatusPill status={g.status || 'posted'} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState title="Nothing received yet" />
                        )}
                    </Card>
                </div>
            )}

            {tab === 'documents' && (
                <div className="space-y-4">
                    <DocumentPanel
                        entityType="purchase_order"
                        entityId={po.po_id}
                        title="Purchase order documents"
                        hint="Shared with the vendor"
                        canUpload={can('DOCUMENT_UPLOAD') && po.status !== 'cancelled'}
                        canDelete={can('DOCUMENT_DELETE')}
                    />
                    {life.data?.documents?.length > 0 && (
                        <Card>
                            <CardHeader title="All documents in this procurement" />
                            <ul className="divide-y divide-line">
                                {life.data.documents.map((d: any) => (
                                    <li key={d.document_id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                                        <span className="truncate">{d.original_filename}</span>
                                        <span className="shrink-0 text-[11px] text-muted">
                                            {d.entity_type.replace(/_/g, ' ')} · {d.category.replace(/_/g, ' ')} · {formatDateTime(d.uploaded_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            )}

            {tab === 'timeline' && (
                <Card>
                    <CardHeader title="Timeline" />
                    {life.loading ? <div className="h-24 animate-pulse rounded-lg bg-slate-100" /> : <Timeline events={life.data?.events || []} />}
                </Card>
            )}

            {tab === 'related' && (
                <Card>
                    <CardHeader title="Related records" />
                    <RelatedDocuments related={life.data?.related || []} exclude={po.po_id} />
                </Card>
            )}

            <Modal
                open={payOpen}
                onClose={() => setPayOpen(false)}
                title="Record payment"
                description={`Outstanding balance is ${formatMoney(po.remaining_minor, po.currency)}. Anything above that is rejected.`}
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setPayOpen(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="payment-form" type="submit" busy={busy}>
                            Record
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="payment-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        recordPayment(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    <Field label="Against proforma invoice" hint={payablePis.length ? undefined : 'No approved PI - this will be a payment on the PO itself.'}>
                        <Select
                            name="proforma_id"
                            value={payPi}
                            onChange={(e) => setPayPi(e.target.value)}
                            placeholder="No PI"
                            options={payablePis.map((p: any) => ({ value: p.proforma_id, label: `${p.proforma_number} - ${formatMoney((p.grand_total_minor ?? p.amount_minor) - (p.paid_minor || 0), p.currency)} due` }))}
                        />
                    </Field>
                    <Field label="Amount" required>
                        <Input
                            key={payPi}
                            name="amount"
                            inputMode="decimal"
                            required
                            autoFocus
                            placeholder="0.00"
                            defaultValue={selectedPi ? (((selectedPi.grand_total_minor ?? selectedPi.amount_minor) - (selectedPi.paid_minor || 0)) / 100).toFixed(2) : ''}
                        />
                    </Field>
                    <Field label="Payment method">
                        <Select
                            name="payment_method"
                            placeholder="Select method"
                            options={[
                                { value: 'bank_transfer', label: 'Bank transfer' },
                                { value: 'cheque', label: 'Cheque' },
                                { value: 'upi', label: 'UPI' },
                                { value: 'cash', label: 'Cash' }
                            ]}
                        />
                    </Field>
                    <Field label="Reference number (UTR / cheque no.)">
                        <Input name="reference_number" />
                    </Field>
                    <Field label="Notes">
                        <Textarea name="notes" rows={2} />
                    </Field>
                    <label className="flex items-center gap-2.5 text-sm text-slate-700">
                        <input type="checkbox" name="mark_paid" defaultChecked={can('PAYMENT_MARK_PAID')} disabled={!can('PAYMENT_MARK_PAID')} className="h-4 w-4 rounded border-line text-brand-600" />
                        Mark as paid now (issues the payment receipt)
                    </label>
                </form>
            </Modal>

            <Modal
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                title={`Cancel ${po.po_number}?`}
                description="Open proforma invoices are cancelled with it and the vendor is notified."
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setCancelOpen(false)}>
                            Keep
                        </button>
                        <SubmitButton form="cancel-form" type="submit" busy={busy}>
                            Cancel purchase order
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="cancel-form"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const remarks = String(new FormData(e.currentTarget).get('remarks') || '');
                        if (await run('/procurement/purchase-orders/cancel', { remarks }, 'Purchase order cancelled')) setCancelOpen(false);
                    }}
                >
                    <Field label="Reason" required>
                        <Textarea name="remarks" rows={3} required />
                    </Field>
                </form>
            </Modal>

            <Modal open={!!proofFor} onClose={() => setProofFor(null)} title={`Documents - ${proofFor?.payment_number || ''}`} description="Payment proof, transaction receipt, bank confirmation." size="lg">
                {proofFor && (
                    <DocumentPanel entityType="payment" entityId={proofFor.payment_id} bare canUpload={can('DOCUMENT_UPLOAD')} canDelete={can('DOCUMENT_DELETE')} />
                )}
            </Modal>
        </div>
    );
}

function Money({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
    return (
        <div>
            <p className="text-[12px] text-muted">{label}</p>
            <p className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</p>
        </div>
    );
}
