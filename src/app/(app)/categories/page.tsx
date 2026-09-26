'use client';

import { useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';

type Category = {
    category_id: string;
    name: string;
    description: string | null;
    vendor_count: number;
    is_active: string;
};

export default function CategoriesPage() {
    const { can } = useAuth();
    const toast = useToast();

    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const list = useList<Category>('/procurement/categories/list', { search: debounced });

    const [editing, setEditing] = useState<Category | null>(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const canEdit = can('SETTINGS_EDIT');

    async function save(form: FormData) {
        setBusy(true);
        try {
            const payload = { name: form.get('name'), description: form.get('description') };
            if (editing) {
                await post('/procurement/categories/update', { ...payload, category_id: editing.category_id });
                toast.success('Category updated');
            } else {
                await post('/procurement/categories/create', payload);
                toast.success('Category created');
            }
            setOpen(false);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function toggle(category: Category) {
        try {
            await post('/procurement/categories/update', {
                category_id: category.category_id,
                is_active: category.is_active === 'yes' ? 'no' : 'yes'
            });
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const columns: Column<Category>[] = [
        {
            key: 'name',
            header: 'Category',
            render: (c) => (
                <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600">
                        <Tags className="h-4 w-4" />
                    </span>
                    <span className="font-medium text-ink">{c.name}</span>
                </div>
            )
        },
        { key: 'description', header: 'Description' },
        { key: 'vendor_count', header: 'Vendors', align: 'center' },
        {
            key: 'is_active',
            header: 'Status',
            render: (c) => <StatusPill status={c.is_active === 'yes' ? 'active' : 'inactive'} />
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (c) =>
                canEdit && (
                    <button
                        type="button"
                        className="text-[13px] font-medium text-brand-600 hover:text-brand-700"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggle(c);
                        }}
                    >
                        {c.is_active === 'yes' ? 'Deactivate' : 'Activate'}
                    </button>
                )
        }
    ];

    return (
        <div>
            <PageHeader
                title="Categories"
                subtitle="Group vendors and spend so reports stay meaningful."
                action={
                    canEdit && (
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => {
                                setEditing(null);
                                setOpen(true);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            Add Category
                        </button>
                    )
                }
            />

            <FilterBar search={search} onSearch={setSearch} placeholder="Search categories..." />

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(c) => c.category_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No categories yet"
                emptyHint="Categories like 'IT Hardware' or 'Services' help you filter vendors and reports."
                onRowClick={
                    canEdit
                        ? (c) => {
                              setEditing(c);
                              setOpen(true);
                          }
                        : undefined
                }
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={editing ? 'Edit category' : 'Add category'}
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="category-form" type="submit" busy={busy}>
                            Save
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="category-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    <Field label="Name" required>
                        <Input name="name" defaultValue={editing?.name} required autoFocus />
                    </Field>
                    <Field label="Description">
                        <Textarea name="description" rows={3} defaultValue={editing?.description ?? ''} />
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
