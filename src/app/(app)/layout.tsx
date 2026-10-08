'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { trackPageView } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, ready } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        if (ready && !user) router.replace('/login');
    }, [ready, user, router]);

    const signedInAs = user?.user_id;
    useEffect(() => {
        if (signedInAs) trackPageView(pathname);
    }, [pathname, signedInAs]);

    if (!ready || !user) {
        return (
            <div className="grid min-h-screen place-items-center bg-canvas">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen">
            <div className="hidden lg:block">
                <div className="fixed inset-y-0 left-0">
                    <Sidebar />
                </div>
            </div>

            {drawerOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div
                        className="absolute inset-0 bg-slate-900/50"
                        onClick={() => setDrawerOpen(false)}
                        aria-hidden
                    />
                    <div className="absolute inset-y-0 left-0">
                        <Sidebar onNavigate={() => setDrawerOpen(false)} />
                    </div>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
                <Topbar onOpenSidebar={() => setDrawerOpen(true)} />
                <main className="flex-1 p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
