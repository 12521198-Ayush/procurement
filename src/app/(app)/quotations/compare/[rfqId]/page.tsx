'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Award, Check, ShoppingCart } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/Card';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import BidOpeningPanel from '@/components/procurement/BidOpeningPanel';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

const REASONS = [
    { value: 'Best Price', label: 'Best Price' },
    { value: 'Best Delivery', label: 'Best Delivery' },
    { value: 'Best Quality', label: 'Best Quality' },
    { value: 'Existing Vendor', label: 'Existing Vendor' },
    { value: 'Other', label: 'Other' }
];

export default function CompareQuotationsPage({ params }: { params: { rfqId: string } }) {
    const { rfqId } = params;
    const router = useRouter();
    const { can } = useAuth();
    const toast = useToast();

    const bidState = useResource<{ sealed: boolean }>('/procurement/rfq/bid-status', { rfq_id: rfqId });
    const sealed = bidState.data?.sealed;
    const { data, loading, error, reload } = useResource<any>(sealed === false ? '/procurement/quotations/compare' : null, { rfq_id: rfqId });
    const [selecting, setSelecting] = useState<any>(null);
    const [creatingPo, setCreatingPo] = useState(false);
    const [busy, setBusy] = useState(false);

    async function createPurchaseOrder(form: FormData) {
        const selected = data.quotations.find((q: any) => q.status === 'selected');
        setBusy(true);
        try {
            const po = await post('/procurement/purchase-orders/create', {
                quotation_id: selected.quotation_id,
                delivery_address: form.get('delivery_address') || undefined,
                expected_delivery_date: form.get('expected_delivery_date') || undefined,
                payment_terms: form.get('payment_terms') || undefined,
                notes: form.get('notes') || undefined
            });
            toast.success(
                po.status === 'pending_approval'
                    ? `${po.po_number} created and sent for budget approval`
                    : `${po.po_number} created. Review it and send it to the vendor.`
            );
            router.push(`/purchase-orders/${po.po_id}`);
        } catch (err: any) {
            toast.error(err.message);
            setBusy(false);
        }
    }

    async function confirmSelection(form: FormData) {
        setBusy(true);
        try {
            await post('/procurement/quotations/select-vendor', {
                quotation_id: selecting.quotation_id,
                reason: form.get('reason'),
                remarks: form.get('remarks')
            });
            toast.success(`${selecting.vendor_name} selected`);
            setSelecting(null);
            reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (bidState.loading) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    if (sealed) {
        return (
            <div className="space-y-4">
                <BackLink rfqId={rfqId} />
                <PageHeader title="Compare quotations" subtitle="Quotations stay sealed until the bids are formally opened." />
                <BidOpeningPanel rfqId={rfqId} onOpened={() => bidState.reload()} />
            </div>
        );
    }
    if (loading || !data) {
        if (error || bidState.error) {
            return (
                <Card>
                    <EmptyState title="Could not load the comparison" hint={(error || bidState.error) ?? undefined} />
                </Card>
            );
        }
        return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;
    }
    if (error) {
        return (
            <Card>
                <EmptyState title="Could not load the comparison" hint={error ?? undefined} />
            </Card>
        );
    }

    const { rfq, rfq_items, quotations, purchase_order } = data;
    const selectedQuote = quotations.find((q: any) => q.status === 'selected');

    if (!quotations.length) {
        return (
            <div>
                <BackLink rfqId={rfqId} />
                <Card>
                    <EmptyState
                        title="No quotations submitted yet"
                        hint="Vendors have been invited but none have responded so far."
                    />
                </Card>
            </div>
        );
    }

    return (
        <div>
            <BackLink rfqId={rfqId} />

            <PageHeader
                title={`Compare quotations — ${rfq.rfq_number}`}
                subtitle={`${quotations.length} of your invited vendors responded. Pick the one that suits you, not just the cheapest.`}
            />

            {rfq.selected_vendor_id && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                    <span className="flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        {selectedQuote
                            ? `${selectedQuote.vendor_name} was selected (${selectedQuote.quotation_number}).`
                            : 'A vendor has already been selected for this RFQ.'}
                    </span>
                    {purchase_order ? (
                        <Link href={`/purchase-orders/${purchase_order.po_id}`} className="btn-primary h-9">
                            View {purchase_order.po_number}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    ) : (
                        selectedQuote &&
                        can('PO_CREATE') && (
                            <button type="button" className="btn-primary h-9" onClick={() => setCreatingPo(true)}>
                                <ShoppingCart className="h-4 w-4" />
                                Create purchase order
                            </button>
                        )
                    )}
                </div>
            )}

            <Card padded={false} className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead className="border-b border-line bg-slate-50/80">
                            <tr>
                                <th className="th sticky left-0 z-10 bg-slate-50/80">Criteria</th>
                                {quotations.map((q: any) => (
                                    <th key={q.quotation_id} className="th min-w-[190px]">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[13px] font-semibold normal-case tracking-normal text-ink">
                                                {q.vendor_name}
                                            </span>
                                            <span className="text-[11px] font-normal normal-case text-muted">
                                                {q.quotation_number}
                                            </span>
                                            {q.is_lowest && (
                                                <span className="inline-flex w-fit rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium normal-case text-emerald-700">
                                                    Lowest total
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            <Row label="Subtotal" quotations={quotations} render={(q) => formatMoney(q.subtotal_minor, q.currency)} />
                            <Row label="Discount" quotations={quotations} render={(q) => formatMoney(q.discount_minor, q.currency)} />
                            <Row label="Tax" quotations={quotations} render={(q) => formatMoney(q.tax_minor, q.currency)} />
                            <Row label="Shipping" quotations={quotations} render={(q) => formatMoney(q.shipping_minor, q.currency)} />
                            <tr className="bg-brand-50/40">
                                <td className="td sticky left-0 z-10 bg-brand-50/40 font-semibold text-ink">Grand total</td>
                                {quotations.map((q: any) => (
                                    <td key={q.quotation_id} className="td text-[14px] font-semibold text-ink">
                                        {formatMoney(q.grand_total_minor, q.currency)}
                                    </td>
                                ))}
                            </tr>
                            <Row label="Delivery" quotations={quotations} render={(q) => (q.delivery_days != null ? `${q.delivery_days} days` : '—')} />
                            <Row label="Payment terms" quotations={quotations} render={(q) => q.payment_terms || '—'} />
                            <Row label="Warranty" quotations={quotations} render={(q) => q.warranty || '—'} />
                            <Row label="Valid until" quotations={quotations} render={(q) => formatDate(q.valid_until)} />
                            <Row label="Submitted" quotations={quotations} render={(q) => formatDate(q.submitted_at)} />
                            <Row label="Status" quotations={quotations} render={(q) => <StatusPill status={q.status} />} />

                            {rfq_items.map((item: any) => (
                                <Row
                                    key={item.rfq_item_id}
                                    label={`${item.name} (${item.quantity} ${item.unit})`}
                                    muted
                                    quotations={quotations}
                                    render={(q) => {
                                        const line = q.items.find((l: any) => l.rfq_item_id === item.rfq_item_id);
                                        return line ? formatMoney(line.unit_price_minor, q.currency) + ' / unit' : '—';
                                    }}
                                />
                            ))}

                            {!rfq.selected_vendor_id && can('VENDOR_SELECT') && (
                                <tr>
                                    <td className="td sticky left-0 z-10 bg-white" />
                                    {quotations.map((q: any) => (
                                        <td key={q.quotation_id} className="td">
                                            <button type="button" className="btn-primary h-9 w-full" onClick={() => setSelecting(q)}>
                                                <Check className="h-4 w-4" />
                                                Select
                                            </button>
                                        </td>
                                    ))}
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal
                open={!!selecting}
                onClose={() => setSelecting(null)}
                title={`Select ${selecting?.vendor_name}`}
                description="This locks the RFQ and lets you raise a purchase order against this quotation."
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setSelecting(null)}>
                            Cancel
                        </button>
                        <SubmitButton form="select-form" type="submit" busy={busy}>
                            Confirm selection
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="select-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        confirmSelection(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-[13px]">
                        <div className="flex justify-between">
                            <span className="text-muted">Quotation</span>
                            <span className="font-medium text-ink">{selecting?.quotation_number}</span>
                        </div>
                        <div className="mt-1 flex justify-between">
                            <span className="text-muted">Grand total</span>
                            <span className="font-semibold text-ink">
                                {selecting && formatMoney(selecting.grand_total_minor, selecting.currency)}
                            </span>
                        </div>
                    </div>
                    <Field label="Reason for selection" required>
                        <Select name="reason" options={REASONS} placeholder="Choose a reason" required />
                    </Field>
                    <Field label="Remarks">
                        <Textarea name="remarks" rows={3} placeholder="Recorded in the audit trail." />
                    </Field>
                </form>
            </Modal>

            <Modal
                open={creatingPo}
                onClose={() => setCreatingPo(false)}
                title="Create purchase order"
                description="Items and prices are taken from the selected quotation. You can review the PO before it is sent to the vendor."
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setCreatingPo(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="po-form" type="submit" busy={busy}>
                            Create purchase order
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="po-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        createPurchaseOrder(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    {selectedQuote && (
                        <div className="rounded-lg bg-slate-50 px-4 py-3 text-[13px]">
                            <div className="flex justify-between">
                                <span className="text-muted">Vendor</span>
                                <span className="font-medium text-ink">{selectedQuote.vendor_name}</span>
                            </div>
                            <div className="mt-1 flex justify-between">
                                <span className="text-muted">Quotation</span>
                                <span className="font-medium text-ink">{selectedQuote.quotation_number}</span>
                            </div>
                            <div className="mt-1 flex justify-between">
                                <span className="text-muted">Order value</span>
                                <span className="font-semibold text-ink">
                                    {formatMoney(selectedQuote.grand_total_minor, selectedQuote.currency)}
                                </span>
                            </div>
                        </div>
                    )}
                    <Field label="Delivery address">
                        <Textarea name="delivery_address" rows={2} defaultValue={rfq.delivery_location || ''} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Expected delivery date">
                            <Input
                                type="date"
                                name="expected_delivery_date"
                                defaultValue={rfq.expected_delivery_date ? String(rfq.expected_delivery_date).slice(0, 10) : ''}
                            />
                        </Field>
                        <Field label="Payment terms">
                            <Input name="payment_terms" defaultValue={selectedQuote?.payment_terms || ''} placeholder="e.g. 30 days after delivery" />
                        </Field>
                    </div>
                    <Field label="Notes for the vendor">
                        <Textarea name="notes" rows={2} />
                    </Field>
                </form>
            </Modal>
        </div>
    );
}

function BackLink({ rfqId }: { rfqId: string }) {
    return (
        <Link href={`/rfq/${rfqId}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to RFQ
        </Link>
    );
}

function Row({
    label,
    quotations,
    render,
    muted
}: {
    label: string;
    quotations: any[];
    render: (q: any) => React.ReactNode;
    muted?: boolean;
}) {
    return (
        <tr>
            <td className={`td sticky left-0 z-10 bg-white ${muted ? 'text-muted' : 'font-medium text-slate-700'}`}>{label}</td>
            {quotations.map((q) => (
                <td key={q.quotation_id} className="td">
                    {render(q)}
                </td>
            ))}
        </tr>
    );
}
