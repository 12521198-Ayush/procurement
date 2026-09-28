'use client';

import { useEffect, useState } from 'react';
import { Mail, Save, Shield, SlidersHorizontal } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/hooks';

export default function SettingsPage() {
    const { user, can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState('general');
    const { data, loading, reload } = useResource<any>('/procurement/settings/get', {});
    const [busy, setBusy] = useState(false);

    const canEdit = can('SETTINGS_EDIT');

    async function save(form: FormData) {
        setBusy(true);
        try {
            await post('/procurement/settings/update', {
                general: {
                    currency: form.get('currency'),
                    timezone: form.get('timezone'),
                    rfq_default_validity_days: Number(form.get('rfq_default_validity_days') || 7)
                },
                from_name: form.get('from_name'),
                reply_to: form.get('reply_to')
            });
            toast.success('Settings saved');
            reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (loading || !data) return <div className="h-64 animate-pulse rounded-xl bg-slate-200" />;

    return (
        <div>
            <PageHeader title="Settings" subtitle="Defaults and delivery configuration for your procurement workspace." />

            <div className="mb-4">
                <Tabs
                    tabs={[
                        { value: 'general', label: 'General' },
                        { value: 'email', label: 'Email' },
                        { value: 'roles', label: 'Roles & permissions' }
                    ]}
                    active={tab}
                    onChange={setTab}
                />
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    save(new FormData(e.currentTarget));
                }}
            >
                {tab === 'general' && (
                    <Card>
                        <CardHeader title="General" />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Currency">
                                <Select
                                    name="currency"
                                    defaultValue={data.general.currency}
                                    disabled={!canEdit}
                                    options={[
                                        { value: 'INR', label: 'Indian Rupee (INR)' },
                                        { value: 'USD', label: 'US Dollar (USD)' },
                                        { value: 'EUR', label: 'Euro (EUR)' }
                                    ]}
                                />
                            </Field>
                            <Field label="Timezone">
                                <Input name="timezone" defaultValue={data.general.timezone} disabled={!canEdit} />
                            </Field>
                            <Field label="Default RFQ validity (days)" hint="Pre-fills the expiry when raising a new RFQ.">
                                <Input
                                    name="rfq_default_validity_days"
                                    type="number"
                                    min="1"
                                    defaultValue={data.general.rfq_default_validity_days}
                                    disabled={!canEdit}
                                />
                            </Field>
                        </div>
                    </Card>
                )}

                {tab === 'email' && (
                    <Card>
                        <CardHeader title="Email delivery" />
                        <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-800">
                            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Email is sent through the platform&apos;s shared communication service, so there are no SMTP
                                credentials stored here. One-time passcodes are delivered by SMS, never email.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="From name">
                                <Input name="from_name" defaultValue={data.email.from_name} disabled={!canEdit} />
                            </Field>
                            <Field label="Reply-to address">
                                <Input name="reply_to" type="email" defaultValue={data.email.reply_to ?? ''} disabled={!canEdit} />
                            </Field>
                        </div>
                    </Card>
                )}

                {tab === 'roles' && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader title="Your access" />
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                <span className="text-muted">Signed in as</span>
                                <span className="font-medium text-ink">{user?.name}</span>
                                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[12px] font-medium text-brand-700">
                                    {user?.role}
                                </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {(user?.permissions ?? []).map((p) => (
                                    <span key={p} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Available roles" />
                            <p className="mb-3 text-[13px] text-muted">
                                Procurement users are created and assigned roles from the ServiZing admin panel.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(data.roles ?? []).map((r: string) => (
                                    <span key={r} className="rounded-lg border border-line px-3 py-1.5 text-[13px] text-slate-700">
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}

                {canEdit && tab !== 'roles' && (
                    <div className="mt-5 flex justify-end">
                        <button type="submit" className="btn-primary" disabled={busy}>
                            <Save className="h-4 w-4" />
                            Save changes
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
