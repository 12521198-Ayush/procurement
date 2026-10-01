'use client';

import {
    Ban,
    CheckCircle2,
    CircleDot,
    ClipboardCheck,
    Eye,
    FileSignature,
    FileText,
    Gavel,
    PackageCheck,
    Receipt,
    Scale,
    Send,
    ShoppingCart,
    Truck,
    Wallet,
    XCircle,
    type LucideIcon
} from 'lucide-react';
import { EmptyState } from '@/components/ui/Card';
import { formatDateTime, formatMoney } from '@/lib/format';
import { humanize } from '@/lib/files';

export type TimelineEvent = {
    event_id: string;
    event_type: string;
    label: string;
    document_number?: string | null;
    previous_status?: string | null;
    new_status?: string | null;
    remarks?: string | null;
    amount_minor?: number | null;
    currency?: string | null;
    actor_type?: string;
    actor_name?: string | null;
    vendor_name?: string | null;
    ts: string;
};

function iconFor(type: string): { icon: LucideIcon; tone: string } {
    if (/CANCELLED|REJECTED|NOT_SELECTED/.test(type)) return { icon: /REJECTED|NOT_SELECTED/.test(type) ? XCircle : Ban, tone: 'bg-rose-50 text-rose-600' };
    if (/^RFQ_|VENDOR_INVITED/.test(type)) return { icon: type === 'RFQ_PUBLISHED' || type === 'VENDOR_INVITED' ? Send : FileText, tone: 'bg-brand-50 text-brand-600' };
    if (type === 'VENDOR_VIEWED_RFQ') return { icon: Eye, tone: 'bg-slate-100 text-slate-600' };
    if (/^QUOTATION/.test(type)) return { icon: FileSignature, tone: 'bg-violet-50 text-violet-600' };
    if (/^BID_/.test(type)) return { icon: Gavel, tone: 'bg-amber-50 text-amber-600' };
    if (type === 'VENDOR_SELECTED') return { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' };
    if (/^PO_/.test(type)) return { icon: ShoppingCart, tone: 'bg-brand-50 text-brand-600' };
    if (/^PI_/.test(type)) return { icon: FileText, tone: 'bg-violet-50 text-violet-600' };
    if (/^PAYMENT|^RECEIPT/.test(type)) return { icon: type.startsWith('RECEIPT') ? Receipt : Wallet, tone: 'bg-emerald-50 text-emerald-600' };
    if (/DISPATCH/.test(type)) return { icon: Truck, tone: 'bg-orange-50 text-orange-600' };
    if (/GOODS_RECEIVED|GRN/.test(type)) return { icon: type === 'GRN_INSPECTED' ? ClipboardCheck : PackageCheck, tone: 'bg-teal-50 text-teal-600' };
    if (/INVOICE/.test(type)) return { icon: Receipt, tone: 'bg-indigo-50 text-indigo-600' };
    if (/LEDGER/.test(type)) return { icon: Scale, tone: 'bg-slate-100 text-slate-600' };
    if (type === 'PROCUREMENT_COMPLETED') return { icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-700' };
    return { icon: CircleDot, tone: 'bg-slate-100 text-slate-600' };
}

/** Vertical lifecycle timeline: what happened, when, who did it, on which document. */
export default function Timeline({ events, emptyHint }: { events: TimelineEvent[]; emptyHint?: string }) {
    if (!events.length) return <EmptyState title="No events yet" hint={emptyHint} />;

    return (
        <ol className="relative space-y-0">
            {events.map((e, i) => {
                const { icon: Icon, tone } = iconFor(e.event_type);
                return (
                    <li key={e.event_id} className="relative flex gap-3 pb-5">
                        {i < events.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-px bg-line" aria-hidden />}
                        <span className={`relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-white ${tone}`}>
                            <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <p className="text-[13px] font-semibold text-ink">
                                    {e.label}
                                    {e.document_number && <span className="ml-1.5 font-medium text-brand-700">{e.document_number}</span>}
                                </p>
                                <time className="text-[11px] text-muted">{formatDateTime(e.ts)}</time>
                            </div>
                            <p className="text-[12px] text-muted">
                                {e.actor_name || 'System'}
                                {e.actor_type === 'vendor' ? ' (vendor)' : ''}
                                {e.vendor_name && e.actor_type !== 'vendor' ? ` · ${e.vendor_name}` : ''}
                                {e.previous_status && e.new_status ? ` · ${humanize(e.previous_status)} → ${humanize(e.new_status)}` : e.new_status ? ` · ${humanize(e.new_status)}` : ''}
                                {e.amount_minor != null ? ` · ${formatMoney(e.amount_minor, e.currency || 'INR')}` : ''}
                            </p>
                            {e.remarks && <p className="mt-0.5 text-[12px] text-slate-600">{e.remarks}</p>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
