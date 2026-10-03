'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
    BarChart3,
    BookOpenText,
    Boxes,
    Briefcase,
    Building2,
    ChevronDown,
    FileCheck2,
    FileSpreadsheet,
    FileText,
    Headset,
    Landmark,
    LayoutDashboard,
    Network,
    Package,
    PiggyBank,
    Quote,
    Receipt,
    Settings,
    ShoppingCart,
    Tags,
    TrendingUp,
    Truck,
    Users,
    Wallet,
    Warehouse,
    type LucideIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

type NavItem = { href: string; label: string; icon: LucideIcon; multiPremiseOnly?: boolean };
type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

/** Top-level links shown above the grouped sections. */
export const NAV_ITEMS: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/cluster', label: 'Cluster View', icon: Network, multiPremiseOnly: true }
];

export const NAV_GROUPS: NavGroup[] = [
    {
        id: 'procurement',
        label: 'Procurement',
        icon: Package,
        items: [
            { href: '/rfq', label: 'Raise Bid / RFQ', icon: FileText },
            { href: '/quotations', label: 'My Quotations', icon: Quote },
            { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
            { href: '/proforma-invoices', label: 'Proforma Invoices', icon: FileCheck2 }
        ]
    },
    {
        id: 'receiving',
        label: 'Dispatch & Receiving',
        icon: Truck,
        items: [{ href: '/receiving', label: 'Dispatch & GRN', icon: Truck }]
    },
    {
        id: 'finance',
        label: 'Finance & Payments',
        icon: Wallet,
        items: [
            { href: '/payments', label: 'Invoices & Payments', icon: Receipt },
            { href: '/tax-invoices', label: 'Tax Invoices', icon: FileSpreadsheet },
            { href: '/vendor-ledger', label: 'Vendor Ledger', icon: BookOpenText },
            { href: '/accounts', label: 'Accounts & Financials', icon: Landmark }
        ]
    },
    {
        id: 'inventory',
        label: 'Inventory',
        icon: Warehouse,
        items: [{ href: '/inventory', label: 'Inventory', icon: Boxes }]
    },
    {
        id: 'vendors',
        label: 'Vendors',
        icon: Users,
        items: [{ href: '/vendors', label: 'Vendors', icon: Users }]
    },
    {
        id: 'reports',
        label: 'Reports & Analytics',
        icon: BarChart3,
        items: [{ href: '/reports', label: 'Reports & Analytics', icon: TrendingUp }]
    },
    {
        id: 'admin',
        label: 'Administration',
        icon: Briefcase,
        items: [
            { href: '/budget', label: 'Budget & Approvals', icon: PiggyBank },
            { href: '/categories', label: 'Categories', icon: Tags },
            { href: '/departments', label: 'Departments', icon: Building2 },
            { href: '/settings', label: 'Settings', icon: Settings }
        ]
    }
];

const OPEN_GROUPS_KEY = 'procurepro.sidebar.openGroups';

function isActivePath(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function readOpenGroups(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(OPEN_GROUPS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { isMultiPremise } = useAuth();
    const visible = (item: NavItem) => !item.multiPremiseOnly || isMultiPremise;
    const items = NAV_ITEMS.filter(visible);
    const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length);
    const activeGroupId = groups.find((g) => g.items.some((i) => isActivePath(pathname, i.href)))?.id ?? null;

    // Groups are closed by default except the one holding the current page;
    // explicit user toggles are remembered across sessions.
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    useEffect(() => {
        const saved = readOpenGroups();
        if (activeGroupId) saved[activeGroupId] = true;
        setOpenGroups(saved);
    }, [activeGroupId]);

    const isOpen = (id: string) => openGroups[id] ?? id === activeGroupId;
    const toggleGroup = useCallback((id: string, currentlyOpen: boolean) => {
        setOpenGroups((prev) => {
            const next = { ...prev, [id]: !currentlyOpen };
            localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const renderLink = ({ href, label, icon: Icon }: NavItem, nested = false) => {
        const active = isActivePath(pathname, href);
        return (
            <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                    'flex items-center gap-3 rounded-lg text-[13px] font-medium transition',
                    nested ? 'py-2 pl-9 pr-3' : 'px-3 py-2.5',
                    active
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )}
            >
                <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
                <span className="truncate">{label}</span>
            </Link>
        );
    };

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

            <nav className="flex-1 overflow-y-auto px-3 pb-4">
                <div className="space-y-0.5">{items.map((item) => renderLink(item))}</div>

                <div className="mt-3 space-y-1">
                    {groups.map((group) => {
                        const open = isOpen(group.id);
                        const groupActive = group.id === activeGroupId;
                        const GroupIcon = group.icon;
                        return (
                            <div key={group.id}>
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.id, open)}
                                    aria-expanded={open}
                                    aria-controls={`nav-group-${group.id}`}
                                    className={clsx(
                                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider transition',
                                        groupActive ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    <GroupIcon
                                        className={clsx('h-[17px] w-[17px] shrink-0', groupActive && 'text-brand-400')}
                                        strokeWidth={1.9}
                                    />
                                    <span className="flex-1 truncate">{group.label}</span>
                                    {groupActive && !open && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />}
                                    <ChevronDown
                                        className={clsx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
                                        strokeWidth={2}
                                    />
                                </button>
                                {open && (
                                    <div id={`nav-group-${group.id}`} className="mt-0.5 space-y-0.5">
                                        {group.items.map((item) => renderLink(item, true))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
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
