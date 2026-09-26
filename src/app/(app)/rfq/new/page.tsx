'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/Card';
import { Stepper } from '@/components/ui/Tabs';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useList, useOptions } from '@/lib/hooks';
import { formatDateTime } from '@/lib/format';

type Item = {
    key: string;
    name: string;
    specification: string;
    quantity: string;
    unit: string;
    required_date: string;
};

const STEPS = ['Basic Details', 'Items', 'Vendors', 'Expiry & Terms', 'Review & Send'];

function blankItem(): Item {
    return { key: Math.random().toString(36).slice(2), name: '', specification: '', quantity: '1', unit: 'Nos', required_date: '' };
}

export default function NewRfqPage() {
    const router = useRouter();
    const toast = useToast();

    const [step, setStep] = useState(1);
    const [busy, setBusy] = useState(false);

    const departments = useOptions('/procurement/departments/list', 'department_id');
    const categories = useOptions('/procurement/categories/list', 'category_id');
    const vendorList = useList<any>('/procurement/vendors/list', { status: 'active' }, { limit: 200 });

    const [basic, setBasic] = useState({
        title: '',
        description: '',
        department_id: '',
        category_id: '',
        delivery_location: '',
        expected_delivery_date: ''
    });
    const [items, setItems] = useState<Item[]>([blankItem()]);
    const [vendorIds, setVendorIds] = useState<string[]>([]);
    const [terms, setTerms] = useState({ expires_date: '', expires_time: '17:00', terms_and_conditions: '', notes: '' });

    const expiresAt = useMemo(() => {
        if (!terms.expires_date) return null;
        // Interpreted in the browser's zone; the server stores UTC and enforces it.
        return new Date(`${terms.expires_date}T${terms.expires_time || '17:00'}`);
    }, [terms.expires_date, terms.expires_time]);

    const stepErrors = useMemo(() => {
        if (step === 1 && !basic.title.trim()) return 'Give the RFQ a title.';
        if (step === 2) {
            if (!items.length) return 'Add at least one item.';
            const bad = items.find((i) => !i.name.trim() || !(Number(i.quantity) > 0));
            if (bad) return 'Every item needs a name and a quantity greater than zero.';
        }
        if (step === 3 && !vendorIds.length) return 'Select at least one vendor.';
        if (step === 4) {
            if (!expiresAt) return 'Set the bid expiry date.';
            if (expiresAt <= new Date()) return 'Expiry must be in the future.';
        }
        return null;
    }, [step, basic.title, items, vendorIds, expiresAt]);

    function next() {
        if (stepErrors) {
            toast.error(stepErrors);
            return;
        }
        setStep((s) => Math.min(s + 1, STEPS.length));
    }

    async function submit(sendNow: boolean) {
        if (stepErrors) {
            toast.error(stepErrors);
            return;
        }
        setBusy(true);
        try {
            const created = await post('/procurement/rfq/create', {
                ...basic,
                expires_at: expiresAt?.toISOString(),
                terms_and_conditions: terms.terms_and_conditions,
                notes: terms.notes,
                vendor_ids: vendorIds,
                items: items.map((i) => ({
                    name: i.name,
                    specification: i.specification,
                    quantity: Number(i.quantity),
                    unit: i.unit,
                    required_date: i.required_date || null
                }))
            });

            if (sendNow) {
                const result = await post('/procurement/rfq/send', { rfq_id: created.rfq_id });
                toast.success(`RFQ sent to ${result.dispatched.length} vendor(s)`);
            } else {
                toast.success('RFQ saved as draft');
            }
            router.push(`/rfq/${created.rfq_id}`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const selectedVendors = vendorList.rows.filter((v) => vendorIds.includes(v.vendor_id));

    return (
        <div>
            <Link href="/rfq" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
                <ArrowLeft className="h-4 w-4" />
                Back to RFQs
            </Link>

            <PageHeader title="Raise Bid / RFQ" subtitle="Vendors receive a unique, single-use link by email." />

            <Card className="mb-5">
                <Stepper steps={STEPS} current={step} />
            </Card>

            <Card>
                {step === 1 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Title" required className="sm:col-span-2">
                            <Input
                                value={basic.title}
                                onChange={(e) => setBasic({ ...basic, title: e.target.value })}
                                placeholder="e.g. Laptops and monitors for the IT team"
                                autoFocus
                            />
                        </Field>
                        <Field label="Description" className="sm:col-span-2">
                            <Textarea
                                rows={3}
                                value={basic.description}
                                onChange={(e) => setBasic({ ...basic, description: e.target.value })}
                            />
                        </Field>
                        <Field label="Department">
                            <Select
                                value={basic.department_id}
                                onChange={(e) => setBasic({ ...basic, department_id: e.target.value })}
                                options={departments}
                                placeholder="Select department"
                            />
                        </Field>
                        <Field label="Category">
                            <Select
                                value={basic.category_id}
                                onChange={(e) => setBasic({ ...basic, category_id: e.target.value })}
                                options={categories}
                                placeholder="Select category"
                            />
                        </Field>
                        <Field label="Delivery location">
                            <Input
                                value={basic.delivery_location}
                                onChange={(e) => setBasic({ ...basic, delivery_location: e.target.value })}
                            />
                        </Field>
                        <Field label="Expected delivery date">
                            <Input
                                type="date"
                                value={basic.expected_delivery_date}
                                onChange={(e) => setBasic({ ...basic, expected_delivery_date: e.target.value })}
                            />
                        </Field>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-3">
                        {items.map((item, index) => (
                            <div key={item.key} className="rounded-xl border border-line p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-[13px] font-semibold text-ink">Item {index + 1}</span>
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setItems(items.filter((x) => x.key !== item.key))}
                                            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                            aria-label={`Remove item ${index + 1}`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-4">
                                    <Field label="Item name" required className="sm:col-span-2">
                                        <Input
                                            value={item.name}
                                            onChange={(e) => updateItem(item.key, { name: e.target.value })}
                                            placeholder="Laptop"
                                        />
                                    </Field>
                                    <Field label="Quantity" required>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                                        />
                                    </Field>
                                    <Field label="Unit">
                                        <Input value={item.unit} onChange={(e) => updateItem(item.key, { unit: e.target.value })} />
                                    </Field>
                                    <Field label="Specification" className="sm:col-span-3">
                                        <Input
                                            value={item.specification}
                                            onChange={(e) => updateItem(item.key, { specification: e.target.value })}
                                            placeholder="i7 / 16GB / 512GB SSD"
                                        />
                                    </Field>
                                    <Field label="Required by">
                                        <Input
                                            type="date"
                                            value={item.required_date}
                                            onChange={(e) => updateItem(item.key, { required_date: e.target.value })}
                                        />
                                    </Field>
                                </div>
                            </div>
                        ))}
                        <button type="button" className="btn-ghost" onClick={() => setItems([...items, blankItem()])}>
                            <Plus className="h-4 w-4" />
                            Add item
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div>
                        <p className="mb-3 text-[13px] text-muted">
                            Only active vendors can be invited. Each one gets their own link, so every quotation is
                            traceable back to the vendor we invited.
                        </p>
                        {vendorList.loading ? (
                            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
                        ) : vendorList.rows.length ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {vendorList.rows.map((v) => {
                                    const checked = vendorIds.includes(v.vendor_id);
                                    return (
                                        <label
                                            key={v.vendor_id}
                                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                                checked ? 'border-brand-500 bg-brand-50/40' : 'border-line hover:bg-slate-50'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) =>
                                                    setVendorIds(
                                                        e.target.checked
                                                            ? [...vendorIds, v.vendor_id]
                                                            : vendorIds.filter((x) => x !== v.vendor_id)
                                                    )
                                                }
                                                className="mt-0.5 h-4 w-4 rounded border-line text-brand-600"
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13px] font-medium text-ink">
                                                    {v.company_name}
                                                </span>
                                                <span className="block truncate text-[11px] text-muted">{v.email}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState title="No active vendors" hint="Add vendors before raising an RFQ." />
                        )}
                    </div>
                )}

                {step === 4 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Bid expiry date" required>
                            <Input
                                type="date"
                                value={terms.expires_date}
                                onChange={(e) => setTerms({ ...terms, expires_date: e.target.value })}
                            />
                        </Field>
                        <Field label="Bid expiry time" required hint="Enforced on the server, not in the browser.">
                            <Input
                                type="time"
                                value={terms.expires_time}
                                onChange={(e) => setTerms({ ...terms, expires_time: e.target.value })}
                            />
                        </Field>
                        <Field label="Terms and conditions" className="sm:col-span-2">
                            <Textarea
                                rows={4}
                                value={terms.terms_and_conditions}
                                onChange={(e) => setTerms({ ...terms, terms_and_conditions: e.target.value })}
                            />
                        </Field>
                        <Field label="Internal notes" className="sm:col-span-2" hint="Not shared with vendors.">
                            <Textarea rows={2} value={terms.notes} onChange={(e) => setTerms({ ...terms, notes: e.target.value })} />
                        </Field>
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-5">
                        <Section title="Basic details">
                            <Detail label="Title" value={basic.title} />
                            <Detail label="Department" value={labelFor(departments, basic.department_id)} />
                            <Detail label="Category" value={labelFor(categories, basic.category_id)} />
                            <Detail label="Delivery location" value={basic.delivery_location} />
                        </Section>

                        <Section title={`Items (${items.length})`}>
                            <div className="col-span-2 overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead>
                                        <tr className="border-b border-line text-left text-[11px] uppercase text-muted">
                                            <th className="py-2">Item</th>
                                            <th className="py-2">Specification</th>
                                            <th className="py-2 text-right">Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {items.map((i) => (
                                            <tr key={i.key}>
                                                <td className="py-2 font-medium text-ink">{i.name}</td>
                                                <td className="py-2 text-muted">{i.specification || '—'}</td>
                                                <td className="py-2 text-right">
                                                    {i.quantity} {i.unit}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Section>

                        <Section title={`Vendors (${selectedVendors.length})`}>
                            <div className="col-span-2 flex flex-wrap gap-1.5">
                                {selectedVendors.map((v) => (
                                    <span key={v.vendor_id} className="rounded-md bg-slate-100 px-2.5 py-1 text-[12px] text-slate-700">
                                        {v.company_name}
                                    </span>
                                ))}
                            </div>
                        </Section>

                        <Section title="Expiry">
                            <Detail label="Closes at" value={expiresAt ? formatDateTime(expiresAt) : '—'} />
                        </Section>
                    </div>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                    <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setStep((s) => Math.max(s - 1, 1))}
                        disabled={step === 1 || busy}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    {step < STEPS.length ? (
                        <button type="button" className="btn-primary" onClick={next}>
                            Continue
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button type="button" className="btn-ghost" onClick={() => submit(false)} disabled={busy}>
                                Save as draft
                            </button>
                            <button type="button" className="btn-primary" onClick={() => submit(true)} disabled={busy}>
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Send to vendors
                            </button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );

    function updateItem(key: string, patch: Partial<Item>) {
        setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="mb-2 text-[13px] font-semibold text-ink">{title}</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">{children}</dl>
        </div>
    );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return (
        <>
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium text-ink">{value || '—'}</dd>
        </>
    );
}

function labelFor(options: { value: string; label: string }[], value: string) {
    return options.find((o) => o.value === value)?.label ?? '';
}
