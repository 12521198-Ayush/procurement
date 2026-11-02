'use client';

import { useEffect, useState } from 'react';
import { Building2, FolderTree, Pencil, Plus, Ruler, Tags, Trash2, Users } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList, useOptions } from '@/lib/hooks';
import type { QueryParams } from '@/lib/search-params';

type Kind = 'category' | 'subcategory' | 'department' | 'unit';

type MasterRow = {
    name: string;
    description?: string | null;
    is_active: string;
    assigned_user_ids?: string[];
    category_id?: string;
    category_name?: string;
    manager_name?: string | null;
    manager_email?: string | null;
    symbol?: string | null;
    vendor_count?: number;
    subcategory_count?: number;
    [key: string]: any;
};

type UserOption = { user_id: string; name: string; email: string; role: string };

const KINDS: Record<Kind, { label: string; plural: string; id: string; icon: typeof Tags; hint: string }> = {
    category: { label: 'Category', plural: 'Categories', id: 'category_id', icon: Tags, hint: "e.g. 'Furniture', 'IT Hardware', 'Housekeeping'" },
    subcategory: { label: 'Subcategory', plural: 'Subcategories', id: 'subcategory_id', icon: FolderTree, hint: 'Budgets can be set per subcategory.' },
    department: { label: 'Department', plural: 'Departments', id: 'department_id', icon: Building2, hint: 'Who the purchase is for.' },
    unit: { label: 'Unit', plural: 'Units of measure', id: 'unit_id', icon: Ruler, hint: "e.g. 'Nos', 'Kg', 'Box'" }
};

const ADMIN_ROLE = 'Procurement Admin';

/**
 * Master data. A Procurement Admin creates and maintains every list and decides
 * who can use each entry; everyone else only picks from them in dropdowns.
 */
export default function MastersPage({ searchParams }: { searchParams?: QueryParams }) {
    const { user } = useAuth();
    const toast = useToast();
    const isAdmin = user?.role === ADMIN_ROLE;

    const initial = (searchParams?.tab as Kind) || 'category';
    const [kind, setKind] = useState<Kind>(KINDS[initial] ? initial : 'category');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const debounced = useDebounced(search);
    const cfg = KINDS[kind];

    const list = useList<MasterRow>(`/procurement/masters/${kind}/list`, {
        search: debounced,
        mode: isAdmin ? 'manage' : undefined,
        is_active: isAdmin && status ? status : undefined,
        category_id: kind === 'subcategory' && categoryFilter ? categoryFilter : undefined
    });
    const categories = useOptions('/procurement/masters/category/list', 'category_id');

    const [users, setUsers] = useState<UserOption[]>([]);
    useEffect(() => {
        if (!isAdmin) return;
        post<{ array: UserOption[] }>('/procurement/masters/users', {})
            .then((res) => setUsers(res.array || []))
            .catch(() => undefined);
    }, [isAdmin]);
    const userName = (id: string) => users.find((u) => u.user_id === id)?.name ?? 'Unknown user';

    const [editing, setEditing] = useState<MasterRow | null>(null);
    const [open, setOpen] = useState(false);
    const [assigned, setAssigned] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState<MasterRow | null>(null);

    function openEditor(row: MasterRow | null) {
        setEditing(row);
        setAssigned(row?.assigned_user_ids ?? []);
        setOpen(true);
    }

    async function save(form: FormData) {
        setBusy(true);
        try {
            const payload: Record<string, unknown> = {
                name: form.get('name'),
                description: form.get('description') ?? undefined,
                is_active: form.get('is_active') || 'yes',
                assigned_user_ids: assigned
            };
            if (kind === 'subcategory') payload.category_id = form.get('category_id');
            if (kind === 'department') {
                payload.manager_name = form.get('manager_name');
                payload.manager_email = form.get('manager_email');
            }
            if (kind === 'unit') payload.symbol = form.get('symbol');

            if (editing) {
                await post(`/procurement/masters/${kind}/update`, { ...payload, [cfg.id]: editing[cfg.id] });
                toast.success(`${cfg.label} updated`);
            } else {
                await post(`/procurement/masters/${kind}/create`, payload);
                toast.success(`${cfg.label} created`);
            }
            setOpen(false);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function toggle(row: MasterRow) {
        try {
            await post(`/procurement/masters/${kind}/update`, { [cfg.id]: row[cfg.id], is_active: row.is_active === 'yes' ? 'no' : 'yes' });
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    async function remove() {
        if (!deleting) return;
        setBusy(true);
        try {
            await post(`/procurement/masters/${kind}/delete`, { [cfg.id]: deleting[cfg.id] });
            toast.success(`${cfg.label} deleted`);
            setDeleting(null);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const Icon = cfg.icon;
    const columns: Column<MasterRow>[] = [
        {
            key: 'name',
            header: cfg.label,
            render: (r) => (
                <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600">
                        <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{r.name}</p>
                        {r.description && <p className="truncate text-[12px] text-muted">{r.description}</p>}
                    </div>
                </div>
            )
        }
    ];
    if (kind === 'subcategory') columns.push({ key: 'category_name', header: 'Category' });
    if (kind === 'category') {
        columns.push({ key: 'subcategory_count', header: 'Subcategories', align: 'center' });
        columns.push({ key: 'vendor_count', header: 'Vendors', align: 'center' });
    }
    if (kind === 'department') {
        columns.push({ key: 'manager_name', header: 'Manager', render: (r) => r.manager_name || '—' });
    }
    if (kind === 'unit') columns.push({ key: 'symbol', header: 'Symbol', render: (r) => r.symbol || '—' });
    if (isAdmin) {
        columns.push({
            key: 'assigned',
            header: 'Available to',
            render: (r) =>
                r.assigned_user_ids?.length ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700" title={r.assigned_user_ids.map(userName).join(', ')}>
                        <Users className="h-3.5 w-3.5 text-violet-600" />
                        {r.assigned_user_ids.length === 1 ? userName(r.assigned_user_ids[0]) : `${r.assigned_user_ids.length} users`}
                    </span>
                ) : (
                    <span className="text-[12px] text-muted">All users</span>
                )
        });
        columns.push({ key: 'is_active', header: 'Status', render: (r) => <StatusPill status={r.is_active === 'yes' ? 'active' : 'inactive'} /> });
        columns.push({
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
                <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="text-[13px] font-medium text-brand-600 hover:text-brand-700" onClick={() => toggle(r)}>
                        {r.is_active === 'yes' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="text-slate-400 hover:text-brand-600" onClick={() => openEditor(r)} aria-label={`Edit ${r.name}`}>
                        <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => setDeleting(r)} aria-label={`Delete ${r.name}`}>
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )
        });
    }

    return (
        <div>
            <PageHeader
                title="Master Data"
                subtitle={
                    isAdmin
                        ? 'Maintain the lists everyone picks from. Restrict an entry to specific users to give each user their own list.'
                        : 'The lists available to you. Contact your Procurement Admin to add or change an entry.'
                }
                action={
                    isAdmin && (
                        <button type="button" className="btn-primary" onClick={() => openEditor(null)}>
                            <Plus className="h-4 w-4" />
                            Add {cfg.label}
                        </button>
                    )
                }
            />

            <div className="mb-4">
                <Tabs
                    tabs={(Object.keys(KINDS) as Kind[]).map((k) => ({ value: k, label: KINDS[k].plural }))}
                    active={kind}
                    onChange={(v) => {
                        setKind(v as Kind);
                        setSearch('');
                        setCategoryFilter('');
                    }}
                />
            </div>

            <FilterBar search={search} onSearch={setSearch} placeholder={`Search ${cfg.plural.toLowerCase()}...`}>
                {kind === 'subcategory' && (
                    <div className="w-56">
                        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={categories} placeholder="All categories" aria-label="Filter by category" />
                    </div>
                )}
                {isAdmin && (
                    <div className="w-40">
                        <Select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            options={[
                                { value: 'yes', label: 'Active' },
                                { value: 'no', label: 'Inactive' }
                            ]}
                            placeholder="Any status"
                            aria-label="Filter by status"
                        />
                    </div>
                )}
            </FilterBar>

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(r) => r[cfg.id]}
                loading={list.loading}
                error={list.error}
                emptyTitle={`No ${cfg.plural.toLowerCase()} yet`}
                emptyHint={isAdmin ? cfg.hint : 'Nothing has been made available to you in this list yet.'}
                onRowClick={isAdmin ? (r) => openEditor(r) : undefined}
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={editing ? `Edit ${cfg.label.toLowerCase()}` : `Add ${cfg.label.toLowerCase()}`}
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="master-form" type="submit" busy={busy}>
                            Save
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="master-form"
                    key={`${kind}-${editing?.[cfg.id] ?? 'new'}`}
                    onSubmit={(e) => {
                        e.preventDefault();
                        save(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        {kind === 'subcategory' && (
                            <Field label="Category" required className="sm:col-span-2">
                                <Select name="category_id" defaultValue={editing?.category_id ?? categoryFilter} options={categories} placeholder="Select category" required />
                            </Field>
                        )}
                        <Field label="Name" required className={kind === 'unit' ? '' : 'sm:col-span-2'}>
                            <Input name="name" defaultValue={editing?.name} required autoFocus />
                        </Field>
                        {kind === 'unit' && (
                            <Field label="Symbol">
                                <Input name="symbol" defaultValue={editing?.symbol ?? ''} placeholder="kg" />
                            </Field>
                        )}
                        {kind === 'department' && (
                            <>
                                <Field label="Manager name">
                                    <Input name="manager_name" defaultValue={editing?.manager_name ?? ''} />
                                </Field>
                                <Field label="Manager email">
                                    <Input type="email" name="manager_email" defaultValue={editing?.manager_email ?? ''} />
                                </Field>
                            </>
                        )}
                        <Field label="Description" className="sm:col-span-2">
                            <Textarea name="description" rows={2} defaultValue={editing?.description ?? ''} />
                        </Field>
                        <Field label="Status">
                            <Select
                                name="is_active"
                                defaultValue={editing?.is_active ?? 'yes'}
                                options={[
                                    { value: 'yes', label: 'Active' },
                                    { value: 'no', label: 'Inactive' }
                                ]}
                            />
                        </Field>
                    </div>

                    <div>
                        <p className="field-label">Available to</p>
                        <p className="mb-2 text-[12px] text-muted">
                            Leave everyone unticked to make it available to all users. Tick users to limit it to them.
                        </p>
                        <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
                            {users.map((u) => {
                                const checked = assigned.includes(u.user_id);
                                return (
                                    <label key={u.user_id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg p-2 ${checked ? 'bg-brand-50/50' : 'hover:bg-slate-50'}`}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => setAssigned(e.target.checked ? [...assigned, u.user_id] : assigned.filter((x) => x !== u.user_id))}
                                            className="mt-0.5 h-4 w-4 rounded border-line text-brand-600"
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-[13px] font-medium text-ink">{u.name}</span>
                                            <span className="block truncate text-[11px] text-muted">{u.role}</span>
                                        </span>
                                    </label>
                                );
                            })}
                            {!users.length && <p className="p-2 text-[12px] text-muted">No other users in this society.</p>}
                        </div>
                        <p className="mt-1.5 text-[12px] text-slate-500">
                            {assigned.length ? `Only ${assigned.length} selected user(s) will see this entry.` : 'All users will see this entry.'}
                        </p>
                    </div>
                </form>
            </Modal>

            <Modal
                open={!!deleting}
                onClose={() => setDeleting(null)}
                size="sm"
                title={`Delete ${deleting?.name ?? ''}?`}
                description="Entries already used on RFQs, budgets or orders cannot be deleted - deactivate them instead."
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setDeleting(null)}>
                            Keep
                        </button>
                        <button type="button" className="btn-primary bg-rose-600 hover:bg-rose-700" onClick={remove} disabled={busy}>
                            Delete
                        </button>
                    </>
                }
            >
                <p className="text-[13px] text-slate-600">This permanently removes the {cfg.label.toLowerCase()}.</p>
            </Modal>
        </div>
    );
}
