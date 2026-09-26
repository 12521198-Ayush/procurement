'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { post, REFRESH_KEY, TOKEN_KEY, USER_KEY } from './api';

export type ProcurementUser = {
    user_id: string;
    premise_id: string;
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
    can: (permission: string) => boolean;
    signIn: (session: { access_token: string; refresh_token: string; user: ProcurementUser }) => void;
    signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<ProcurementUser | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const raw = localStorage.getItem(USER_KEY);
        if (raw) {
            try {
                setUser(JSON.parse(raw));
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
        setUser(session.user);
    }, []);

    const signOut = useCallback(() => {
        const refresh = localStorage.getItem(REFRESH_KEY);
        // Fire and forget: the local session is gone either way.
        if (refresh) post('/procurement/auth/logout', { refresh_token: refresh }).catch(() => undefined);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        router.replace('/login');
    }, [router]);

    const can = useCallback(
        (permission: string) => !!user?.permissions?.includes(permission),
        [user]
    );

    const value = useMemo(
        () => ({ user, ready, can, signIn, signOut }),
        [user, ready, can, signIn, signOut]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
