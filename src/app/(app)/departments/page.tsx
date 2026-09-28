'use client';

import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';

type Department = {
    department_id: string;
    name: string;
    manager_name: string | null;
    manager_email: string | null;
    is_active: string;
};

export default function DepartmentsPage() {
    const { can } = useAuth();
    const toast = useToast();

    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const list = useList<Department>('/procurement/departments/list', { search: debounced });

    const [editing, setEditing] = useState<Department | null>(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const canEdit = can('SETTINGS_EDIT');

    async function save(form: FormData) {
        setBusy(true);
        try {
            const payload = {
                name: form.get('name'),
                manager_name: form.get('manager_name'),
                manager_email: form.get('manager_email'),
                description: form.get('description')
            };
            if (editing) {
                await post('/procurement/departments/update', { ...payload, department_id: editing.department_id });
                toast.success('Department updated');
            } else {
                await post('/procurement/departments/create', payload);
                toast.success('Department created');
            }
            setOpen(false);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const columns: Column<Department>[] = [
        {
            key: 'name',
            header: 'Department',
            render: (d) => (
                <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <Building2 className="h-4 w-4" />
                    </span>
                    <span className="font-medium text-ink">{d.name}</span>
                </div>
            )
        },
        { key: 'manager_name', header: 'Manager' },
        { key: 'manager_email', header: 'Manager email' },
        {
            key: 'is_active',
            header: 'Status',
            render: (d) => <StatusPill status={d.is_active === 'yes' ? 'active' : 'inactive'} />
        }
    ];

    return (
        <div>
            <PageHeader
                title="Departments"
                subtitle="Departments own budgets and appear on every RFQ and purchase order."
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
                            Add Department
                        </button>
                    )
                }
            />

            <FilterBar search={search} onSearch={setSearch} placeholder="Search departments..." />

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(d) => d.department_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No departments yet"
                emptyHint="Add departments before allocating budgets."
                onRowClick={
                    canEdit
                        ? (d) => {
                              setEditing(d);
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
                title={editing ? 'Edit department' : 'Add department'}
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="department-form" type="submit" busy={busy}>
                            Save
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="department-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    <Field label="Name" required>
                        <Input name="name" defaultValue={editing?.name} required autoFocus />
                    </Field>
                    <Field label="Manager">
                        <Input name="manager_name" defaultValue={editing?.manager_name ?? ''} />
                    </Field>
                    <Field label="Manager email">
                        <Input name="manager_email" type="email" defaultValue={editing?.manager_email ?? ''} />
                    </Field>
                    <Field label="Description">
                        <Textarea name="description" rows={2} />
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
