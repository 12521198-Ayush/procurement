'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Package, Receipt, Send } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { can } = useAuth();
    const toast = useToast();
    const { data, loading, error, reload } = useResource<any>('/procurement/purchase-orders/detail', { po_id: id });

    const [busy, setBusy] = useState(false);
    const [payOpen, setPayOpen] = useState(false);

    async function send() {
        setBusy(true);
        try {
            await post('/procurement/purchase-orders/send', { po_id: id });
            toast.success('Purchase order emailed to the vendor');
            reload();
        } catch (err: any) {
            toast.error(err.message);
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
                amount: form.get('amount'),
                payment_method: form.get('payment_method'),
                reference_number: form.get('reference_number')
            });
            if (form.get('mark_paid') === 'on') {
                await post('/procurement/payments/mark-paid', { payment_id: created.payment_id });
            }
            toast.success('Payment recorded');
            setPayOpen(false);
            reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function requestTaxInvoice() {
        setBusy(true);
        try {
            await post('/procurement/tax-invoices/request', { po_id: id });
            toast.success('Tax invoice requested from the vendor');
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
                <EmptyState title="Could not load this purchase order" hint={error ?? undefined} />
            </Card>
        );
    }

    const po = data.purchase_order;
    const fullyPaid = po.remaining_minor === 0 && po.grand_total_minor > 0;

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
                            {po.rfq_number && ` · from ${po.rfq_number}`}
                        </p>
                        {po.requires_approval && po.status === 'pending_approval' && (
                            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                                This exceeded the department budget, so it needs approval before it can be sent.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-ghost" onClick={downloadPdf}>
                            <Download className="h-4 w-4" />
                            PDF
                        </button>
                        {['draft', 'approved'].includes(po.status) && can('PO_SEND') && (
                            <button type="button" className="btn-primary" onClick={send} disabled={busy}>
                                <Send className="h-4 w-4" />
                                Send to vendor
                            </button>
                        )}
                        {!fullyPaid && can('PAYMENT_CREATE') && po.status !== 'pending_approval' && (
                            <button type="button" className="btn-primary" onClick={() => setPayOpen(true)}>
                                <Receipt className="h-4 w-4" />
                                Record payment
                            </button>
                        )}
                        {fullyPaid && !data.tax_invoices.length && can('PAYMENT_CREATE') && (
                            <button type="button" className="btn-primary" onClick={requestTaxInvoice} disabled={busy}>
                                <FileText className="h-4 w-4" />
                                Request tax invoice
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
                    <Money label="Order value" value={formatMoney(po.grand_total_minor, po.currency)} />
                    <Money label="Paid" value={formatMoney(po.paid_minor, po.currency)} tone="text-emerald-700" />
                    <Money label="Outstanding" value={formatMoney(po.remaining_minor, po.currency)} tone="text-amber-700" />
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                            width: `${po.grand_total_minor ? Math.min((po.paid_minor / po.grand_total_minor) * 100, 100) : 0}%`
                        }}
                    />
                </div>
            </Card>

            <Card padded={false}>
                <CardHeader title="Items" className="px-5 pt-5" />
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-y border-line bg-slate-50/80">
                            <tr>
                                <th className="th">Item</th>
                                <th className="th text-right">Ordered</th>
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
                                    <td className="td text-right">{item.received_quantity || 0}</td>
                                    <td className="td text-right">{formatMoney(item.unit_price_minor, item.currency)}</td>
                                    <td className="td text-right font-medium">{formatMoney(item.total_minor, item.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card padded={false}>
                    <CardHeader title="Payments" className="px-5 pt-5" />
                    {data.payments.length ? (
                        <ul className="divide-y divide-line">
                            {data.payments.map((p: any) => (
                                <li key={p.payment_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-medium text-ink">{p.payment_number}</p>
                                        <p className="text-[11px] text-muted">
                                            {p.payment_type} · {formatDate(p.paid_at || p.created_at)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-medium">{formatMoney(p.amount_minor, p.currency)}</span>
                                        <StatusPill status={p.status} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState title="No payments recorded" />
                    )}
                </Card>

                <Card padded={false}>
                    <CardHeader title="Goods receipts" className="px-5 pt-5" />
                    {data.goods_receipts.length ? (
                        <ul className="divide-y divide-line">
                            {data.goods_receipts.map((g: any) => (
                                <li key={g.grn_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <Package className="h-4 w-4 text-slate-400" />
                                        <div>
                                            <p className="text-[13px] font-medium text-ink">{g.grn_number}</p>
                                            <p className="text-[11px] text-muted">{formatDate(g.received_at)}</p>
                                        </div>
                                    </div>
                                    <span className="text-[12px] text-muted">{g.received_by_name}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState title="Nothing received yet" hint="Record a goods receipt from the Inventory screen." />
                    )}
                </Card>
            </div>

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
                    <Field label="Amount" required>
                        <Input name="amount" inputMode="decimal" required autoFocus placeholder="0.00" />
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
                    <Field label="Reference number">
                        <Input name="reference_number" />
                    </Field>
                    <label className="flex items-center gap-2.5 text-sm text-slate-700">
                        <input type="checkbox" name="mark_paid" defaultChecked className="h-4 w-4 rounded border-line text-brand-600" />
                        Mark as paid immediately
                    </label>
                </form>
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
