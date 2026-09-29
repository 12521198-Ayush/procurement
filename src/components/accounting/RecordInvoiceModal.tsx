'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { formatINR, recordVendorInvoice, type VendorInvoiceInput } from '@/lib/accounting';

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HSN_SAC = /^[0-9]{4,8}$/;
const PREMISE_GSTIN_KEY = 'pp_premise_gstin:';

const COMMON_SAC = [
    { code: '9985', label: 'Security & support services' },
    { code: '9987', label: 'Maintenance & repair' },
    { code: '9983', label: 'Professional & technical services' },
    { code: '9954', label: 'Construction services' },
    { code: '9997', label: 'Other services' }
];

type Form = Omit<VendorInvoiceInput, 'base_amount'> & { base_amount: string };

const EMPTY: Form = {
    vendor_name: '',
    vendor_gstin: '',
    premise_gst: '',
    invoice_number: '',
    hsn_sac_code: '',
    base_amount: '',
    expense_account_id: ''
};

function validate(f: Form) {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!f.vendor_name.trim()) e.vendor_name = 'Vendor name is required';
    if (!GSTIN.test(f.vendor_gstin)) e.vendor_gstin = 'Enter a valid 15-character GSTIN';
    if (!GSTIN.test(f.premise_gst)) e.premise_gst = 'Enter a valid 15-character GSTIN';
    if (!f.invoice_number.trim()) e.invoice_number = 'Invoice number is required';
    if (!HSN_SAC.test(f.hsn_sac_code)) e.hsn_sac_code = 'Use a 4 to 8 digit HSN/SAC code';
    if (!(Number(f.base_amount) > 0)) e.base_amount = 'Enter the taxable amount';
    if (!f.expense_account_id) e.expense_account_id = 'Choose the expense account';
    return e;
}

export default function RecordInvoiceModal({
    open,
    onClose,
    onRecorded,
    premiseId,
    expenseAccounts
}: {
    open: boolean;
    onClose: () => void;
    onRecorded: () => void;
    premiseId: string | null;
    expenseAccounts: { account_id: string; account_name: string }[];
}) {
    const toast = useToast();
    const [form, setForm] = useState<Form>(EMPTY);
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        const rememberedGstin = premiseId ? localStorage.getItem(PREMISE_GSTIN_KEY + premiseId) ?? '' : '';
        setForm({ ...EMPTY, premise_gst: rememberedGstin });
        setTouched(false);
    }, [open, premiseId]);

    const errors = useMemo(() => validate(form), [form]);
    const show = (k: keyof Form) => (touched ? errors[k] : undefined);

    const base = Number(form.base_amount) || 0;
    const sameState = form.vendor_gstin.length >= 2 && form.vendor_gstin.slice(0, 2) === form.premise_gst.slice(0, 2);
    const gst = Math.round(base * 0.18 * 100) / 100;

    function set<K extends keyof Form>(key: K, value: Form[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setTouched(true);
        if (Object.keys(errors).length || !premiseId) return;

        setBusy(true);
        try {
            await recordVendorInvoice(premiseId, {
                ...form,
                vendor_name: form.vendor_name.trim(),
                invoice_number: form.invoice_number.trim(),
                base_amount: Math.round(base * 100) / 100
            });
            localStorage.setItem(PREMISE_GSTIN_KEY + premiseId, form.premise_gst);
            toast.success(`Invoice ${form.invoice_number.trim()} recorded`);
            onRecorded();
            onClose();
        } catch (err: any) {
            toast.error(err?.message || 'Could not record the invoice');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            title="Record vendor invoice"
            description="Posts the bill to the ledger, accounts payable and GSTR-2B input credit."
            footer={
                <>
                    <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <SubmitButton type="submit" form="record-invoice" busy={busy}>
                        Record invoice
                    </SubmitButton>
                </>
            }
        >
            <form id="record-invoice" onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_240px]">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Vendor name" required error={show('vendor_name')} className="sm:col-span-2">
                        <Input value={form.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} placeholder="SecureCorp Guards Pvt Ltd" />
                    </Field>
                    <Field label="Vendor GSTIN" required error={show('vendor_gstin')}>
                        <Input
                            value={form.vendor_gstin}
                            maxLength={15}
                            onChange={(e) => set('vendor_gstin', e.target.value.toUpperCase().replace(/\s/g, ''))}
                            placeholder="06AABCS1234F1Z5"
                            className="font-mono"
                        />
                    </Field>
                    <Field label="Society GSTIN" required error={show('premise_gst')} hint="Remembered for next time">
                        <Input
                            value={form.premise_gst}
                            maxLength={15}
                            onChange={(e) => set('premise_gst', e.target.value.toUpperCase().replace(/\s/g, ''))}
                            placeholder="06AAACT9876E1Z2"
                            className="font-mono"
                        />
                    </Field>
                    <Field label="Invoice number" required error={show('invoice_number')}>
                        <Input value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} placeholder="SEC-2026-09-102" />
                    </Field>
                    <Field label="HSN / SAC code" required error={show('hsn_sac_code')}>
                        <Input
                            value={form.hsn_sac_code}
                            inputMode="numeric"
                            list="common-sac"
                            maxLength={8}
                            onChange={(e) => set('hsn_sac_code', e.target.value.replace(/\D/g, ''))}
                            placeholder="9985"
                        />
                        <datalist id="common-sac">
                            {COMMON_SAC.map((s) => (
                                <option key={s.code} value={s.code}>
                                    {s.label}
                                </option>
                            ))}
                        </datalist>
                    </Field>
                    <Field label="Taxable amount (₹)" required error={show('base_amount')}>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={form.base_amount}
                            onChange={(e) => set('base_amount', e.target.value)}
                            placeholder="50000.00"
                        />
                    </Field>
                    <Field label="Expense account" required error={show('expense_account_id')}>
                        <Select
                            value={form.expense_account_id}
                            onChange={(e) => set('expense_account_id', e.target.value)}
                            placeholder="Select account"
                            options={expenseAccounts.map((a) => ({ value: a.account_id, label: `${a.account_id} · ${a.account_name}` }))}
                        />
                    </Field>
                </div>

                <aside className="h-fit rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 p-4 text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estimate</p>
                    <dl className="mt-3 space-y-2 text-[12px]">
                        <Row label="Taxable value" value={formatINR(base)} />
                        {sameState || !form.vendor_gstin ? (
                            <>
                                <Row label="CGST @ 9%" value={formatINR(gst / 2)} />
                                <Row label="SGST @ 9%" value={formatINR(gst / 2)} />
                            </>
                        ) : (
                            <Row label="IGST @ 18%" value={formatINR(gst)} />
                        )}
                    </dl>
                    <div className="mt-3 border-t border-white/15 pt-3">
                        <p className="text-[11px] text-slate-400">Payable to vendor</p>
                        <p className="text-xl font-semibold tracking-tight">{formatINR(base + gst)}</p>
                    </div>
                    <p className="mt-3 flex gap-1.5 text-[10px] leading-relaxed text-slate-400">
                        <Info className="mt-px h-3 w-3 shrink-0" />
                        Assumes 18% GST. The accounts service calculates the final tax.
                    </p>
                </aside>
            </form>
        </Modal>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-300">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
        </div>
    );
}
