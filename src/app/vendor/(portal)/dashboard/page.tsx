'use client';

import Link from 'next/link';
import { Award, Bell, FilePen, FileText, Inbox, PackageCheck, Receipt, Send, ShoppingCart, Truck, Wallet } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import Timeline from '@/components/procurement/Timeline';
import { P } from '@/lib/vendor-api';
import { useVendorResource } from '@/lib/vendor-hooks';

const TILES = [
    { key: 'new_rfqs', label: 'New RFQs', icon: Inbox, href: '/vendor/rfqs?stage=new' },
    { key: 'pending_quotations', label: 'Quotations in draft', icon: FilePen, href: '/vendor/rfqs?stage=in_progress' },
    { key: 'submitted_quotations', label: 'Submitted quotations', icon: Send, href: '/vendor/rfqs?stage=submitted' },
    { key: 'awarded_rfqs', label: 'Awarded', icon: Award, href: '/vendor/rfqs?stage=awarded' },
    { key: 'purchase_orders', label: 'Purchase orders', icon: ShoppingCart, href: '/vendor/orders' },
    { key: 'pos_awaiting_acceptance', label: 'POs to accept', icon: ShoppingCart, href: '/vendor/orders?stage=to_accept' },
    { key: 'pending_pis', label: 'PIs pending', icon: FileText, href: '/vendor/orders' },
    { key: 'approved_pis_unpaid', label: 'PIs approved, unpaid', icon: Wallet, href: '/vendor/payments' },
    { key: 'payments_received', label: 'Payments received', icon: Wallet, href: '/vendor/payments' },
    { key: 'pending_dispatches', label: 'Pending dispatches', icon: Truck, href: '/vendor/orders?stage=to_dispatch' },
    { key: 'dispatched_orders', label: 'Dispatches made', icon: Truck, href: '/vendor/orders' },
    { key: 'grns', label: 'GRNs posted', icon: PackageCheck, href: '/vendor/orders' },
    { key: 'open_invoices', label: 'Open invoices', icon: Receipt, href: '/vendor/orders' },
    { key: 'unread_notifications', label: 'Unread notifications', icon: Bell, href: '/vendor/notifications' }
];

export default function VendorDashboardPage() {
    const { data, loading, error } = useVendorResource<any>(P + 'dashboard', {});

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
                <p className="mt-0.5 text-[13px] text-muted">Everything waiting on you, and everything you are waiting on.</p>
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {TILES.map(({ key, label, icon: Icon, href }) => (
                    <Link key={key} href={href} className="card px-3.5 py-3 transition hover:border-brand-300">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                            <Icon className="h-4 w-4" />
                        </span>
                        <p className="mt-2 text-xl font-semibold text-ink">{loading ? '…' : data?.counts?.[key] ?? 0}</p>
                        <p className="truncate text-[11px] font-medium text-muted">{label}</p>
                    </Link>
                ))}
            </div>
            <Card>
                <CardHeader title="Recent activity" />
                {loading ? <div className="h-24 animate-pulse rounded-lg bg-slate-100" /> : <Timeline events={data?.recent_events || []} emptyHint="Activity on your RFQs and orders appears here." />}
            </Card>
        </div>
    );
}
