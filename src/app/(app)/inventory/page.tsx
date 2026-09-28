'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowDownUp, Boxes, Package, Plus } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import StatCard from '@/components/ui/StatCard';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList, useOptions } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';

type Item = {
    item_id: string;
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    min_stock: number;
    location: string | null;
    unit_cost_minor: number;
    stock_value_minor: number;
    stock_status: string;
};

const MOVEMENTS = [
    { value: 'stock_in', label: 'Stock in' },
    { value: 'stock_out', label: 'Stock out' },
    { value: 'return', label: 'Return' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'adjustment', label: 'Adjustment (set exact quantity)' }
];

export default function InventoryPage() {
    const { can } = useAuth();
    const toast = useToast();

    const [search, setSearch] = useState('');
    const [stockStatus, setStockStatus] = useState('');
    const debounced = useDebounced(search);

    const categories = useOptions('/procurement/categories/list', 'category_id');
    const list = useList<Item>('/procurement/inventory/list', {
        search: debounced,
        stock_status: stockStatus || undefined
    });

    const [addOpen, setAddOpen] = useState(false);
    const [moving, setMoving] = useState<Item | null>(null);
    const [busy, setBusy] = useState(false);

    const summary = list.meta?.summary ?? { total_items: 0, low_stock: 0, out_of_stock: 0 };

    async function createItem(form: FormData) {
        setBusy(true);
        try {
            await post('/procurement/inventory/create', {
                name: form.get('name'),
                sku: form.get('sku'),
                category_id: form.get('category_id'),
                location: form.get('location'),
                unit: form.get('unit'),
                opening_quantity: Number(form.get('opening_quantity') || 0),
                min_stock: Number(form.get('min_stock') || 0),
                unit_cost: form.get('unit_cost'),
                description: form.get('description')
            });
            toast.success('Item added');
            setAddOpen(false);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function move(form: FormData) {
        setBusy(true);
        try {
            await post('/procurement/inventory/move', {
                item_id: moving!.item_id,
                movement: form.get('movement'),
                quantity: Number(form.get('quantity')),
                reference: form.get('reference'),
                remarks: form.get('remarks')
            });
            toast.success('Stock updated');
            setMoving(null);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const columns: Column<Item>[] = [
        {
            key: 'name',
            header: 'Item',
            render: (i) => (
                <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-600">
                        <Package className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{i.name}</p>
                        <p className="truncate text-[12px] text-muted">{i.sku}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'quantity',
            header: 'On hand',
            align: 'right',
            render: (i) => (
                <div>
                    <p className="font-medium text-ink">
                        {i.quantity} {i.unit}
                    </p>
                    <p className="text-[11px] text-muted">min {i.min_stock}</p>
                </div>
            )
        },
        { key: 'location', header: 'Location' },
        {
            key: 'stock_value_minor',
            header: 'Stock value',
            align: 'right',
            render: (i) => formatMoney(i.stock_value_minor)
        },
        { key: 'stock_status', header: 'Status', render: (i) => <StatusPill status={i.stock_status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (i) =>
                can('INVENTORY_ADJUST') && (
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                        onClick={() => setMoving(i)}
                    >
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        Move stock
                    </button>
                )
        }
    ];

    return (
        <div>
            <PageHeader
                title="Inventory"
                subtitle="Every movement is written to a transaction ledger."
                action={
                    can('INVENTORY_CREATE') && (
                        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add Item
                        </button>
                    )
                }
            />

            <div className="mb-5 grid gap-4 sm:grid-cols-3">
                <StatCard icon={Boxes} tone="blue" label="Total items" value={summary.total_items} />
                <StatCard icon={AlertTriangle} tone="amber" label="Low stock" value={summary.low_stock} />
                <StatCard icon={AlertTriangle} tone="rose" label="Out of stock" value={summary.out_of_stock} />
            </div>

            <FilterBar search={search} onSearch={setSearch} placeholder="Search item or SKU...">
                <Select
                    className="w-44"
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value)}
                    options={[
                        { value: 'low_stock', label: 'Low stock' },
                        { value: 'out_of_stock', label: 'Out of stock' }
                    ]}
                    placeholder="All stock levels"
                    aria-label="Filter by stock level"
                />
            </FilterBar>

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(i) => i.item_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No inventory items"
                emptyHint="Add items to start tracking stock levels."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                title="Add inventory item"
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="item-form" type="submit" busy={busy}>
                            Add item
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="item-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        createItem(new FormData(e.currentTarget));
                    }}
                    className="grid gap-4 sm:grid-cols-2"
                >
                    <Field label="Item name" required>
                        <Input name="name" required autoFocus />
                    </Field>
                    <Field label="SKU" required>
                        <Input name="sku" required placeholder="LAP-001" />
                    </Field>
                    <Field label="Category">
                        <Select name="category_id" options={categories} placeholder="Select category" />
                    </Field>
                    <Field label="Location">
                        <Input name="location" placeholder="Store room A" />
                    </Field>
                    <Field label="Unit">
                        <Input name="unit" defaultValue="Nos" />
                    </Field>
                    <Field label="Opening quantity">
                        <Input name="opening_quantity" type="number" min="0" defaultValue="0" />
                    </Field>
                    <Field label="Minimum stock" hint="Below this the item is flagged as low stock.">
                        <Input name="min_stock" type="number" min="0" defaultValue="0" />
                    </Field>
                    <Field label="Unit cost">
                        <Input name="unit_cost" inputMode="decimal" placeholder="0.00" />
                    </Field>
                    <Field label="Description" className="sm:col-span-2">
                        <Textarea name="description" rows={2} />
                    </Field>
                </form>
            </Modal>

            <Modal
                open={!!moving}
                onClose={() => setMoving(null)}
                title={`Move stock — ${moving?.name}`}
                description={`Currently ${moving?.quantity} ${moving?.unit} on hand. Stock can never go negative.`}
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setMoving(null)}>
                            Cancel
                        </button>
                        <SubmitButton form="move-form" type="submit" busy={busy}>
                            Apply
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="move-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        move(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    <Field label="Movement" required>
                        <Select name="movement" options={MOVEMENTS} required defaultValue="stock_in" />
                    </Field>
                    <Field label="Quantity" required>
                        <Input name="quantity" type="number" min="1" required />
                    </Field>
                    <Field label="Reference">
                        <Input name="reference" placeholder="PO number, request id..." />
                    </Field>
                    <Field label="Remarks">
                        <Textarea name="remarks" rows={2} />
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
