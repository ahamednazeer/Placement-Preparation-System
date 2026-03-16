'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlacementsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/student/drives');
    }, [router]);

    return (
        <div className="min-h-[50vh] flex items-center justify-center text-slate-500 text-sm">
            Redirecting to Drives...
        </div>
    );
}
