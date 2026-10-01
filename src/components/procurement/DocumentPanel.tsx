'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText, History, Loader2, Lock, Paperclip, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { vendorPost } from '@/lib/vendor-api';
import { ACCEPTED_FILES, MAX_UPLOAD_BYTES, fileToBase64, formatBytes, humanize } from '@/lib/files';
import { formatDateTime } from '@/lib/format';

export type DocumentRow = {
    document_id: string;
    document_group_id: string;
    version: number;
    entity_type: string;
    entity_id: string;
    category: string;
    filename: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    note: string | null;
    status: string;
    previewable: boolean;
    uploaded_by_name: string;
    uploaded_by_type: string;
    uploaded_at: string;
    deleted_at?: string | null;
    deleted_by_name?: string | null;
};

// Mirrors the server's allow-list per stage; the server re-validates anyway.
export const DOCUMENT_CATEGORIES: Record<string, string[]> = {
    rfq: ['specification', 'technical', 'terms', 'attachment'],
    quotation: ['quotation_pdf', 'technical_quotation', 'commercial_quotation', 'supporting'],
    purchase_order: ['po_attachment', 'terms', 'approval', 'signed_po'],
    proforma_invoice: ['proforma_invoice', 'bank_details', 'supporting'],
    payment: ['payment_proof', 'transaction_receipt', 'bank_confirmation'],
    payment_receipt: ['receipt', 'payment_confirmation'],
    dispatch: ['delivery_challan', 'packing_list', 'lorry_receipt', 'bill_of_lading', 'eway_bill', 'transport'],
    goods_receipt: ['receiving', 'inspection', 'photo', 'supporting'],
    tax_invoice: ['invoice_pdf', 'e_invoice', 'eway_bill', 'supporting']
};

const BASE = { buyer: '/procurement/documents/', vendor: '/procurement/vendor/portal/documents/' };

/**
 * Upload / download / preview / replace (versioned) / history / delete for the
 * documents on one record. Works for buyers and, with client="vendor", for the
 * vendor portal; the server decides what each side may see or change.
 */
export default function DocumentPanel({
    entityType,
    entityId,
    client = 'buyer',
    canUpload = true,
    canDelete = false,
    title = 'Documents',
    hint,
    bare = false,
    onChange
}: {
    entityType: string;
    entityId: string;
    client?: 'buyer' | 'vendor';
    canUpload?: boolean;
    canDelete?: boolean;
    title?: string;
    hint?: string;
    bare?: boolean;
    onChange?: (rows: DocumentRow[]) => void;
}) {
    const toast = useToast();
    const call: typeof post = client === 'vendor' ? vendorPost : post;
    const categories = (DOCUMENT_CATEGORIES[entityType] || []).concat('other');

    const [rows, setRows] = useState<DocumentRow[]>([]);
    const [sealed, setSealed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [category, setCategory] = useState(categories[0]);
    const [note, setNote] = useState('');
    const [history, setHistory] = useState<DocumentRow[] | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<DocumentRow | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const replaceRef = useRef<HTMLInputElement>(null);
    const replacing = useRef<DocumentRow | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await call<{ array: DocumentRow[]; sealed_count?: number }>(BASE[client] + 'list', { entity_type: entityType, entity_id: entityId });
            setRows(res.array);
            setSealed(res.sealed_count || 0);
            onChange?.(res.array);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityType, entityId, client]);

    useEffect(() => {
        load();
    }, [load]);

    async function send(file: File, extra: Record<string, unknown>) {
        if (file.size > MAX_UPLOAD_BYTES) {
            toast.error('Files must be 10 MB or smaller');
            return;
        }
        setBusy('upload');
        try {
            await call(BASE[client] + 'upload', {
                entity_type: entityType,
                entity_id: entityId,
                filename: file.name,
                content_base64: await fileToBase64(file),
                ...extra
            });
            toast.success(extra.replaces_document_id ? 'New version uploaded' : 'Document uploaded');
            setNote('');
            await load();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(null);
        }
    }

    async function open(doc: DocumentRow, inline: boolean) {
        setBusy(doc.document_id);
        try {
            const res = await call<{ url: string }>(BASE[client] + 'download', { document_id: doc.document_id, inline });
            window.open(res.url, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(null);
        }
    }

    async function showHistory(doc: DocumentRow) {
        try {
            const res = await call<{ array: DocumentRow[] }>(BASE[client] + 'history', { document_id: doc.document_id });
            setHistory(res.array);
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    async function remove(doc: DocumentRow) {
        setBusy(doc.document_id);
        try {
            await call(BASE[client] + 'delete', { document_id: doc.document_id });
            toast.success('Document removed');
            setConfirmDelete(null);
            await load();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(null);
        }
    }

    const body = (
        <>
            {canUpload && (
                <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line bg-slate-50/60 p-3">
                    <div className="min-w-[160px]">
                        <label className="field-label">Type</label>
                        <Select value={category} onChange={(e) => setCategory(e.target.value)} options={categories.map((c) => ({ value: c, label: humanize(c) }))} />
                    </div>
                    <div className="min-w-[160px] flex-1">
                        <label className="field-label">Remarks</label>
                        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={300} />
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept={ACCEPTED_FILES}
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) send(file, { category, note: note || undefined });
                        }}
                    />
                    <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}>
                        {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload
                    </button>
                </div>
            )}

            <input
                ref={replaceRef}
                type="file"
                accept={ACCEPTED_FILES}
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    const target = replacing.current;
                    if (file && target) send(file, { category: target.category, replaces_document_id: target.document_id });
                }}
            />

            {loading ? (
                <div className="space-y-2">
                    {[0, 1].map((i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                </div>
            ) : error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>
            ) : rows.length ? (
                <ul className="divide-y divide-line rounded-lg border border-line">
                    {rows.map((doc) => (
                        <li key={doc.document_id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                                    <FileText className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium text-ink" title={doc.original_filename}>
                                        {doc.original_filename || doc.filename}
                                        {doc.version > 1 && (
                                            <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">v{doc.version}</span>
                                        )}
                                    </p>
                                    <p className="truncate text-[11px] text-muted">
                                        {humanize(doc.category)} · {formatBytes(doc.size_bytes)} · {doc.uploaded_by_name}
                                        {doc.uploaded_by_type === 'vendor' ? ' (vendor)' : ''} · {formatDateTime(doc.uploaded_at)}
                                    </p>
                                    {doc.note && <p className="truncate text-[11px] text-slate-500">{doc.note}</p>}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                {doc.previewable && (
                                    <IconButton label="Preview" onClick={() => open(doc, true)} busy={busy === doc.document_id}>
                                        <Eye className="h-4 w-4" />
                                    </IconButton>
                                )}
                                <IconButton label="Download" onClick={() => open(doc, false)}>
                                    <Download className="h-4 w-4" />
                                </IconButton>
                                <IconButton label="Upload history" onClick={() => showHistory(doc)}>
                                    <History className="h-4 w-4" />
                                </IconButton>
                                {canUpload && (
                                    <IconButton
                                        label="Replace with a new version"
                                        onClick={() => {
                                            replacing.current = doc;
                                            replaceRef.current?.click();
                                        }}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </IconButton>
                                )}
                                {canDelete && (
                                    <IconButton label="Delete" onClick={() => setConfirmDelete(doc)} danger>
                                        <Trash2 className="h-4 w-4" />
                                    </IconButton>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-4 text-[13px] text-muted">
                    <Paperclip className="h-4 w-4" />
                    No documents yet.
                </div>
            )}

            {sealed > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-amber-700">
                    <Lock className="h-3.5 w-3.5" />
                    {sealed} vendor document{sealed > 1 ? 's are' : ' is'} sealed until the bids are opened.
                </p>
            )}

            <Modal open={!!history} onClose={() => setHistory(null)} title="Upload history" description="Every version of this document, newest first.">
                <ul className="divide-y divide-line">
                    {(history || []).map((h) => (
                        <li key={h.document_id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                            <div className="min-w-0">
                                <p className="truncate font-medium text-ink">
                                    v{h.version} · {h.original_filename || h.filename}
                                </p>
                                <p className="text-[11px] text-muted">
                                    {h.uploaded_by_name} · {formatDateTime(h.uploaded_at)}
                                    {h.deleted_at ? ` · deleted by ${h.deleted_by_name || 'user'} ${formatDateTime(h.deleted_at)}` : ''}
                                </p>
                            </div>
                            <span
                                className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                    h.status === 'active' ? 'bg-emerald-50 text-emerald-700' : h.status === 'deleted' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                                {humanize(h.status)}
                            </span>
                        </li>
                    ))}
                </ul>
            </Modal>

            <Modal
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                title="Delete this document?"
                description="It disappears from lists, but stays in the upload history for audit."
                size="sm"
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                            Keep
                        </button>
                        <button
                            type="button"
                            className="btn bg-rose-600 text-white hover:bg-rose-700"
                            onClick={() => confirmDelete && remove(confirmDelete)}
                            disabled={!!busy}
                        >
                            Delete
                        </button>
                    </>
                }
            >
                <p className="text-[13px] text-slate-600">{confirmDelete?.original_filename}</p>
            </Modal>
        </>
    );

    if (bare) return body;
    return (
        <Card>
            <CardHeader title={title} action={hint ? <span className="text-[12px] text-muted">{hint}</span> : undefined} />
            {body}
        </Card>
    );
}

function IconButton({
    label,
    onClick,
    children,
    busy,
    danger
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    busy?: boolean;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            disabled={busy}
            className={`grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 ${danger ? 'hover:text-rose-600' : 'hover:text-ink'}`}
        >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
        </button>
    );
}
