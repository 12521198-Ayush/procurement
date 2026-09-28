'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const OTP_LENGTH = 6;

export default function LoginPage() {
    const router = useRouter();
    const { user, ready, signIn } = useAuth();

    const [step, setStep] = useState<'identifier' | 'otp'>('identifier');
    const [identifier, setIdentifier] = useState('');
    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (ready && user) router.replace('/dashboard');
    }, [ready, user, router]);

    useEffect(() => {
        if (secondsLeft <= 0) return;
        const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [secondsLeft]);

    async function requestOtp(e?: React.FormEvent) {
        e?.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const res = await post('/procurement/auth/otp/challenge', { identifier: identifier.trim() });
            setSentTo(res?.dispatched_to ?? null);
            setStep('otp');
            setSecondsLeft(30);
            setDigits(Array(OTP_LENGTH).fill(''));
            setTimeout(() => inputsRef.current[0]?.focus(), 50);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function verifyOtp(code: string) {
        setError(null);
        setBusy(true);
        try {
            const session = await post('/procurement/auth/otp/verify', {
                identifier: identifier.trim(),
                otp: code
            });
            signIn(session);
            router.replace('/dashboard');
        } catch (err: any) {
            setError(err.message);
            setDigits(Array(OTP_LENGTH).fill(''));
            inputsRef.current[0]?.focus();
        } finally {
            setBusy(false);
        }
    }

    function setDigit(index: number, value: string) {
        const clean = value.replace(/\D/g, '');
        if (!clean) {
            setDigits((d) => d.map((v, i) => (i === index ? '' : v)));
            return;
        }

        const next = [...digits];
        // Handles paste of a full code into any box.
        clean.split('').forEach((ch, offset) => {
            if (index + offset < OTP_LENGTH) next[index + offset] = ch;
        });
        setDigits(next);

        const nextEmpty = next.findIndex((v) => !v);
        const focusAt = nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty;
        inputsRef.current[focusAt]?.focus();

        const joined = next.join('');
        if (joined.length === OTP_LENGTH && !next.includes('')) verifyOtp(joined);
    }

    function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    }

    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            {/* Brand panel */}
            <div className="relative hidden flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
                <div className="flex items-center gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-2.5 shadow-lg ring-4 ring-brand-500/20">
                        <Image src="/servizing-logo.png" alt="ServiZing" width={60} height={68} priority className="h-full w-full object-contain" />
                    </div>
                    <div className="leading-tight">
                        <p className="text-2xl font-semibold">ProcurePro</p>
                        <p className="mt-0.5 text-xs tracking-wide text-slate-400">Buy Smarter · <span className="text-accent-400">Manage Better</span></p>
                    </div>
                </div>

                <div className="max-w-md">
                    <h1 className="text-3xl font-semibold leading-snug">
                        Every bid, quotation and purchase order <span className="text-accent-400">in one place.</span>
                    </h1>
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">
                        Raise an RFQ, invite vendors by secure link, compare quotations side by side and
                        track spend against budget — without a single spreadsheet.
                    </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ShieldCheck className="h-4 w-4" />
                    Secured with one-time passcodes. No passwords to steal.
                </div>
            </div>

            {/* Form panel */}
            <div className="flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-sm">
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
                        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-2 ring-1 ring-line">
                            <Image src="/servizing-logo.png" alt="ServiZing" width={44} height={50} priority className="h-full w-full object-contain" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-lg font-semibold text-ink">ProcurePro</p>
                            <p className="text-[11px] text-muted">Buy Smarter · Manage Better</p>
                        </div>
                    </div>

                    {step === 'identifier' ? (
                        <form onSubmit={requestOtp}>
                            <h2 className="text-2xl font-semibold text-ink">Sign in</h2>
                            <p className="mt-2 text-sm text-muted">
                                Enter your registered email or mobile number. We will text you a one-time
                                passcode.
                            </p>

                            <div className="mt-7">
                                <label className="field-label" htmlFor="identifier">
                                    Email or mobile number
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="identifier"
                                        className="input pl-9"
                                        autoComplete="username"
                                        placeholder="you@company.com"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}

                            <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
                                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                Send passcode
                            </button>
                        </form>
                    ) : (
                        <div>
                            <button
                                type="button"
                                onClick={() => {
                                    setStep('identifier');
                                    setError(null);
                                }}
                                className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>

                            <h2 className="text-2xl font-semibold text-ink">Enter passcode</h2>
                            <p className="mt-2 text-sm text-muted">
                                {sentTo === 'demo'
                                    ? 'Demo account — use your configured test code.'
                                    : sentTo
                                      ? <>We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-ink">{sentTo}</span>.</>
                                      : 'If the account exists, a code is on its way.'}
                            </p>

                            <div className="mt-7 flex gap-2">
                                {digits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            inputsRef.current[i] = el;
                                        }}
                                        className="h-12 w-full rounded-lg border border-line text-center text-lg font-semibold text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={OTP_LENGTH}
                                        value={digit}
                                        onChange={(e) => setDigit(i, e.target.value)}
                                        onKeyDown={(e) => onKeyDown(i, e)}
                                        aria-label={`Digit ${i + 1}`}
                                    />
                                ))}
                            </div>

                            {error && <p className="mt-3 text-[13px] text-rose-600">{error}</p>}

                            <button
                                type="button"
                                className="btn-primary mt-6 w-full"
                                disabled={busy || digits.includes('')}
                                onClick={() => verifyOtp(digits.join(''))}
                            >
                                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                Verify and continue
                            </button>

                            <p className="mt-5 text-center text-[13px] text-muted">
                                Did not get it?{' '}
                                {secondsLeft > 0 ? (
                                    <span className="text-slate-400">Resend in {secondsLeft}s</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => requestOtp()}
                                        className="font-medium text-brand-600 hover:text-brand-700"
                                    >
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
