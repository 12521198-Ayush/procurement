'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Search, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import NotificationBell from './NotificationBell';
import PremiseSwitcher from './PremiseSwitcher';

export default function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
    const { user, signOut } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickAway(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        }
        document.addEventListener('mousedown', onClickAway);
        return () => document.removeEventListener('mousedown', onClickAway);
    }, []);

    const initials = (user?.name || '')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
            <button
                type="button"
                onClick={onOpenSidebar}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
            >
                <Menu className="h-5 w-5" />
            </button>

            <PremiseSwitcher />

            <div className="relative hidden max-w-md flex-1 sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    className="input pl-9"
                    placeholder="Search RFQ, vendor, purchase order..."
                    aria-label="Search"
                />
            </div>

            <div className="ml-auto flex items-center gap-2">
                <NotificationBell />

                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-slate-100"
                    >
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                            {initials || <User className="h-4 w-4" />}
                        </span>
                        <span className="hidden text-left leading-tight sm:block">
                            <span className="block text-[13px] font-semibold text-ink">{user?.name}</span>
                            <span className="block text-[11px] text-muted">{user?.role}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop">
                            <div className="px-3 py-2">
                                <p className="truncate text-[13px] font-semibold text-ink">{user?.name}</p>
                                <p className="truncate text-[11px] text-muted">{user?.email}</p>
                            </div>
                            <div className="my-1 h-px bg-line" />
                            <button
                                type="button"
                                onClick={signOut}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                            >
                                <LogOut className="h-4 w-4" />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
