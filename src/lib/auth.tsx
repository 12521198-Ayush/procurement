'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { post, getActivePremise, setActivePremise, PREMISE_KEY, REFRESH_KEY, TOKEN_KEY, USER_KEY } from './api';

export type AssignedPremise = { premise_id: string; premise_name: string };

export type ProcurementUser = {
    user_id: string;
    premise_id: string;
    premise_ids?: string[];
    premises?: AssignedPremise[];
    name: string;
    email: string;
    mobile: string;
    role: string;
    permissions: string[];
    department_id: string | null;
};

type AuthState = {
    user: ProcurementUser | null;
    ready: boolean;
    /** Every society this user may work in. */
    premises: AssignedPremise[];
    activePremiseId: string | null;
    activePremiseName: string;
    isMultiPremise: boolean;
    switchPremise: (premiseId: string) => void;
    can: (permission: string) => boolean;
    signIn: (session: { access_token: string; refresh_token: string; user: ProcurementUser }) => void;
    signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function premisesOf(user: ProcurementUser | null): AssignedPremise[] {
    if (!user) return [];
    if (user.premises?.length) return user.premises.filter((p) => p?.premise_id);
    const ids = user.premise_ids?.length ? user.premise_ids : [user.premise_id];
    return ids.filter(Boolean).map((id) => ({ premise_id: id, premise_name: id }));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<ProcurementUser | null>(null);
    const [activePremiseId, setActiveId] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const raw = localStorage.getItem(USER_KEY);
        if (raw) {
            try {
                const parsed: ProcurementUser = JSON.parse(raw);
                setUser(parsed);

                // A society can be withdrawn between sessions, so the remembered
                // choice is only honoured while it is still assigned.
                const allowed = premisesOf(parsed).map((p) => p.premise_id);
                const remembered = getActivePremise();
                const next = remembered && allowed.includes(remembered) ? remembered : parsed.premise_id;
                setActivePremise(next);
                setActiveId(next);
            } catch {
                localStorage.removeItem(USER_KEY);
            }
        }
        setReady(true);
    }, []);

    const signIn: AuthState['signIn'] = useCallback((session) => {
        localStorage.setItem(TOKEN_KEY, session.access_token);
        localStorage.setItem(REFRESH_KEY, session.refresh_token);
        localStorage.setItem(USER_KEY, JSON.stringify(session.user));
        setActivePremise(session.user.premise_id);
        setActiveId(session.user.premise_id);
        setUser(session.user);
    }, []);

    const signOut = useCallback(() => {
        const refresh = localStorage.getItem(REFRESH_KEY);
        // Fire and forget: the local session is gone either way.
        if (refresh) post('/procurement/auth/logout', { refresh_token: refresh }).catch(() => undefined);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(PREMISE_KEY);
        setActivePremise(null);
        setActiveId(null);
        setUser(null);
        router.replace('/login');
    }, [router]);

    const premises = useMemo(() => premisesOf(user), [user]);

    const switchPremise = useCallback(
        (premiseId: string) => {
            if (premiseId === activePremiseId) return;
            if (!premises.some((p) => p.premise_id === premiseId)) return;
            setActivePremise(premiseId);
            setActiveId(premiseId);
        },
        [premises, activePremiseId]
    );

    const can = useCallback(
        (permission: string) => !!user?.permissions?.includes(permission),
        [user]
    );

    const activePremiseName =
        premises.find((p) => p.premise_id === activePremiseId)?.premise_name || '';

    const value = useMemo(
        () => ({
            user,
            ready,
            premises,
            activePremiseId,
            activePremiseName,
            isMultiPremise: premises.length > 1,
            switchPremise,
            can,
            signIn,
            signOut
        }),
        [user, ready, premises, activePremiseId, activePremiseName, switchPremise, can, signIn, signOut]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
