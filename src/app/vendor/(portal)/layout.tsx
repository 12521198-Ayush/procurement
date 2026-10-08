'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Bell, FileText, LayoutDashboard, LogOut, Menu, Scale, ShoppingCart, Wallet, X, type LucideIcon } from 'lucide-react';
import { P, VENDOR_PROFILE_KEY, VENDOR_TOKEN_KEY, trackVendorPageView } from '@/lib/vendor-api';
import { useVendorResource } from '@/lib/vendor-hooks';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/vendor/rfqs', label: 'RFQs & Quotations', icon: FileText },
    { href: '/vendor/orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/vendor/payments', label: 'Payments', icon: Wallet },
    { href: '/vendor/ledger', label: 'Ledger', icon: Scale },
    { href: '/vendor/notifications', label: 'Notifications', icon: Bell }
];

export default function VendorPortalLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [ready, setReady] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem(VENDOR_TOKEN_KEY)) router.replace('/vendor/login');
        else setReady(true);
    }, [router]);

    useEffect(() => {
        if (ready) trackVendorPageView(pathname);
    }, [ready, pathname]);

    const me = useVendorResource<any>(ready ? P + 'me' : null, {});
    const unread = useVendorResource<any>(ready ? P + 'notifications/list' : null, { limit: 1, path: pathname });

    function signOut() {
        localStorage.removeItem(VENDOR_TOKEN_KEY);
        localStorage.removeItem(VENDOR_PROFILE_KEY);
        router.replace('/vendor/login');
    }

    if (!ready) {
        return (
            <div className="grid min-h-screen place-items-center bg-canvas">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
        );
    }

    const nav = (
        <nav className="space-y-0.5 px-3">
            {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                    <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition', active ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}
                    >
                        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
                        <span className="flex-1 truncate">{label}</span>
                        {href === '/vendor/notifications' && unread.data?.unread_count > 0 && (
                            <span className="rounded-full bg-accent-400 px-1.5 text-[10px] font-semibold text-navy-900">{unread.data.unread_count}</span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );

    const brand = (
        <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white p-1.5">
                <Image src="/servizing-logo.png" alt="ServiZing" width={36} height={41} className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
                <p className="text-[15px] font-semibold text-white">ProcurePro</p>
                <p className="text-[10px] tracking-wide text-slate-400">Vendor portal</p>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-canvas">
            <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col bg-navy-900 lg:flex">
                {brand}
                {nav}
            </aside>
            {open && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden />
                    <aside className="absolute inset-y-0 left-0 w-[232px] bg-navy-900">
                        <div className="flex items-center justify-between pr-3">
                            {brand}
                            <button type="button" onClick={() => setOpen(false)} className="text-slate-300" aria-label="Close menu">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {nav}
                    </aside>
                </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:px-6">
                    <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
                        <Menu className="h-5 w-5 text-slate-600" />
                    </button>
                    <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">{me.data?.company_name || 'Vendor'}</p>
                        <p className="truncate text-[11px] text-muted">
                            {me.data?.accounts?.length ? `Supplying ${me.data.accounts.map((a: any) => a.premise_name).join(', ')}` : ' '}
                        </p>
                    </div>
                    <button type="button" className="btn-ghost h-9" onClick={signOut}>
                        <LogOut className="h-4 w-4" /> Sign out
                    </button>
                </header>
                <main className="flex-1 p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
