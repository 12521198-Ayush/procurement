'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Search } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth';

/**
 * Picks which society the whole app is working in. Everything downstream reads
 * through the request interceptor, so switching here re-scopes every screen -
 * including the one the user is currently looking at.
 */
export default function PremiseSwitcher() {
    const { premises, activePremiseId, activePremiseName, isMultiPremise, switchPremise } = useAuth();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickAway(e: MouseEvent) {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onClickAway);
        return () => document.removeEventListener('mousedown', onClickAway);
    }, []);

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return premises;
        return premises.filter((p) => p.premise_name.toLowerCase().includes(term));
    }, [premises, query]);

    if (!premises.length) return null;

    // A single-society user has nothing to switch between; show it as a label.
    if (!isMultiPremise) {
        return (
            <span className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-600 sm:inline-flex">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="max-w-[180px] truncate">{activePremiseName}</span>
            </span>
        );
    }

    return (
        <div className="relative" ref={boxRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-slate-50"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <Building2 className="h-4 w-4 text-brand-600" />
                <span className="max-w-[90px] truncate sm:max-w-[180px]">{activePremiseName || 'Select society'}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {open && (
                <div className="absolute left-0 z-40 mt-2 w-72 rounded-xl border border-line bg-white p-1.5 shadow-pop">
                    <div className="px-1.5 pb-1.5 pt-1">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search society"
                                className="h-8 w-full rounded-lg border border-line pl-8 pr-2 text-[13px] outline-none focus:border-brand-500"
                            />
                        </div>
                    </div>

                    <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                        {premises.length} societies assigned
                    </p>

                    <div className="max-h-64 overflow-y-auto">
                        {filtered.map((p) => {
                            const active = p.premise_id === activePremiseId;
                            return (
                                <button
                                    key={p.premise_id}
                                    type="button"
                                    onClick={() => {
                                        switchPremise(p.premise_id);
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                    className={clsx(
                                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px]',
                                        active ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                                    )}
                                >
                                    <span className="min-w-0 flex-1 truncate">{p.premise_name}</span>
                                    {active && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                            );
                        })}

                        {!filtered.length && (
                            <p className="px-3 py-4 text-center text-[13px] text-muted">No society matches that.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
