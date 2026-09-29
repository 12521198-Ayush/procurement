'use client';

import { useEffect, useState } from 'react';

const BASE_URL = (process.env.NEXT_PUBLIC_ACCOUNTING_API_BASE_URL || 'https://www.servizing.com/api/reports').replace(/\/$/, '');

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export type Period = { startDate: string; endDate: string };

export type StatementLine = {
    account_id: string;
    account_name: string;
    account_type: AccountType;
    balance: number;
};

export type TrialBalance = {
    period: Period;
    is_balanced: boolean;
    grand_total_debits: number;
    grand_total_credits: number;
    accounts: {
        account_id: string;
        account_name: string;
        account_type: AccountType;
        total_debit: number;
        total_credit: number;
        net_balance: number;
    }[];
};

export type ProfitAndLoss = {
    period: Period;
    net_income: number;
    summary: { total_revenue: number; total_expenses: number };
    details: { revenue: StatementLine[]; expenses: StatementLine[] };
};

export type BalanceSheet = {
    period: Period;
    is_balanced: boolean;
    summary: {
        total_assets: number;
        total_liabilities: number;
        total_equity: number;
        current_year_earnings: number;
        total_liabilities_and_equity: number;
    };
    details: { assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[] };
};

export type ChartOfAccounts = {
    count: number;
    accounts: {
        _id: string;
        account_id: string;
        account_name: string;
        account_type: AccountType;
        financial_statement: string;
    }[];
};

export const ACCOUNT_TYPES: AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

export const TYPE_STYLE: Record<AccountType, { color: string; pill: string }> = {
    Asset: { color: '#34a4f6', pill: 'bg-brand-50 text-brand-700 ring-brand-200' },
    Liability: { color: '#f43f5e', pill: 'bg-rose-50 text-rose-700 ring-rose-200' },
    Equity: { color: '#8b5cf6', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
    Revenue: { color: '#10b981', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    Expense: { color: '#fbb12c', pill: 'bg-amber-50 text-amber-700 ring-amber-200' }
};

// Plain fetch on purpose: the procurement bearer token must not travel to another origin.
async function fetchReport<T>(path: string, period?: Period, signal?: AbortSignal): Promise<T> {
    const qs = period ? `?${new URLSearchParams(period).toString()}` : '';
    const res = await fetch(`${BASE_URL}/${path}${qs}`, { headers: { Accept: 'application/json' }, signal });
    if (!res.ok) throw new Error(`The accounts service answered ${res.status}. Please try again.`);
    return res.json();
}

export function useReport<T>(path: string, period?: Period) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    const start = period?.startDate;
    const end = period?.endDate;

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetchReport<T>(path, start && end ? { startDate: start, endDate: end } : undefined, controller.signal)
            .then(setData)
            .catch((err) => {
                if (controller.signal.aborted) return;
                setError(err?.message || 'Could not reach the accounts service.');
                setData(null);
            })
            .finally(() => !controller.signal.aborted && setLoading(false));

        return () => controller.abort();
    }, [path, start, end, nonce]);

    return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/** Local calendar date as YYYY-MM-DD; toISOString() would shift it across midnight in IST. */
export function toISODate(d: Date) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** Indian financial year: 1 April to 31 March. */
function fyStartYear(d: Date) {
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export type PresetKey = 'fy' | 'quarter' | 'month' | 'last_fy';

export const PRESETS: { value: PresetKey; label: string }[] = [
    { value: 'month', label: 'This month' },
    { value: 'quarter', label: 'This quarter' },
    { value: 'fy', label: 'This FY' },
    { value: 'last_fy', label: 'Last FY' }
];

export function presetPeriod(key: PresetKey, today = new Date()): Period {
    const fy = fyStartYear(today);
    switch (key) {
        case 'month':
            return {
                startDate: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)),
                endDate: toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
            };
        case 'quarter': {
            // FY quarters start in Apr, Jul, Oct, Jan - the same month boundaries as calendar quarters.
            const qStartMonth = today.getMonth() - (today.getMonth() % 3);
            return {
                startDate: toISODate(new Date(today.getFullYear(), qStartMonth, 1)),
                endDate: toISODate(new Date(today.getFullYear(), qStartMonth + 3, 0))
            };
        }
        case 'last_fy':
            return { startDate: `${fy - 1}-04-01`, endDate: `${fy}-03-31` };
        case 'fy':
        default:
            return { startDate: `${fy}-04-01`, endDate: `${fy + 1}-03-31` };
    }
}

export function periodLabel(p: Period) {
    const fmt = (s: string) =>
        new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(p.startDate)} – ${fmt(p.endDate)}`;
}

export function percentOf(part: number, whole: number) {
    if (!whole) return 0;
    return Math.round((part / whole) * 1000) / 10;
}
