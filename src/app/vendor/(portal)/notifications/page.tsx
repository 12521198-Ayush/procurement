'use client';

import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { P, vendorPost } from '@/lib/vendor-api';
import { useVendorList } from '@/lib/vendor-hooks';
import { formatDateTime } from '@/lib/format';

export default function VendorNotificationsPage() {
    const toast = useToast();
    const list = useVendorList<any>(P + 'notifications/list', {}, 50);

    async function markAll() {
        try {
            await vendorPost(P + 'notifications/mark-read', {});
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    async function open(n: any) {
        if (!n.is_read) vendorPost(P + 'notifications/mark-read', { notification_id: n.notification_id }).catch(() => undefined);
    }

    return (
        <div>
            <PageHeader title="Notifications" action={<button type="button" className="btn-ghost" onClick={markAll}><CheckCheck className="h-4 w-4" /> Mark all read</button>} />
            <Card padded={false}>
                {list.loading ? (
                    <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}</div>
                ) : list.rows.length ? (
                    <ul className="divide-y divide-line">
                        {list.rows.map((n) => (
                            <li key={n.notification_id}>
                                <Link href={n.link || '/vendor/dashboard'} onClick={() => open(n)} className={`flex gap-3 px-5 py-3.5 hover:bg-slate-50 ${n.is_read ? '' : 'bg-brand-50/40'}`}>
                                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${n.is_read ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-600'}`}><Bell className="h-4 w-4" /></span>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-ink">{n.title}</p>
                                        {n.message && <p className="text-[12px] text-slate-600">{n.message}</p>}
                                        <p className="text-[11px] text-muted">{formatDateTime(n.ts)}</p>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState title="No notifications yet" />
                )}
            </Card>
        </div>
    );
}
