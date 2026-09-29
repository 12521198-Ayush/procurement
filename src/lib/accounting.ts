'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth';

const BASE_URL = (process.env.NEXT_PUBLIC_ACCOUNTING_API_BASE_URL || 'https://www.servizing.com/api/reports').replace(/\/$/, '');

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export type Period = { startDate: string; endDate: string };

export type TaxSplit = { cgst: number; sgst: number; igst: number; total: number };

export type Gstr1 = {
    period: Period;
    total_invoices: number;
    data: {
        invoice_number: string;
        customer_gstin: string;
        hsn_sac_code: string;
        invoice_date: string;
        taxable_value: number | null;
        total_cgst: number;
        total_sgst: number;
        total_igst: number;
        total_invoice_value: number;
    }[];
};

export type Gstr2b = {
    period: Period;
    total_invoices: number;
    data: {
        invoice_number: string;
        gstin_of_supplier: string;
        taxable_value: number | null;
        total_cgst: number;
        total_sgst: number;
        total_igst: number;
        total_tax: number;
    }[];
};

export type Gstr3b = {
    period: Period;
    data: { output_tax: TaxSplit; input_tax_credit: TaxSplit; net_tax_payable: TaxSplit };
};

// The TDS row shape is not published yet, so it is rendered generically.
export type TdsReport = { period: Period; data: Record<string, unknown>[] };

export type AgingBucket = '0_to_30_days' | '31_to_60_days' | '61_to_90_days' | 'over_90_days';

export type ApAging = {
    premise_id: string;
    as_of_date: string;
    report: Record<AgingBucket, number> & {
        total_outstanding: number;
        vendors: {
            vendor_identifier: string;
            last_invoice_date: string;
            total_invoiced: number;
            total_paid: number;
            outstanding_balance: number;
            days_outstanding: number;
            bucket: AgingBucket;
        }[];
    };
};

export type VendorInvoiceInput = {
    vendor_name: string;
    vendor_gstin: string;
    premise_gst: string;
    invoice_number: string;
    hsn_sac_code: string;
    base_amount: number;
    expense_account_id: string;
};

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

async function readError(res: Response) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message || body?.error || body?.message;
    return new Error(typeof message === 'string' ? message : `The accounts service answered ${res.status}. Please try again.`);
}

// Plain fetch on purpose: the procurement bearer token must not travel to another origin.
async function fetchReport<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${BASE_URL}/${path}?${new URLSearchParams(params).toString()}`, {
        headers: { Accept: 'application/json' },
        signal
    });
    if (!res.ok) throw await readError(res);
    return res.json();
}

/** Every report is scoped to the society selected in the top bar. */
export function useReport<T>(path: string, period?: Period) {
    const { activePremiseId } = useAuth();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    const start = period?.startDate;
    const end = period?.endDate;

    useEffect(() => {
        if (!activePremiseId) {
            setData(null);
            setLoading(false);
            setError('Select a society to view its accounts.');
            return;
        }

        const controller = new AbortController();
        const params: Record<string, string> = { premise_id: activePremiseId };
        if (start && end) Object.assign(params, { startDate: start, endDate: end });

        setLoading(true);
        setError(null);
        fetchReport<T>(path, params, controller.signal)
            .then(setData)
            .catch((err) => {
                if (controller.signal.aborted) return;
                setError(err?.message || 'Could not reach the accounts service.');
                setData(null);
            })
            .finally(() => !controller.signal.aborted && setLoading(false));

        return () => controller.abort();
    }, [path, start, end, nonce, activePremiseId]);

    return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

export async function recordVendorInvoice(premiseId: string, input: VendorInvoiceInput) {
    const res = await fetch(`${BASE_URL}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ premise_id: premiseId, ...input })
    });
    if (!res.ok) throw await readError(res);
    return res.json().catch(() => ({}));
}

// This ledger reports whole rupees (with paise as decimals), unlike procurement's integer paise.
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export function formatINR(rupees: number | null | undefined) {
    return INR.format(rupees ?? 0);
}

export function formatINRCompact(rupees: number | null | undefined) {
    const v = rupees ?? 0;
    if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
    if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
    return formatINR(v);
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
