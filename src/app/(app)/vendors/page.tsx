'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Eye, Plus } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList, useOptions } from '@/lib/hooks';

type Vendor = {
    vendor_id: string;
    company_name: string;
    contact_person: string;
    email: string;
    mobile: string;
    city: string | null;
    gst_number: string | null;
    status: string;
    categories: { category_id: string; name: string }[];
};

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'pending', label: 'Pending' }
];

export default function VendorsPage() {
    const { can } = useAuth();
    const toast = useToast();

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const debounced = useDebounced(search);

    const categories = useOptions('/procurement/categories/list', 'category_id');
    const list = useList<Vendor>('/procurement/vendors/list', {
        search: debounced,
        status: status || undefined,
        category_id: categoryId || undefined
    });

    const [editing, setEditing] = useState<Vendor | null>(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    function openCreate() {
        setEditing(null);
        setOpen(true);
    }

    function openEdit(vendor: Vendor) {
        setEditing(vendor);
        setOpen(true);
    }

    async function save(form: FormData) {
        setBusy(true);
        try {
            const payload: Record<string, unknown> = {
                company_name: form.get('company_name'),
                contact_person: form.get('contact_person'),
                email: form.get('email'),
                mobile: form.get('mobile'),
                address: form.get('address'),
                city: form.get('city'),
                state: form.get('state'),
                gst_number: form.get('gst_number'),
                pan_number: form.get('pan_number'),
                bank_name: form.get('bank_name'),
                bank_account_number: form.get('bank_account_number'),
                bank_ifsc: form.get('bank_ifsc'),
                notes: form.get('notes'),
                category_ids: form.getAll('category_ids')
            };

            if (editing) {
                await post('/procurement/vendors/update', { ...payload, vendor_id: editing.vendor_id });
                toast.success('Vendor updated');
            } else {
                await post('/procurement/vendors/create', payload);
                toast.success('Vendor added');
            }
            setOpen(false);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function changeStatus(vendor: Vendor, next: string) {
        try {
            await post('/procurement/vendors/status', { vendor_id: vendor.vendor_id, status: next });
            toast.success(`${vendor.company_name} is now ${next}`);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const columns: Column<Vendor>[] = [
        {
            key: 'company_name',
            header: 'Vendor',
            render: (v) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{v.company_name}</p>
                    <p className="truncate text-[12px] text-muted">{v.contact_person}</p>
                </div>
            )
        },
        {
            key: 'email',
            header: 'Contact',
            render: (v) => (
                <div className="min-w-0">
                    <p className="truncate">{v.email}</p>
                    <p className="text-[12px] text-muted">{formatMobile(v.mobile)}</p>
                </div>
            )
        },
        {
            key: 'categories',
            header: 'Categories',
            render: (v) =>
                v.categories?.length ? (
                    <div className="flex flex-wrap gap-1">
                        {v.categories.slice(0, 2).map((c) => (
                            <span key={c.category_id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {c.name}
                            </span>
                        ))}
                        {v.categories.length > 2 && (
                            <span className="text-[11px] text-slate-400">+{v.categories.length - 2}</span>
                        )}
                    </div>
                ) : (
                    <span className="text-slate-400">—</span>
                )
        },
        { key: 'city', header: 'City' },
        { key: 'gst_number', header: 'GST' },
        { key: 'status', header: 'Status', render: (v) => <StatusPill status={v.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (v) => (
                <div className="flex items-center justify-end gap-1">
                    <Link
                        href={`/vendors/${v.vendor_id}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`View ${v.company_name}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Eye className="h-4 w-4" />
                    </Link>
                    {can('VENDOR_EDIT') && (
                        <select
                            className="h-8 rounded-lg border border-line bg-white px-2 text-[12px] text-slate-600"
                            value={v.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => changeStatus(v, e.target.value)}
                            aria-label={`Status for ${v.company_name}`}
                        >
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )
        }
    ];

    return (
        <div>
            <PageHeader
                title="Vendors"
                subtitle="Suppliers you can invite to quote."
                action={
                    can('VENDOR_CREATE') && (
                        <button type="button" className="btn-primary" onClick={openCreate}>
                            <Plus className="h-4 w-4" />
                            Add Vendor
                        </button>
                    )
                }
            />

            <FilterBar search={search} onSearch={setSearch} placeholder="Search vendor, email or GST...">
                <Select
                    className="w-40"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    options={STATUS_OPTIONS}
                    placeholder="All statuses"
                    aria-label="Filter by status"
                />
                <Select
                    className="w-48"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    options={categories}
                    placeholder="All categories"
                    aria-label="Filter by category"
                />
            </FilterBar>

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(v) => v.vendor_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No vendors yet"
                emptyHint="Add your first vendor to start raising RFQs."
                onRowClick={can('VENDOR_EDIT') ? openEdit : undefined}
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={editing ? 'Edit vendor' : 'Add vendor'}
                description="Vendors receive RFQ links by email and their passcode by SMS, so both must be correct."
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="vendor-form" type="submit" busy={busy}>
                            {editing ? 'Save changes' : 'Add vendor'}
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="vendor-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save(new FormData(e.currentTarget));
                    }}
                    className="grid gap-4 sm:grid-cols-2"
                >
                    <Field label="Company name" required>
                        <Input name="company_name" defaultValue={editing?.company_name} required />
                    </Field>
                    <Field label="Contact person" required>
                        <Input name="contact_person" defaultValue={editing?.contact_person} required />
                    </Field>
                    <Field label="Email" required hint="RFQ invitations are sent here.">
                        <Input name="email" type="email" defaultValue={editing?.email} required />
                    </Field>
                    <Field label="Mobile" required hint="Used for the one-time passcode.">
                        <Input name="mobile" defaultValue={editing ? stripPrefix(editing.mobile) : ''} required />
                    </Field>
                    <Field label="Address" className="sm:col-span-2">
                        <Input name="address" />
                    </Field>
                    <Field label="City">
                        <Input name="city" defaultValue={editing?.city ?? ''} />
                    </Field>
                    <Field label="State">
                        <Input name="state" />
                    </Field>
                    <Field label="GST number">
                        <Input name="gst_number" defaultValue={editing?.gst_number ?? ''} />
                    </Field>
                    <Field label="PAN">
                        <Input name="pan_number" />
                    </Field>
                    <Field label="Bank name">
                        <Input name="bank_name" />
                    </Field>
                    <Field label="Account number">
                        <Input name="bank_account_number" />
                    </Field>
                    <Field label="IFSC">
                        <Input name="bank_ifsc" />
                    </Field>
                    <Field label="Categories" className="sm:col-span-2">
                        <div className="flex flex-wrap gap-2 rounded-lg border border-line p-3">
                            {categories.length ? (
                                categories.map((c) => (
                                    <label
                                        key={c.value}
                                        className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-700"
                                    >
                                        <input
                                            type="checkbox"
                                            name="category_ids"
                                            value={c.value}
                                            defaultChecked={editing?.categories?.some((x) => x.category_id === c.value)}
                                            className="h-3.5 w-3.5 rounded border-line text-brand-600"
                                        />
                                        {c.label}
                                    </label>
                                ))
                            ) : (
                                <p className="text-[12px] text-slate-400">
                                    No categories yet — create them under Categories first.
                                </p>
                            )}
                        </div>
                    </Field>
                    <Field label="Notes" className="sm:col-span-2">
                        <Textarea name="notes" rows={2} />
                    </Field>
                </form>
            </Modal>
        </div>
    );
}

function stripPrefix(mobile: string) {
    return String(mobile || '').replace(/^000?91/, '');
}

function formatMobile(mobile: string) {
    const digits = stripPrefix(mobile);
    return digits ? '+91 ' + digits : '—';
}
