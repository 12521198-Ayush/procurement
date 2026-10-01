'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, FolderOpen, PackageCheck, Upload, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import DocumentPanel from '@/components/procurement/DocumentPanel';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';
import { formatDate, formatDateTime } from '@/lib/format';

const TABS = [
    { value: 'to_receive', label: 'To receive' },
    { value: 'grn_open', label: 'GRNs in progress' },
    { value: 'grn_posted', label: 'Posted GRNs' },
    { value: 'dispatches', label: 'All dispatches' }
];

/**
 * Store / receiving desk: vendor dispatches arrive here, are received into a
 * GRN, inspected (accepted / rejected / short) and posted - which updates the PO,
 * the dispatch and stock.
 */
export default function ReceivingPage({ searchParams }: { searchParams?: { tab?: string; dispatch?: string; grn?: string; po?: string } }) {
    const { can } = useAuth();
    const [tab, setTab] = useState(searchParams?.tab || (searchParams?.grn ? 'grn_open' : 'to_receive'));
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const [dispatchId, setDispatchId] = useState<string | null>(searchParams?.dispatch || null);
    const [grnId, setGrnId] = useState<string | null>(searchParams?.grn || null);
    const [newGrn, setNewGrn] = useState<{ po_id: string; dispatch_id?: string } | null>(searchParams?.po && !searchParams?.dispatch ? { po_id: searchParams.po } : null);

    const isDispatchTab = tab === 'to_receive' || tab === 'dispatches';
    const dispatches = useList<any>(isDispatchTab ? '/procurement/dispatches/list' : '/procurement/grn/list', isDispatchTab
        ? { status: tab === 'to_receive' ? 'pending_receipt' : undefined, search: debounced }
        : { status: tab === 'grn_open' ? 'pending' : 'posted', search: debounced });

    const dispatchColumns: Column<any>[] = [
        { key: 'dispatch_number', header: 'Dispatch', render: (d) => <div><p className="font-medium text-ink">{d.dispatch_number}</p><p className="text-[12px] text-muted">{d.delivery_challan_number ? `DC ${d.delivery_challan_number}` : '—'}</p></div> },
        { key: 'vendor_name', header: 'Vendor' },
        { key: 'po_number', header: 'PO', render: (d) => <Link className="text-brand-700 hover:underline" href={`/purchase-orders/${d.po_id}`} onClick={(e) => e.stopPropagation()}>{d.po_number}</Link> },
        { key: 'transport', header: 'Transport', render: (d) => <span className="text-[12px]">{[d.transporter_name, d.vehicle_number, d.lr_number && `LR ${d.lr_number}`].filter(Boolean).join(' · ') || '—'}</span> },
        { key: 'dispatch_date', header: 'Dispatched', render: (d) => formatDate(d.dispatch_date) },
        { key: 'expected', header: 'Expected', render: (d) => formatDate(d.expected_arrival_date) },
        { key: 'status', header: 'Status', render: (d) => <StatusPill status={d.status} /> },
        {
            key: 'actions', header: '', align: 'right',
            render: (d) => d.status === 'dispatched' && can('GRN_CREATE') ? (
                <button type="button" className="text-[13px] font-medium text-brand-600 hover:underline" onClick={(e) => { e.stopPropagation(); setNewGrn({ po_id: d.po_id, dispatch_id: d.dispatch_id }); }}>
                    Receive →
                </button>
            ) : null
        }
    ];

    const grnColumns: Column<any>[] = [
        { key: 'grn_number', header: 'GRN', render: (g) => <div><p className="font-medium text-ink">{g.grn_number}</p><p className="text-[12px] text-muted">{g.dispatch_number || 'No dispatch'}</p></div> },
        { key: 'vendor_name', header: 'Vendor' },
        { key: 'po_number', header: 'PO', render: (g) => <Link className="text-brand-700 hover:underline" href={`/purchase-orders/${g.po_id}`} onClick={(e) => e.stopPropagation()}>{g.po_number}</Link> },
        { key: 'grn_date', header: 'GRN date', render: (g) => formatDate(g.grn_date || g.received_at) },
        { key: 'received_by_name', header: 'Receiver' },
        { key: 'status', header: 'Status', render: (g) => <StatusPill status={g.status || 'posted'} /> }
    ];

    return (
        <div>
            <PageHeader title="Dispatch & Goods Receipt" subtitle="Receive vendor dispatches, inspect the goods and post GRNs." />
            <div className="mb-4">
                <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>
            <FilterBar search={search} onSearch={setSearch} placeholder={isDispatchTab ? 'Search dispatch, PO, LR or vehicle...' : 'Search GRN, PO or vendor...'} />
            <DataTable
                columns={isDispatchTab ? dispatchColumns : grnColumns}
                rows={dispatches.rows}
                rowKey={(r) => r.dispatch_id && isDispatchTab ? r.dispatch_id : r.grn_id}
                loading={dispatches.loading}
                error={dispatches.error}
                onRowClick={(r) => (isDispatchTab ? setDispatchId(r.dispatch_id) : setGrnId(r.grn_id))}
                emptyTitle={tab === 'to_receive' ? 'Nothing waiting to be received' : 'Nothing here'}
                page={dispatches.page}
                limit={dispatches.limit}
                total={dispatches.total}
                onPageChange={dispatches.setPage}
            />

            {dispatchId && (
                <DispatchModal
                    id={dispatchId}
                    onClose={() => setDispatchId(null)}
                    onReceive={(d) => { setDispatchId(null); setNewGrn({ po_id: d.po_id, dispatch_id: d.dispatch_id }); }}
                    onOpenGrn={(id) => { setDispatchId(null); setGrnId(id); }}
                    canReceive={can('GRN_CREATE')}
                />
            )}
            {newGrn && (
                <NewGrnModal
                    poId={newGrn.po_id}
                    dispatchId={newGrn.dispatch_id}
                    onClose={() => setNewGrn(null)}
                    onCreated={(g) => { setNewGrn(null); setGrnId(g.grn_id); setTab('grn_open'); dispatches.reload(); }}
                />
            )}
            {grnId && <GrnModal id={grnId} onClose={() => setGrnId(null)} onChanged={dispatches.reload} />}
        </div>
    );
}

function DispatchModal({ id, onClose, onReceive, onOpenGrn, canReceive }: { id: string; onClose: () => void; onReceive: (d: any) => void; onOpenGrn: (id: string) => void; canReceive: boolean }) {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        post('/procurement/dispatches/detail', { dispatch_id: id }).then(setData).catch((e) => setError(e.message));
    }, [id]);
    const d = data?.dispatch;

    return (
        <Modal open onClose={onClose} size="xl" title={d ? `Dispatch ${d.dispatch_number}` : 'Dispatch'} description={d ? `${d.vendor_name} · ${d.po_number}` : undefined}
            footer={d && d.status === 'dispatched' && canReceive ? (
                <button type="button" className="btn-primary" onClick={() => onReceive(d)}>
                    <PackageCheck className="h-4 w-4" /> Receive goods
                </button>
            ) : undefined}
        >
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
            {!d && !error && <div className="h-40 animate-pulse rounded-lg bg-slate-100" />}
            {d && (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <StatusPill status={d.status} />
                        <Link href={`/lifecycle?dispatch_id=${d.dispatch_id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600"><FolderOpen className="h-4 w-4" /> Procurement file</Link>
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                        <Info label="Dispatch date" value={formatDate(d.dispatch_date)} />
                        <Info label="Expected arrival" value={formatDate(d.expected_arrival_date)} />
                        <Info label="Delivery challan" value={d.delivery_challan_number} />
                        <Info label="Transporter" value={d.transporter_name} />
                        <Info label="Vehicle" value={d.vehicle_number} />
                        <Info label="LR number / date" value={d.lr_number ? `${d.lr_number}${d.lr_date ? ' · ' + formatDate(d.lr_date) : ''}` : null} />
                        <Info label="Bill of lading" value={d.bill_of_lading_number} />
                        <Info label="E-way bill" value={d.eway_bill_number} />
                        <Info label="Remarks" value={d.remarks} />
                    </dl>
                    <LinesTable rows={d.items} columns={[['name', 'Item'], ['ordered_quantity', 'Ordered'], ['quantity', 'Dispatched'], ['accepted_quantity', 'Accepted']]} />
                    {data.goods_receipts.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-[13px]">
                            GRN:{' '}
                            {data.goods_receipts.map((g: any) => (
                                <button key={g.grn_id} type="button" className="font-medium text-brand-700 hover:underline" onClick={() => onOpenGrn(g.grn_id)}>
                                    {g.grn_number} ({g.status})
                                </button>
                            ))}
                        </div>
                    )}
                    <DocumentPanel entityType="dispatch" entityId={d.dispatch_id} bare canUpload={false} />
                </div>
            )}
        </Modal>
    );
}

function NewGrnModal({ poId, dispatchId, onClose, onCreated }: { poId: string; dispatchId?: string; onClose: () => void; onCreated: (g: any) => void }) {
    const toast = useToast();
    const [prefill, setPrefill] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [received, setReceived] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        post('/procurement/grn/prefill', { po_id: poId, dispatch_id: dispatchId })
            .then((res) => {
                setPrefill(res);
                const init: Record<string, string> = {};
                res.lines.forEach((l: any) => (init[l.po_item_id] = String(l.dispatched_quantity ?? l.outstanding_quantity)));
                setReceived(init);
            })
            .catch((e) => setError(e.message));
    }, [poId, dispatchId]);

    async function create(form: FormData) {
        setBusy(true);
        try {
            const g = await post('/procurement/grn/create', {
                po_id: poId,
                dispatch_id: dispatchId,
                grn_date: form.get('grn_date') || undefined,
                remarks: form.get('remarks') || undefined,
                items: prefill.lines.map((l: any) => ({ po_item_id: l.po_item_id, received_quantity: Number(received[l.po_item_id] || 0) })).filter((l: any) => l.received_quantity > 0)
            });
            toast.success(`${g.grn_number} recorded. Inspect the goods next.`);
            onCreated(g);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open onClose={onClose} size="lg" title="Record goods received" description={prefill ? `${prefill.purchase_order.po_number} · ${prefill.purchase_order.vendor_name}${prefill.dispatch ? ' · ' + prefill.dispatch.dispatch_number : ''}` : undefined}
            footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><SubmitButton form="new-grn" type="submit" busy={busy} disabled={!prefill}>Create GRN</SubmitButton></>}
        >
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
            {!prefill && !error && <div className="h-32 animate-pulse rounded-lg bg-slate-100" />}
            {prefill && (
                <form id="new-grn" className="space-y-4" onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}>
                    <div className="overflow-x-auto rounded-lg border border-line">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="th">Item</th>
                                    <th className="th text-right">Ordered</th>
                                    <th className="th text-right">Received to date</th>
                                    {prefill.dispatch && <th className="th text-right">Dispatched</th>}
                                    <th className="th text-right">Received now</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {prefill.lines.map((l: any) => (
                                    <tr key={l.po_item_id}>
                                        <td className="td font-medium text-ink">{l.name}</td>
                                        <td className="td text-right">{l.ordered_quantity} {l.unit}</td>
                                        <td className="td text-right">{l.received_quantity_to_date}</td>
                                        {prefill.dispatch && <td className="td text-right">{l.dispatched_quantity}</td>}
                                        <td className="td w-32">
                                            <input className="input h-9 text-right" inputMode="decimal" value={received[l.po_item_id] ?? ''} onChange={(e) => setReceived({ ...received, [l.po_item_id]: e.target.value })} aria-label={`Received quantity for ${l.name}`} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[12px] text-muted">Short and excess quantities against the dispatch are calculated automatically.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="GRN date"><Input type="date" name="grn_date" /></Field>
                        <Field label="Remarks"><Input name="remarks" /></Field>
                    </div>
                </form>
            )}
        </Modal>
    );
}

function GrnModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
    const { can } = useAuth();
    const toast = useToast();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [inspect, setInspect] = useState<Record<string, { accepted: string; rejected: string; remarks: string }>>({});
    const [remarks, setRemarks] = useState('');
    const [cancelling, setCancelling] = useState(false);

    async function load() {
        try {
            const res = await post('/procurement/grn/detail', { grn_id: id });
            setData(res);
            const g = res.goods_receipt;
            const init: Record<string, { accepted: string; rejected: string; remarks: string }> = {};
            (g.items || []).forEach((l: any) => (init[l.po_item_id] = {
                accepted: String(l.accepted_quantity ?? l.received_quantity),
                rejected: String(l.rejected_quantity ?? 0),
                remarks: l.remarks || ''
            }));
            setInspect(init);
            setRemarks(g.inspection_remarks || '');
        } catch (e: any) {
            setError(e.message);
        }
    }
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function act(endpoint: string, body: Record<string, unknown>, message: string) {
        setBusy(true);
        try {
            await post(endpoint, { grn_id: id, ...body });
            toast.success(message);
            await load();
            onChanged();
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        } finally {
            setBusy(false);
        }
    }

    const g = data?.goods_receipt;
    const editable = g && ['draft', 'inspection', 'accepted', 'partially_accepted', 'rejected'].includes(g.status);
    const inspected = g && ['accepted', 'partially_accepted', 'rejected'].includes(g.status);

    return (
        <Modal open onClose={onClose} size="xl" title={g ? `GRN ${g.grn_number}` : 'Goods receipt'} description={g ? `${g.vendor_name} · ${g.po_number}${g.dispatch_number ? ' · ' + g.dispatch_number : ''}` : undefined}
            footer={g && editable && can('GRN_CREATE') ? (
                <>
                    {['draft', 'inspection'].includes(g.status) && (
                        <button type="button" className="btn-ghost text-rose-600" onClick={() => setCancelling(true)} disabled={busy}><XCircle className="h-4 w-4" /> Cancel GRN</button>
                    )}
                    {g.status === 'draft' && (
                        <button type="button" className="btn-ghost" onClick={() => act('/procurement/grn/start-inspection', {}, 'Inspection started')} disabled={busy}>Start inspection</button>
                    )}
                    <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => act('/procurement/grn/inspect', {
                            inspection_remarks: remarks,
                            items: g.items.map((l: any) => ({ po_item_id: l.po_item_id, accepted_quantity: Number(inspect[l.po_item_id]?.accepted || 0), rejected_quantity: Number(inspect[l.po_item_id]?.rejected || 0), remarks: inspect[l.po_item_id]?.remarks || null }))
                        }, 'Inspection recorded')}
                    >
                        <ClipboardCheck className="h-4 w-4" /> Save inspection
                    </button>
                    {inspected && can('GRN_POST') && (
                        <button type="button" className="btn-primary" onClick={() => act('/procurement/grn/post', {}, 'GRN posted - PO, dispatch and stock updated')} disabled={busy}>
                            <Upload className="h-4 w-4" /> Post GRN
                        </button>
                    )}
                </>
            ) : undefined}
        >
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
            {!g && !error && <div className="h-40 animate-pulse rounded-lg bg-slate-100" />}
            {g && (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3 text-[13px]">
                        <StatusPill status={g.status} />
                        <span className="text-muted">Received {formatDate(g.grn_date || g.received_at)} by {g.received_by_name}</span>
                        {g.inspected_by_name && <span className="text-muted">· inspected by {g.inspected_by_name}</span>}
                        {g.posted_at && <span className="text-muted">· posted {formatDateTime(g.posted_at)} by {g.posted_by_name}</span>}
                        <Link href={`/lifecycle?grn_id=${g.grn_id}`} className="inline-flex items-center gap-1 font-medium text-brand-600"><FolderOpen className="h-4 w-4" /> Procurement file</Link>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-line">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="th">Item</th>
                                    <th className="th text-right">Ordered</th>
                                    <th className="th text-right">Dispatched</th>
                                    <th className="th text-right">Received</th>
                                    <th className="th text-right">Short / excess</th>
                                    <th className="th text-right">Accepted</th>
                                    <th className="th text-right">Rejected</th>
                                    <th className="th">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {g.items.map((l: any) => (
                                    <tr key={l.po_item_id}>
                                        <td className="td font-medium text-ink">{l.name}</td>
                                        <td className="td text-right">{l.ordered_quantity}</td>
                                        <td className="td text-right">{l.dispatched_quantity ?? '—'}</td>
                                        <td className="td text-right">{l.received_quantity}</td>
                                        <td className="td text-right">{l.short_quantity ? `-${l.short_quantity}` : l.excess_quantity ? `+${l.excess_quantity}` : '0'}</td>
                                        {editable ? (
                                            <>
                                                <td className="td w-24"><input className="input h-8 text-right" inputMode="decimal" value={inspect[l.po_item_id]?.accepted ?? ''} onChange={(e) => setInspect({ ...inspect, [l.po_item_id]: { ...inspect[l.po_item_id], accepted: e.target.value } })} aria-label={`Accepted ${l.name}`} /></td>
                                                <td className="td w-24"><input className="input h-8 text-right" inputMode="decimal" value={inspect[l.po_item_id]?.rejected ?? ''} onChange={(e) => setInspect({ ...inspect, [l.po_item_id]: { ...inspect[l.po_item_id], rejected: e.target.value } })} aria-label={`Rejected ${l.name}`} /></td>
                                                <td className="td"><input className="input h-8" value={inspect[l.po_item_id]?.remarks ?? ''} onChange={(e) => setInspect({ ...inspect, [l.po_item_id]: { ...inspect[l.po_item_id], remarks: e.target.value } })} aria-label={`Remarks ${l.name}`} /></td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="td text-right text-emerald-700">{l.accepted_quantity}</td>
                                                <td className="td text-right text-rose-700">{l.rejected_quantity}</td>
                                                <td className="td">{l.remarks || '—'}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {editable ? (
                        <Field label="Inspection remarks">
                            <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                        </Field>
                    ) : (
                        g.inspection_remarks && <p className="text-[13px] text-slate-600">Inspection: {g.inspection_remarks}</p>
                    )}
                    <Card>
                        <CardHeader title="Receiving & inspection documents" />
                        <DocumentPanel entityType="goods_receipt" entityId={g.grn_id} bare canUpload={can('DOCUMENT_UPLOAD') && g.status !== 'cancelled'} canDelete={can('DOCUMENT_DELETE') && g.status !== 'posted'} />
                    </Card>
                </div>
            )}

            <Modal open={cancelling} onClose={() => setCancelling(false)} title="Cancel this GRN?" size="sm"
                footer={<><button type="button" className="btn-ghost" onClick={() => setCancelling(false)}>Keep</button><SubmitButton form="cancel-grn" type="submit" busy={busy}>Cancel GRN</SubmitButton></>}
            >
                <form id="cancel-grn" onSubmit={async (e) => { e.preventDefault(); if (await act('/procurement/grn/cancel', { remarks: String(new FormData(e.currentTarget).get('remarks') || '') }, 'GRN cancelled')) setCancelling(false); }}>
                    <Field label="Reason" required><Textarea name="remarks" rows={2} required /></Field>
                </form>
            </Modal>
        </Modal>
    );
}

function LinesTable({ rows, columns }: { rows: any[]; columns: [string, string][] }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full">
                <thead className="bg-slate-50">
                    <tr>{columns.map(([k, h], i) => <th key={k} className={`th ${i ? 'text-right' : ''}`}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {rows.map((r, idx) => (
                        <tr key={idx}>{columns.map(([k], i) => <td key={k} className={`td ${i ? 'text-right' : 'font-medium text-ink'}`}>{r[k] ?? '—'}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
            <dd className="text-ink">{value || '—'}</dd>
        </div>
    );
}
