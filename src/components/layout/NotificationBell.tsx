'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';

type Note = { notification_id: string; title: string; message: string | null; link: string | null; is_read: boolean; ts: string };

/** Bell + dropdown over the in-app notifications written by lifecycle events. */
export default function NotificationBell() {
    const { activePremiseId } = useAuth();
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<Note[]>([]);
    const [unread, setUnread] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    async function load(background = false) {
        try {
            const res = await post<{ array: Note[]; unread_count: number }>('/procurement/notifications/list', { limit: 12 }, { background });
            setRows(res.array);
            setUnread(res.unread_count);
        } catch {
            // The bell is non-essential; a failure here should not disturb the page.
        }
    }

    useEffect(() => {
        load();
        const t = setInterval(() => load(true), 60000);
        return () => clearInterval(t);
    }, [activePremiseId]);

    useEffect(() => {
        function away(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, []);

    async function markAll() {
        await post('/procurement/notifications/mark-read', {}).catch(() => undefined);
        load();
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => {
                    setOpen((v) => !v);
                    if (!open) load();
                }}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
            >
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-accent-400 px-1 text-[10px] font-semibold leading-4 text-navy-900 ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-line bg-white shadow-pop">
                    <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                        <p className="text-[13px] font-semibold text-ink">Notifications</p>
                        {unread > 0 && (
                            <button type="button" onClick={markAll} className="text-[12px] font-medium text-brand-600">
                                Mark all read
                            </button>
                        )}
                    </div>
                    <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                        {rows.map((n) => (
                            <li key={n.notification_id}>
                                <Link
                                    href={n.link || '/dashboard'}
                                    onClick={() => {
                                        setOpen(false);
                                        if (!n.is_read) post('/procurement/notifications/mark-read', { notification_id: n.notification_id }).then(() => load()).catch(() => undefined);
                                    }}
                                    className={`block px-4 py-2.5 hover:bg-slate-50 ${n.is_read ? '' : 'bg-brand-50/50'}`}
                                >
                                    <p className="text-[13px] font-medium text-ink">{n.title}</p>
                                    {n.message && <p className="line-clamp-2 text-[12px] text-slate-600">{n.message}</p>}
                                    <p className="text-[11px] text-muted">{timeAgo(n.ts)}</p>
                                </Link>
                            </li>
                        ))}
                        {!rows.length && <li className="px-4 py-6 text-center text-[13px] text-muted">You are all caught up.</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}
