'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, FileText, Loader2, Lock, Paperclip, Send, Trash2, Upload } from 'lucide-react';
import { post, TOKEN_KEY } from '@/lib/api';
import { ACCEPTED_FILES, MAX_UPLOAD_BYTES, fileToBase64, formatBytes, humanize } from '@/lib/files';
import { countdown, formatDateTime } from '@/lib/format';

type Stage = 'loading' | 'invalid' | 'otp' | 'form' | 'done';

type Line = { rfq_item_id: string; name: string; quantity: number; unit: string; specification?: string; unit_price: string; tax_percent: string; discount_percent: string };

const OTP_LENGTH = 6;

export default function VendorQuotationPage({ params }: { params: { token: string } }) {
    const { token } = params;

    const [stage, setStage] = useState<Stage>('loading');
    const [invite, setInvite] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
    const [otpSent, setOtpSent] = useState(false);

    const [vendorToken, setVendorToken] = useState<string | null>(null);
    const [rfq, setRfq] = useState<any>(null);
    const [lines, setLines] = useState<Line[]>([]);
    const [extras, setExtras] = useState({ shipping_charges: '', other_charges: '' });
    const [meta, setMeta] = useState({ vendor_quotation_number: '', valid_until: '', delivery_days: '', payment_terms: '', warranty: '', remarks: '' });
    const [totals, setTotals] = useState<any>(null);
    const [review, setReview] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        post('/procurement/vendor/link/resolve', { token })
            .then((res) => {
                setInvite(res);
                setStage(res.already_submitted ? 'done' : 'otp');
                if (res.already_submitted) setResult({ already: true });
            })
            .catch((err) => {
                setError(err.message);
                setStage('invalid');
            });
    }, [token]);

    async function sendOtp() {
        setBusy(true);
        setError(null);
        try {
            await post('/procurement/vendor/link/otp/challenge', { token });
            setOtpSent(true);
            setTimeout(() => otpRefs.current[0]?.focus(), 50);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function verifyOtp(code: string) {
        setBusy(true);
        setError(null);
        try {
            const res = await post('/procurement/vendor/link/otp/verify', { token, otp: code });
            setVendorToken(res.access_token);
            // The shared axios client reads this key, so the vendor session is used
            // for every follow-up call on this page.
            localStorage.setItem(TOKEN_KEY, res.access_token);

            const portal = await post('/procurement/vendor/rfq', {});
            setRfq(portal);
            setLines(
                portal.items.map((i: any) => ({
                    rfq_item_id: i.rfq_item_id,
                    name: i.name,
                    quantity: i.quantity,
                    unit: i.unit,
                    specification: i.specification,
                    unit_price: '',
                    tax_percent: '18',
                    discount_percent: ''
                }))
            );
            setStage('form');
        } catch (err: any) {
            setError(err.message);
            setDigits(Array(OTP_LENGTH).fill(''));
            otpRefs.current[0]?.focus();
        } finally {
            setBusy(false);
        }
    }

    // Totals always come from the server so the vendor sees exactly what will be stored.
    useEffect(() => {
        if (stage !== 'form' || !lines.some((l) => l.unit_price)) return;
        const timer = setTimeout(() => {
            post('/procurement/vendor/quotation/preview', { items: payloadLines(lines), ...extras })
                .then(setTotals)
                .catch(() => undefined);
        }, 400);
        return () => clearTimeout(timer);
    }, [stage, lines, extras]);

    async function submit() {
        setBusy(true);
        setError(null);
        try {
            const res = await post('/procurement/vendor/quotation/submit', {
                items: payloadLines(lines),
                ...extras,
                ...meta,
                delivery_days: meta.delivery_days ? Number(meta.delivery_days) : null
            });
            setResult(res);
            setStage('done');
            localStorage.removeItem(TOKEN_KEY);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    function setDigit(index: number, value: string) {
        const clean = value.replace(/\D/g, '');
        if (!clean) {
            setDigits((d) => d.map((v, i) => (i === index ? '' : v)));
            return;
        }
        const next = [...digits];
        clean.split('').forEach((ch, offset) => {
            if (index + offset < OTP_LENGTH) next[index + offset] = ch;
        });
        setDigits(next);
        const empty = next.findIndex((v) => !v);
        otpRefs.current[empty === -1 ? OTP_LENGTH - 1 : empty]?.focus();
        if (!next.includes('')) verifyOtp(next.join(''));
    }

    const timer = useMemo(() => countdown(invite?.rfq?.expires_at ?? rfq?.rfq?.expires_at), [invite, rfq]);

    return (
        <div className="min-h-screen bg-canvas">
            <header className="border-b border-line bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1.5 ring-1 ring-line">
                            <Image src="/servizing-logo.png" alt="ServiZing" width={36} height={41} priority className="h-full w-full object-contain" />
                        </span>
                        <div className="leading-tight">
                            <p className="text-[15px] font-semibold text-ink">ProcurePro</p>
                            <p className="text-[10px] tracking-wide text-muted">Vendor quotation portal</p>
                        </div>
                    </div>
                    {stage !== 'invalid' && !timer.expired && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-700">
                            <Clock className="h-3.5 w-3.5" />
                            {timer.text}
                        </span>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-5 py-8">
                {stage === 'loading' && (
                    <div className="grid place-items-center py-24">
                        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                    </div>
                )}

                {stage === 'invalid' && (
                    <Panel>
                        <div className="py-8 text-center">
                            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <h1 className="mt-4 text-lg font-semibold text-ink">This link cannot be opened</h1>
                            <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted">{error}</p>
                            <p className="mx-auto mt-3 max-w-sm text-[12px] text-slate-400">
                                Links are unique to each vendor and stop working once the RFQ closes. Please use the most
                                recent email we sent you, or contact the procurement team.
                            </p>
                        </div>
                    </Panel>
                )}

                {stage === 'otp' && invite && (
                    <Panel>
                        <div className="mx-auto max-w-sm py-4 text-center">
                            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
                                <Lock className="h-6 w-6" />
                            </div>
                            <h1 className="mt-4 text-lg font-semibold text-ink">Verify it&apos;s you</h1>
                            <p className="mt-2 text-[13px] text-muted">
                                {invite.rfq.rfq_number} · {invite.rfq.title}
                            </p>

                            {!invite.submission_open ? (
                                <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                                    This RFQ closed on {formatDateTime(invite.rfq.expires_at)}. Quotations can no longer be
                                    submitted.
                                </p>
                            ) : !otpSent ? (
                                <>
                                    <p className="mt-4 text-[13px] text-muted">
                                        We&apos;ll text a one-time passcode to{' '}
                                        <span className="font-medium text-ink">{invite.otp_destination}</span>.
                                    </p>
                                    <button type="button" className="btn-primary mt-5 w-full" onClick={sendOtp} disabled={busy}>
                                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Send passcode
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="mt-4 text-[13px] text-muted">
                                        Enter the code sent to {invite.otp_destination}.
                                    </p>
                                    <div className="mt-5 flex gap-2">
                                        {digits.map((digit, i) => (
                                            <input
                                                key={i}
                                                ref={(el) => {
                                                    otpRefs.current[i] = el;
                                                }}
                                                className="h-12 w-full rounded-lg border border-line text-center text-lg font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={OTP_LENGTH}
                                                value={digit}
                                                onChange={(e) => setDigit(i, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Backspace' && !digits[i] && i > 0) otpRefs.current[i - 1]?.focus();
                                                }}
                                                aria-label={`Digit ${i + 1}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="mt-4 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                                        onClick={sendOtp}
                                        disabled={busy}
                                    >
                                        Resend code
                                    </button>
                                </>
                            )}

                            {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}
                        </div>
                    </Panel>
                )}

                {stage === 'form' && rfq && (
                    <div className="space-y-5">
                        <Panel>
                            <h1 className="text-lg font-semibold text-ink">{rfq.rfq.rfq_number}</h1>
                            <p className="mt-1 text-[14px] text-slate-700">{rfq.rfq.title}</p>
                            {rfq.rfq.description && <p className="mt-1 text-[13px] text-muted">{rfq.rfq.description}</p>}
                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px] text-slate-600">
                                <span>Closes: {formatDateTime(rfq.rfq.expires_at)}</span>
                                {rfq.rfq.delivery_location && <span>Deliver to: {rfq.rfq.delivery_location}</span>}
                            </div>
                        </Panel>

                        {!review ? (
                            <>
                                <Panel title="Your prices">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[640px]">
                                            <thead>
                                                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                                                    <th className="py-2">Item</th>
                                                    <th className="py-2 text-right">Qty</th>
                                                    <th className="py-2 text-right">Unit price</th>
                                                    <th className="py-2 text-right">Discount %</th>
                                                    <th className="py-2 text-right">Tax %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-line">
                                                {lines.map((line, index) => (
                                                    <tr key={line.rfq_item_id}>
                                                        <td className="py-3 pr-3">
                                                            <p className="text-[13px] font-medium text-ink">{line.name}</p>
                                                            {line.specification && (
                                                                <p className="text-[11px] text-muted">{line.specification}</p>
                                                            )}
                                                        </td>
                                                        <td className="py-3 text-right text-[13px]">
                                                            {line.quantity} {line.unit}
                                                        </td>
                                                        <td className="py-3 pl-2">
                                                            <input
                                                                className="input h-9 text-right"
                                                                inputMode="decimal"
                                                                value={line.unit_price}
                                                                onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                                                                placeholder="0.00"
                                                                aria-label={`Unit price for ${line.name}`}
                                                            />
                                                        </td>
                                                        <td className="py-3 pl-2">
                                                            <input
                                                                className="input h-9 w-20 text-right"
                                                                inputMode="decimal"
                                                                value={line.discount_percent}
                                                                onChange={(e) => updateLine(index, { discount_percent: e.target.value })}
                                                                placeholder="0"
                                                                aria-label={`Discount for ${line.name}`}
                                                            />
                                                        </td>
                                                        <td className="py-3 pl-2">
                                                            <input
                                                                className="input h-9 w-20 text-right"
                                                                inputMode="decimal"
                                                                value={line.tax_percent}
                                                                onChange={(e) => updateLine(index, { tax_percent: e.target.value })}
                                                                aria-label={`Tax for ${line.name}`}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                                        <LabelledInput
                                            label="Shipping charges"
                                            value={extras.shipping_charges}
                                            onChange={(v) => setExtras({ ...extras, shipping_charges: v })}
                                        />
                                        <LabelledInput
                                            label="Other charges"
                                            value={extras.other_charges}
                                            onChange={(v) => setExtras({ ...extras, other_charges: v })}
                                        />
                                    </div>

                                    {totals && <TotalsBox totals={totals} />}
                                </Panel>

                                <Panel title="Quotation details">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <LabelledInput label="Your quotation number" value={meta.vendor_quotation_number} onChange={(v) => setMeta({ ...meta, vendor_quotation_number: v })} />
                                        <LabelledInput label="Valid until" type="date" value={meta.valid_until} onChange={(v) => setMeta({ ...meta, valid_until: v })} />
                                        <LabelledInput label="Delivery time (days)" value={meta.delivery_days} onChange={(v) => setMeta({ ...meta, delivery_days: v })} />
                                        <LabelledInput label="Payment terms" value={meta.payment_terms} onChange={(v) => setMeta({ ...meta, payment_terms: v })} />
                                        <LabelledInput label="Warranty" value={meta.warranty} onChange={(v) => setMeta({ ...meta, warranty: v })} />
                                        <LabelledInput label="Remarks" value={meta.remarks} onChange={(v) => setMeta({ ...meta, remarks: v })} />
                                    </div>
                                </Panel>

                                <QuotationFiles />

                                {error && <p className="text-[13px] text-rose-600">{error}</p>}

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        disabled={!lines.every((l) => l.unit_price) || !totals}
                                        onClick={() => setReview(true)}
                                    >
                                        Review quotation
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <Panel title="Review before submitting">
                                    <p className="mb-4 text-[13px] text-muted">
                                        Once submitted your quotation is final and cannot be changed.
                                    </p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[520px]">
                                            <thead>
                                                <tr className="border-b border-line text-left text-[11px] uppercase text-muted">
                                                    <th className="py-2">Item</th>
                                                    <th className="py-2 text-right">Qty</th>
                                                    <th className="py-2 text-right">Unit price</th>
                                                    <th className="py-2 text-right">Line total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-line">
                                                {lines.map((line, i) => (
                                                    <tr key={line.rfq_item_id}>
                                                        <td className="py-2.5 text-[13px] font-medium text-ink">{line.name}</td>
                                                        <td className="py-2.5 text-right text-[13px]">
                                                            {line.quantity} {line.unit}
                                                        </td>
                                                        <td className="py-2.5 text-right text-[13px]">{line.unit_price}</td>
                                                        <td className="py-2.5 text-right text-[13px] font-medium">
                                                            {totals?.lines?.[i] ? inr(totals.lines[i].total_minor) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {totals && <TotalsBox totals={totals} />}
                                </Panel>

                                <QuotationFiles />

                                {error && <p className="text-[13px] text-rose-600">{error}</p>}

                                <div className="flex justify-between">
                                    <button type="button" className="btn-ghost" onClick={() => setReview(false)} disabled={busy}>
                                        <ArrowLeft className="h-4 w-4" />
                                        Back to edit
                                    </button>
                                    <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        Submit quotation
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {stage === 'done' && (
                    <Panel>
                        <div className="py-8 text-center">
                            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <h1 className="mt-4 text-lg font-semibold text-ink">
                                {result?.already ? 'You have already submitted' : 'Quotation submitted'}
                            </h1>
                            <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted">
                                {result?.already
                                    ? 'Our records show a quotation from you against this RFQ. Contact the procurement team if you need to change it.'
                                    : `Thank you. Your quotation ${result?.quotation_number ?? ''} has been received and the procurement team has been notified.`}
                            </p>
                            <Link href="/vendor/login" className="btn-ghost mt-5 inline-flex">
                                Track it in the vendor portal
                            </Link>
                        </div>
                    </Panel>
                )}
            </main>
        </div>
    );

    function updateLine(index: number, patch: Partial<Line>) {
        setLines((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    }
}

function payloadLines(lines: Line[]) {
    return lines.map((l) => ({
        rfq_item_id: l.rfq_item_id,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price || 0,
        discount_percent: l.discount_percent || 0,
        tax_percent: l.tax_percent || 0
    }));
}

function inr(minor: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((minor || 0) / 100);
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className="card card-pad">
            {title && <h2 className="mb-4 text-[15px] font-semibold text-ink">{title}</h2>}
            {children}
        </div>
    );
}

const FILE_TYPES = ['quotation_pdf', 'technical_quotation', 'commercial_quotation', 'supporting', 'other'];

type VendorFile = { document_id: string; filename: string; original_filename?: string; category?: string; size_bytes: number; uploaded_at: string };

/** Quotation attachments for the link session; the server ties them to this vendor and RFQ. */
function QuotationFiles() {
    const [files, setFiles] = useState<VendorFile[]>([]);
    const [category, setCategory] = useState('quotation_pdf');
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);

    async function load() {
        try {
            const res = await post<{ array: VendorFile[] }>('/procurement/vendor/documents/list', {});
            setFiles(res.array);
        } catch (err: any) {
            setError(err.message);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function upload(list: FileList | null) {
        if (!list?.length) return;
        setError(null);
        setBusy('upload');
        try {
            for (const file of Array.from(list)) {
                if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 10 MB`);
                await post('/procurement/vendor/documents/upload', {
                    filename: file.name,
                    category,
                    content_base64: await fileToBase64(file)
                });
            }
            await load();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(null);
        }
    }

    async function remove(id: string) {
        setBusy(id);
        setError(null);
        try {
            await post('/procurement/vendor/documents/delete', { document_id: id });
            await load();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(null);
        }
    }

    return (
        <Panel title="Attachments">
            <p className="mb-3 text-[13px] text-muted">
                Attach your signed quotation, technical sheets or other supporting documents (PDF, images, Word, Excel; up to 10 MB each).
                They stay sealed with your quotation until the buyer opens the bids.
            </p>
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line bg-slate-50/60 p-3">
                <label className="block min-w-[200px]">
                    <span className="field-label">Document type</span>
                    <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                        {FILE_TYPES.map((c) => (
                            <option key={c} value={c}>
                                {humanize(c)}
                            </option>
                        ))}
                    </select>
                </label>
                <input
                    ref={input}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILES}
                    className="hidden"
                    onChange={(e) => {
                        upload(e.target.files);
                        e.target.value = '';
                    }}
                />
                <button type="button" className="btn-primary" onClick={() => input.current?.click()} disabled={busy === 'upload'}>
                    {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload files
                </button>
            </div>

            {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}

            {files.length ? (
                <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                    {files.map((f) => (
                        <li key={f.document_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                                    <FileText className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium text-ink">{f.original_filename || f.filename}</p>
                                    <p className="text-[11px] text-muted">
                                        {humanize(f.category || 'other')} · {formatBytes(f.size_bytes)} · {formatDateTime(f.uploaded_at)}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                                onClick={() => remove(f.document_id)}
                                disabled={busy === f.document_id}
                                aria-label={`Remove ${f.filename}`}
                            >
                                {busy === f.document_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
                    <Paperclip className="h-4 w-4" />
                    No files attached yet.
                </p>
            )}
        </Panel>
    );
}

function LabelledInput({
    label,
    value,
    onChange,
    type = 'text'
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
}) {
    return (
        <label className="block">
            <span className="field-label">{label}</span>
            <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}

function TotalsBox({ totals }: { totals: any }) {
    const rows = [
        ['Subtotal', totals.subtotal_minor],
        ['Discount', totals.discount_minor],
        ['Tax', totals.tax_minor],
        ['Shipping', totals.shipping_minor],
        ['Other charges', totals.other_charges_minor]
    ].filter(([, v]) => v);

    return (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <dl className="space-y-1.5 text-[13px]">
                {rows.map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between">
                        <dt className="text-muted">{label}</dt>
                        <dd className="text-ink">{inr(value as number)}</dd>
                    </div>
                ))}
                <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
                    <dt>Grand total</dt>
                    <dd>{inr(totals.grand_total_minor)}</dd>
                </div>
            </dl>
            <p className="mt-2 text-[11px] text-slate-400">Totals are calculated by our server, not in your browser.</p>
        </div>
    );
}
