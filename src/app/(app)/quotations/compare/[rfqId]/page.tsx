'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Award, Check, Handshake, ShoppingCart, Timer } from 'lucide-react';
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
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

const TERMS = [
    { value: 'price', label: 'Price' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'payment_terms', label: 'Payment terms' },
    { value: 'warranty', label: 'Warranty' },
    { value: 'validity', label: 'Validity' }
];

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
    const [negotiating, setNegotiating] = useState(false);
    const [roundVendors, setRoundVendors] = useState<string[]>([]);
    const [roundTerms, setRoundTerms] = useState<string[]>(TERMS.map((t) => t.value));
    const [busy, setBusy] = useState(false);

    async function startRound(form: FormData) {
        setBusy(true);
        try {
            const date = String(form.get('deadline_date') || '');
            const time = String(form.get('deadline_time') || '17:00');
            const res = await post('/procurement/negotiation/start', {
                rfq_id: rfqId,
                vendor_ids: roundVendors,
                deadline: date ? new Date(`${date}T${time}`).toISOString() : undefined,
                negotiable_terms: roundTerms,
                message: form.get('message') || undefined
            });
            toast.success(`Round ${res.round_no} started - ${res.vendors.length} vendor(s) invited to revise`);
            setNegotiating(false);
            reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function closeRound() {
        setBusy(true);
        try {
            await post('/procurement/negotiation/close', { rfq_id: rfqId });
            toast.success('Negotiation round closed');
            reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

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
                    ? `${po.po_number} exceeds its budget and is waiting for a Procurement Admin's approval`
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
    const negotiation = data.negotiation ?? { open_round: null, rounds: [], can_start: false };
    const openRound = negotiation.open_round;
    const roundEntry = (q: any) => openRound?.vendors?.find((v: any) => v.vendor_id === q.vendor_id);
    const canNegotiate = can('BID_NEGOTIATE');

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
                action={
                    negotiation.can_start &&
                    canNegotiate && (
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                                setRoundVendors(quotations.filter((q: any) => q.status === 'submitted').map((q: any) => q.vendor_id));
                                setNegotiating(true);
                            }}
                        >
                            <Handshake className="h-4 w-4" />
                            {`Negotiate - start round ${(rfq.current_round || 1) + 1}`}
                        </button>
                    )
                }
            />

            {openRound && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
                    <div className="flex items-start gap-2">
                        <Timer className="mt-0.5 h-4 w-4" />
                        <div>
                            <p className="font-medium">
                                Negotiation round {openRound.round_no} is open until {formatDateTime(openRound.deadline)}
                            </p>
                            <p className="mt-0.5">
                                {openRound.vendors.filter((v: any) => v.status === 'responded').length} of {openRound.vendors.length} shortlisted vendor(s) have revised their offer. A vendor can be selected once the round closes.
                            </p>
                        </div>
                    </div>
                    {canNegotiate && (
                        <button type="button" className="btn-ghost h-9 bg-white" onClick={closeRound} disabled={busy}>
                            Close round now
                        </button>
                    )}
                </div>
            )}

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
                                                {(q.round_no || 1) > 1 ? ` · round ${q.round_no} offer` : ''}
                                            </span>
                                            {q.is_lowest && (
                                                <span className="inline-flex w-fit rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium normal-case text-emerald-700">
                                                    Lowest total
                                                </span>
                                            )}
                                            {roundEntry(q) && (
                                                <span className="w-fit">
                                                    <StatusPill status={roundEntry(q).status} className="px-1.5 py-0.5 text-[10px] normal-case" />
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
                                        {q.original_total_minor != null && q.original_total_minor !== q.grand_total_minor && (
                                            <span className="block text-[11px] font-normal text-emerald-700">
                                                was {formatMoney(q.original_total_minor, q.currency)} (
                                                {(((q.original_total_minor - q.grand_total_minor) / q.original_total_minor) * 100).toFixed(1)}% saved)
                                            </span>
                                        )}
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

                            {!rfq.selected_vendor_id && !openRound && can('VENDOR_SELECT') && (
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

            {negotiation.rounds.length > 0 && (
                <Card className="mt-5">
                    <h3 className="mb-3 text-[14px] font-semibold text-ink">Negotiation history</h3>
                    <div className="space-y-4">
                        {negotiation.rounds.map((r: any) => (
                            <div key={r.round_id} className="overflow-x-auto rounded-lg border border-line">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50 px-4 py-2.5 text-[13px]">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-ink">Round {r.round_no}</span>
                                        <StatusPill status={r.status} />
                                    </div>
                                    <span className="text-muted">
                                        Started {formatDateTime(r.created_at)} by {r.created_by_name} · deadline {formatDateTime(r.deadline)}
                                        {r.closed_at ? ` · closed ${formatDateTime(r.closed_at)} (${r.close_reason})` : ''}
                                    </span>
                                </div>
                                {r.message && <p className="px-4 pt-2.5 text-[12px] text-slate-600">Message to vendors: {r.message}</p>}
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th className="th">Vendor</th>
                                            <th className="th text-right">Before</th>
                                            <th className="th text-right">Revised</th>
                                            <th className="th text-right">Change</th>
                                            <th className="th">Response</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {r.vendors.map((v: any) => (
                                            <tr key={v.vendor_id}>
                                                <td className="td font-medium text-ink">{v.vendor_name}</td>
                                                <td className="td text-right">{formatMoney(v.previous_total_minor, r.currency)}</td>
                                                <td className="td text-right">{v.revised_total_minor != null ? formatMoney(v.revised_total_minor, r.currency) : '—'}</td>
                                                <td className="td text-right">
                                                    {v.revised_total_minor != null ? (
                                                        <span className={v.revised_total_minor <= v.previous_total_minor ? 'text-emerald-700' : 'text-rose-600'}>
                                                            {formatMoney(v.revised_total_minor - v.previous_total_minor, r.currency)}
                                                        </span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="td">
                                                    <StatusPill status={v.status} />
                                                    {v.responded_at && <span className="ml-2 text-[11px] text-muted">{formatDateTime(v.responded_at)}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Modal
                open={negotiating}
                onClose={() => setNegotiating(false)}
                size="lg"
                title={`Start negotiation round ${(rfq.current_round || 1) + 1}`}
                description="Shortlisted vendors get a fresh link (and a portal notification) to revise their offer by the deadline. Silent vendors keep their current offer."
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setNegotiating(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="round-form" type="submit" busy={busy} disabled={!roundVendors.length || !roundTerms.length}>
                            Invite {roundVendors.length} vendor(s)
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="round-form"
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        startRound(new FormData(e.currentTarget));
                    }}
                >
                    <div>
                        <p className="field-label">Vendors in this round</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {quotations
                                .filter((q: any) => q.status === 'submitted')
                                .map((q: any) => {
                                    const checked = roundVendors.includes(q.vendor_id);
                                    return (
                                        <label key={q.vendor_id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${checked ? 'border-brand-500 bg-brand-50/40' : 'border-line hover:bg-slate-50'}`}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => setRoundVendors(e.target.checked ? [...roundVendors, q.vendor_id] : roundVendors.filter((x) => x !== q.vendor_id))}
                                                className="mt-0.5 h-4 w-4 rounded border-line text-brand-600"
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13px] font-medium text-ink">{q.vendor_name}</span>
                                                <span className="block text-[12px] text-muted">Current offer {formatMoney(q.grand_total_minor, q.currency)}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                        </div>
                    </div>
                    <div>
                        <p className="field-label">Terms open for revision</p>
                        <div className="flex flex-wrap gap-3">
                            {TERMS.map((t) => (
                                <label key={t.value} className="flex items-center gap-2 text-[13px] text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={roundTerms.includes(t.value)}
                                        onChange={(e) => setRoundTerms(e.target.checked ? [...roundTerms, t.value] : roundTerms.filter((x) => x !== t.value))}
                                        className="h-4 w-4 rounded border-line text-brand-600"
                                    />
                                    {t.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Respond by (date)" required>
                            <Input type="date" name="deadline_date" required min={new Date().toISOString().slice(0, 10)} />
                        </Field>
                        <Field label="Respond by (time)" required hint="Enforced on the server.">
                            <Input type="time" name="deadline_time" defaultValue="17:00" required />
                        </Field>
                    </div>
                    <Field label="Message to vendors" hint="Included in the email. Do not disclose competitors' prices.">
                        <Textarea name="message" rows={3} placeholder="e.g. Please share your best and final price and earliest delivery date." />
                    </Field>
                </form>
            </Modal>

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
                    {selectedQuote && creatingPo && <BudgetPreview rfqId={rfqId} amountMinor={selectedQuote.grand_total_minor} />}
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

function BudgetPreview({ rfqId, amountMinor }: { rfqId: string; amountMinor: number }) {
    const { data } = useResource<any>('/procurement/budgets/check', { rfq_id: rfqId, amount: (amountMinor / 100).toFixed(2) });
    if (!data) return null;
    if (data.status === 'no_budget') {
        return <p className="rounded-lg bg-slate-50 px-4 py-3 text-[12px] text-muted">No budget is allocated for this purchase.</p>;
    }
    if (data.status === 'exceeded') {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                <p className="font-medium">Exceeds the {data.budget_label} budget by {formatMoney(data.shortfall_minor)}</p>
                <p className="mt-0.5 text-[12px]">
                    Remaining {formatMoney(data.remaining_minor)} of {formatMoney(data.allocated_minor)}. The order will be held until a Procurement Admin approves it; approval raises the budget by the shortfall.
                </p>
            </div>
        );
    }
    return (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
            Within the {data.budget_label} budget - {formatMoney(data.remaining_minor)} remaining before this order.
        </p>
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
