'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Gavel, Loader2, Lock } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatDateTime } from '@/lib/format';

type BidStatus = {
    sealed: boolean;
    opening_at: string | null;
    opened_at: string | null;
    opened_by_name: string | null;
    opening_due: boolean;
    server_time: string;
    can_open: boolean;
    reason: string | null;
    quotations_received: number;
    rfq_number: string;
};

/**
 * "Bid Opening Pending" state with a countdown on the SERVER's clock (offset
 * corrected), and the open-bids action. The button is a convenience only: the
 * server re-checks canOpenBid() and refuses early opening regardless.
 */
export default function BidOpeningPanel({ rfqId, onOpened }: { rfqId: string; onOpened?: () => void }) {
    const toast = useToast();
    const { data, loading, reload } = useResource<BidStatus>('/procurement/rfq/bid-status', { rfq_id: rfqId });
    const [now, setNow] = useState(Date.now());
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);

    const offset = data ? new Date(data.server_time).getTime() - Date.now() : 0;
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    if (loading || !data) return <div className="h-20 animate-pulse rounded-xl bg-slate-100" />;

    async function open() {
        setBusy(true);
        try {
            const res = await post<{ quotations_opened: number }>('/procurement/rfq/open-bid', { rfq_id: rfqId });
            toast.success(`Bids opened - ${res.quotations_opened} quotation(s) unsealed`);
            setConfirm(false);
            reload();
            onOpened?.();
        } catch (err: any) {
            toast.error(err.message);
            reload();
        } finally {
            setBusy(false);
        }
    }

    if (!data.sealed) {
        return (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                <span>
                    Bids opened {formatDateTime(data.opened_at)}
                    {data.opened_by_name ? ` by ${data.opened_by_name}` : ''}. {data.quotations_received} quotation(s) are open for evaluation.
                </span>
            </div>
        );
    }

    const remaining = data.opening_at ? new Date(data.opening_at).getTime() - (now + offset) : 0;
    const due = remaining <= 0;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
                    <Lock className="h-5 w-5" />
                </span>
                <div>
                    <p className="text-[13px] font-semibold text-amber-900">{due ? 'Bid opening available' : 'Bid opening pending'}</p>
                    <p className="text-[12px] text-amber-800">
                        {data.quotations_received} sealed quotation(s). Scheduled {formatDateTime(data.opening_at)}
                        {!due && (
                            <span className="ml-2 inline-flex items-center gap-1 font-semibold">
                                <Clock className="h-3.5 w-3.5" />
                                {formatRemaining(remaining)}
                            </span>
                        )}
                    </p>
                    {!data.can_open && due && data.reason && <p className="text-[12px] text-amber-700">{data.reason}</p>}
                </div>
            </div>
            <button type="button" className="btn-primary" disabled={!due || !data.can_open} onClick={() => setConfirm(true)} title={data.reason || undefined}>
                <Gavel className="h-4 w-4" />
                Open bids
            </button>

            <Modal
                open={confirm}
                onClose={() => setConfirm(false)}
                title={`Open bids for ${data.rfq_number}?`}
                description="This is recorded with your name, the time and your device, and cannot be undone."
                size="sm"
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>
                            Cancel
                        </button>
                        <button type="button" className="btn-primary" onClick={open} disabled={busy}>
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                            Open {data.quotations_received} bid(s)
                        </button>
                    </>
                }
            >
                <p className="text-[13px] text-slate-600">All quotation prices, documents and terms become visible to evaluators.</p>
            </Modal>
        </div>
    );
}

function formatRemaining(ms: number) {
    const s = Math.max(Math.floor(ms / 1000), 0);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${h}h left`;
    if (h) return `${h}h ${m}m left`;
    return `${m}m ${s % 60}s left`;
}
