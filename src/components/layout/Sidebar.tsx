'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
    Boxes,
    Building2,
    FileSpreadsheet,
    FileText,
    Headset,
    Landmark,
    LayoutDashboard,
    Network,
    PiggyBank,
    Quote,
    Receipt,
    Settings,
    ShoppingCart,
    Tags,
    TrendingUp,
    Users,
    type LucideIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

type NavItem = { href: string; label: string; icon: LucideIcon; multiPremiseOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/cluster', label: 'Cluster View', icon: Network, multiPremiseOnly: true },
    { href: '/rfq', label: 'Raise Bid / RFQ', icon: FileText },
    { href: '/quotations', label: 'My Quotations', icon: Quote },
    { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/payments', label: 'Invoices & Payments', icon: Receipt },
    { href: '/tax-invoices', label: 'Tax Invoices', icon: FileSpreadsheet },
    { href: '/inventory', label: 'Inventory', icon: Boxes },
    { href: '/budget', label: 'Budget & Approvals', icon: PiggyBank },
    { href: '/reports', label: 'Reports & Analytics', icon: TrendingUp },
    { href: '/accounts', label: 'Accounts & Financials', icon: Landmark },
    { href: '/vendors', label: 'Vendors', icon: Users },
    { href: '/categories', label: 'Categories', icon: Tags },
    { href: '/departments', label: 'Departments', icon: Building2 },
    { href: '/settings', label: 'Settings', icon: Settings }
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { isMultiPremise } = useAuth();
    const items = NAV_ITEMS.filter((item) => !item.multiPremiseOnly || isMultiPremise);

    return (
        <aside className="flex h-full w-[248px] shrink-0 flex-col bg-navy-900 text-slate-300">
            <div className="flex items-center gap-2.5 px-5 py-5">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1.5">
                    <Image src="/servizing-logo.png" alt="ServiZing" width={40} height={45} priority className="h-full w-full object-contain" />
                </div>
                <div className="leading-tight">
                    <p className="text-[15px] font-semibold text-white">ProcurePro</p>
                    <p className="text-[10px] tracking-wide text-slate-400">Buy Smarter · <span className="text-accent-400">Manage Better</span></p>
                </div>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
                {items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                        <Link
                            key={href}
                            href={href}
                            onClick={onNavigate}
                            className={clsx(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition',
                                active
                                    ? 'bg-brand-600 text-white shadow-sm'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            )}
                        >
                            <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
                            <span className="truncate">{label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="m-3 rounded-xl bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white">
                    <Headset className="h-4 w-4" strokeWidth={2} />
                    <p className="text-[13px] font-semibold">Need Help?</p>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Our team is here to help you with procurement queries.
                </p>
                <a
                    href="mailto:support@servizing.com"
                    className="mt-3 flex h-8 items-center justify-center rounded-lg bg-brand-600 text-[12px] font-medium text-white transition hover:bg-brand-700"
                >
                    Get Support
                </a>
            </div>
        </aside>
    );
}
