'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Loader2, ShieldCheck } from 'lucide-react';
import { P, VENDOR_PROFILE_KEY, VENDOR_TOKEN_KEY, vendorPost } from '@/lib/vendor-api';

const OTP_LENGTH = 6;

export default function VendorLoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<'identifier' | 'otp'>('identifier');
    const [identifier, setIdentifier] = useState('');
    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const inputs = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (localStorage.getItem(VENDOR_TOKEN_KEY)) router.replace('/vendor/dashboard');
    }, [router]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    async function requestOtp(e?: React.FormEvent) {
        e?.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await vendorPost(P + 'otp/challenge', { identifier: identifier.trim() });
            setSentTo(res.dispatched_to);
            setStep('otp');
            setCooldown(30);
            setDigits(Array(OTP_LENGTH).fill(''));
            setTimeout(() => inputs.current[0]?.focus(), 50);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function verify(code: string) {
        setBusy(true);
        setError(null);
        try {
            const res = await vendorPost(P + 'otp/verify', { identifier: identifier.trim(), otp: code });
            localStorage.setItem(VENDOR_TOKEN_KEY, res.access_token);
            localStorage.setItem(VENDOR_PROFILE_KEY, JSON.stringify(res.vendor));
            router.replace('/vendor/dashboard');
        } catch (err: any) {
            setError(err.message);
            setDigits(Array(OTP_LENGTH).fill(''));
            inputs.current[0]?.focus();
        } finally {
            setBusy(false);
        }
    }

    function setDigit(index: number, value: string) {
        const clean = value.replace(/\D/g, '');
        const next = [...digits];
        if (!clean) {
            next[index] = '';
            setDigits(next);
            return;
        }
        clean.split('').forEach((ch, offset) => {
            if (index + offset < OTP_LENGTH) next[index + offset] = ch;
        });
        setDigits(next);
        const empty = next.findIndex((v) => !v);
        inputs.current[empty === -1 ? OTP_LENGTH - 1 : empty]?.focus();
        if (!next.includes('')) verify(next.join(''));
    }

    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            <div className="relative hidden flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
                <div className="flex items-center gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-2.5 shadow-lg ring-4 ring-brand-500/20">
                        <Image src="/servizing-logo.png" alt="ServiZing" width={60} height={68} priority className="h-full w-full object-contain" />
                    </div>
                    <div className="leading-tight">
                        <p className="text-2xl font-semibold">ProcurePro</p>
                        <p className="mt-0.5 text-xs tracking-wide text-slate-400">Vendor portal</p>
                    </div>
                </div>
                <div className="max-w-md">
                    <h1 className="text-3xl font-semibold leading-snug">
                        Quote, deliver and get paid - <span className="text-accent-400">all in one place.</span>
                    </h1>
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">
                        See every RFQ you are invited to, submit quotations, accept purchase orders, raise proforma invoices, record
                        dispatches and track payments and your ledger.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ShieldCheck className="h-4 w-4" />
                    One-time passcode to your registered mobile. No passwords.
                </div>
            </div>

            <div className="flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-sm">
                    {step === 'identifier' ? (
                        <form onSubmit={requestOtp}>
                            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                                <Building2 className="h-5 w-5" />
                            </span>
                            <h2 className="mt-4 text-2xl font-semibold text-ink">Vendor sign in</h2>
                            <p className="mt-2 text-sm text-muted">Use the email or mobile number the buyer registered for your company.</p>
                            <label className="field-label mt-7" htmlFor="identifier">
                                Email or mobile number
                            </label>
                            <input id="identifier" className="input" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="accounts@vendor.com" />
                            {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}
                            <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
                                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                Send passcode
                            </button>
                            <p className="mt-6 text-center text-[12px] text-muted">
                                Buyer staff? <Link href="/login" className="font-medium text-brand-600">Sign in here</Link>
                            </p>
                        </form>
                    ) : (
                        <div>
                            <button type="button" onClick={() => setStep('identifier')} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </button>
                            <h2 className="text-2xl font-semibold text-ink">Enter passcode</h2>
                            <p className="mt-2 text-sm text-muted">
                                {sentTo === 'demo' ? 'Demo account - use your configured test code.' : sentTo ? <>We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-ink">{sentTo}</span>.</> : 'If a vendor account exists, a code is on its way.'}
                            </p>
                            <div className="mt-7 flex gap-2">
                                {digits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            inputs.current[i] = el;
                                        }}
                                        className="h-12 w-full rounded-lg border border-line text-center text-lg font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={OTP_LENGTH}
                                        value={d}
                                        onChange={(e) => setDigit(i, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                                        }}
                                        aria-label={`Digit ${i + 1}`}
                                    />
                                ))}
                            </div>
                            {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}
                            <button type="button" className="btn-primary mt-6 w-full" disabled={busy || digits.includes('')} onClick={() => verify(digits.join(''))}>
                                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                Verify and continue
                            </button>
                            <p className="mt-5 text-center text-[13px] text-muted">
                                Did not get it?{' '}
                                {cooldown > 0 ? (
                                    <span className="text-slate-400">Resend in {cooldown}s</span>
                                ) : (
                                    <button type="button" onClick={() => requestOtp()} className="font-medium text-brand-600 hover:text-brand-700">
                                        Resend code
                                    </button>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
