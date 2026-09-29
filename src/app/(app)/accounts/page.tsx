'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { CalendarClock, FilePlus2, RefreshCw } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { PeriodPicker, ReportSkeleton } from '@/components/accounting/AccountingUI';
import { BalanceSheetView, ChartOfAccountsView, Hero, Overview, ProfitAndLossView, TrialBalanceView } from '@/components/accounting/Statements';
import { GstReports, TdsReportView } from '@/components/accounting/TaxReports';
import { PayablesAging } from '@/components/accounting/PayablesAging';
import RecordInvoiceModal from '@/components/accounting/RecordInvoiceModal';
import { useAuth } from '@/lib/auth';
import {
    presetPeriod,
    useReport,
    type BalanceSheet,
    type ChartOfAccounts,
    type Period,
    type PresetKey,
    type ProfitAndLoss,
    type TrialBalance
} from '@/lib/accounting';

const STATEMENT_TABS = ['overview', 'pnl', 'bs', 'tb', 'coa'];

export default function AccountsPage() {
    const { activePremiseId, activePremiseName } = useAuth();
    const [preset, setPreset] = useState<PresetKey | 'custom'>('fy');
    const [period, setPeriod] = useState<Period>(() => presetPeriod('fy'));
    const [tab, setTab] = useState('overview');
    const [invoiceOpen, setInvoiceOpen] = useState(false);
    // Bumping this remounts the active tab so its own reports refetch.
    const [refreshKey, setRefreshKey] = useState(0);

    const pnl = useReport<ProfitAndLoss>('profit-and-loss', period);
    const bs = useReport<BalanceSheet>('balance-sheet', period);
    const tb = useReport<TrialBalance>('trial-balance', period);
    const coa = useReport<ChartOfAccounts>('chart-of-accounts');

    const isStatement = STATEMENT_TABS.includes(tab);
    const statementsLoading = pnl.loading || bs.loading || tb.loading;
    const statementsError = pnl.error || bs.error || tb.error;
    const expenseAccounts = (coa.data?.accounts ?? []).filter((a) => a.account_type === 'Expense');

    function reloadAll() {
        pnl.reload();
        bs.reload();
        tb.reload();
        coa.reload();
        setRefreshKey((k) => k + 1);
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Accounts & Financials"
                subtitle={
                    activePremiseName
                        ? `Books, GST and payables for ${activePremiseName}.`
                        : 'Books, GST and payables for the selected society.'
                }
                action={
                    <div className="flex gap-2">
                        <button type="button" className="btn-ghost h-9 text-[13px]" onClick={reloadAll} disabled={statementsLoading}>
                            <RefreshCw className={clsx('h-4 w-4', statementsLoading && 'animate-spin')} />
                            Refresh
                        </button>
                        <button type="button" className="btn-primary h-9 text-[13px]" onClick={() => setInvoiceOpen(true)} disabled={!activePremiseId}>
                            <FilePlus2 className="h-4 w-4" />
                            Record vendor invoice
                        </button>
                    </div>
                }
            />

            <Tabs
                tabs={[
                    { value: 'overview', label: 'Overview' },
                    { value: 'pnl', label: 'Profit & Loss' },
                    { value: 'bs', label: 'Balance Sheet' },
                    { value: 'tb', label: 'Trial Balance' },
                    { value: 'gst', label: 'GST Returns' },
                    { value: 'tds', label: 'TDS' },
                    { value: 'ap', label: 'Payables Ageing' },
                    { value: 'coa', label: 'Chart of Accounts', count: coa.data?.count }
                ]}
                active={tab}
                onChange={setTab}
            />

            {tab === 'ap' ? (
                <p className="flex items-center gap-1.5 text-[12px] text-muted">
                    <CalendarClock className="h-4 w-4" />
                    Ageing is always calculated as of today, so it ignores the date range.
                </p>
            ) : (
                <PeriodPicker
                    period={period}
                    preset={preset}
                    onChange={(p, key) => {
                        setPeriod(p);
                        setPreset(key);
                    }}
                />
            )}

            <div key={refreshKey}>
                {isStatement &&
                    (statementsError ? (
                        <Card>
                            <EmptyState title="Could not load financial statements" hint={statementsError} />
                            <div className="flex justify-center pb-4">
                                <button type="button" className="btn-primary h-9 text-[13px]" onClick={reloadAll}>
                                    Try again
                                </button>
                            </div>
                        </Card>
                    ) : statementsLoading || !pnl.data || !bs.data || !tb.data ? (
                        <ReportSkeleton />
                    ) : (
                        <div className="space-y-5">
                            {tab !== 'coa' && <Hero pnl={pnl.data} bs={bs.data} tb={tb.data} />}
                            {tab === 'overview' && <Overview pnl={pnl.data} bs={bs.data} />}
                            {tab === 'pnl' && <ProfitAndLossView pnl={pnl.data} />}
                            {tab === 'bs' && <BalanceSheetView bs={bs.data} />}
                            {tab === 'tb' && <TrialBalanceView tb={tb.data} />}
                            {tab === 'coa' && <ChartOfAccountsView coa={coa.data} loading={coa.loading} error={coa.error} active={tb.data} />}
                        </div>
                    ))}

                {tab === 'gst' && <GstReports period={period} onRecordInvoice={() => setInvoiceOpen(true)} />}
                {tab === 'tds' && <TdsReportView period={period} />}
                {tab === 'ap' && <PayablesAging />}
            </div>

            <RecordInvoiceModal
                open={invoiceOpen}
                onClose={() => setInvoiceOpen(false)}
                onRecorded={reloadAll}
                premiseId={activePremiseId}
                expenseAccounts={expenseAccounts}
            />
        </div>
    );
}
