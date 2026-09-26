'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
    const router = useRouter();
    const { user, ready } = useAuth();

    useEffect(() => {
        if (!ready) return;
        router.replace(user ? '/dashboard' : '/login');
    }, [ready, user, router]);

    return null;
}
