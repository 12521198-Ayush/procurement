'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Upload, X } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

type TaxInvoice = {
    tax_invoice_id: string;
    po_id: string;
    po_number: string;
    vendor_name: string;
    invoice_number: string | null;
    invoice_date: string | null;
    amount_minor: number;
    currency: string;
    status: string;
    requested_at: string;
};

const TABS = [
    { value: '', label: 'All' },
    { value: 'requested', label: 'Requested' },
    { value: 'received', label: 'Received' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
];

export default function TaxInvoicesPage() {
    const { can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState('');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);

    const list = useList<TaxInvoice>('/procurement/tax-invoices/list', { status: tab || undefined, search: debounced });
    const [recording, setRecording] = useState<TaxInvoice | null>(null);
    const [busy, setBusy] = useState(false);

    const canAct = can('PAYMENT_CREATE');

    async function record(form: FormData) {
        setBusy(true);
        try {
            await post('/procurement/tax-invoices/record', {
                tax_invoice_id: recording!.tax_invoice_id,
                invoice_number: form.get('invoice_number'),
                invoice_date: form.get('invoice_date'),
                gst_number: form.get('gst_number'),
                subtotal: form.get('subtotal'),
                tax: form.get('tax')
            });
            toast.success('Tax invoice recorded');
            setRecording(null);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function review(invoice: TaxInvoice, action: 'approve' | 'reject') {
        try {
            await post('/procurement/tax-invoices/review', { tax_invoice_id: invoice.tax_invoice_id, action });
            toast.success(action === 'approve' ? 'Tax invoice approved — procurement complete' : 'Tax invoice rejected');
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const columns: Column<TaxInvoice>[] = [
        {
            key: 'invoice_number',
            header: 'Invoice',
            render: (t) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{t.invoice_number || 'Awaiting vendor'}</p>
                    <Link href={`/purchase-orders/${t.po_id}`} className="truncate text-[12px] text-brand-600 hover:underline">
                        {t.po_number}
                    </Link>
                </div>
            )
        },
        { key: 'vendor_name', header: 'Vendor' },
        {
            key: 'amount_minor',
            header: 'Amount',
            align: 'right',
            render: (t) => formatMoney(t.amount_minor, t.currency)
        },
        { key: 'requested_at', header: 'Requested', render: (t) => formatDate(t.requested_at) },
        { key: 'invoice_date', header: 'Invoice date', render: (t) => formatDate(t.invoice_date) },
        { key: 'status', header: 'Status', render: (t) => <StatusPill status={t.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (t) => {
                if (!canAct) return null;
                if (t.status === 'requested') {
                    return (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                            onClick={() => setRecording(t)}
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Record
                        </button>
                    );
                }
                if (t.status === 'received') {
                    return (
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                                onClick={() => review(t, 'approve')}
                            >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[13px] font-medium text-rose-600 hover:text-rose-700"
                                onClick={() => review(t, 'reject')}
                            >
                                <X className="h-3.5 w-3.5" />
                                Reject
                            </button>
                        </div>
                    );
                }
                return null;
            }
        }
    ];

    return (
        <div>
            <PageHeader
                title="Tax Invoices"
                subtitle="Requested automatically once a purchase order is fully paid."
            />

            <div className="mb-4">
                <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>

            <FilterBar search={search} onSearch={setSearch} placeholder="Search invoice, PO or vendor..." />

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(t) => t.tax_invoice_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No tax invoices yet"
                emptyHint="Once a purchase order is fully paid you can request its tax invoice."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal
                open={!!recording}
                onClose={() => setRecording(null)}
                title="Record tax invoice"
                description={`Details supplied by ${recording?.vendor_name} for ${recording?.po_number}.`}
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setRecording(null)}>
                            Cancel
                        </button>
                        <SubmitButton form="tax-form" type="submit" busy={busy}>
                            Save
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="tax-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        record(new FormData(e.currentTarget));
                    }}
                    className="grid gap-4 sm:grid-cols-2"
                >
                    <Field label="Invoice number" required>
                        <Input name="invoice_number" required autoFocus />
                    </Field>
                    <Field label="Invoice date">
                        <Input name="invoice_date" type="date" />
                    </Field>
                    <Field label="GST number">
                        <Input name="gst_number" />
                    </Field>
                    <Field label="Subtotal">
                        <Input name="subtotal" inputMode="decimal" />
                    </Field>
                    <Field label="Tax">
                        <Input name="tax" inputMode="decimal" />
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
