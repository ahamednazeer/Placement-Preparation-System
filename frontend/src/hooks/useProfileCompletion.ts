'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, ProfileStatusResponse } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook to check if profile is complete and redirect if needed.
 * Use this in student pages that require a complete profile.
 */
export function useProfileCompletion(requireComplete: boolean = false) {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useAuth();
    const [status, setStatus] = useState<ProfileStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const checkProfile = async () => {
            if (!user || user.role !== 'STUDENT') {
                setLoading(false);
                setChecked(true);
                return;
            }

            try {
                const profileStatus = await api.getProfileStatus();
                setStatus(profileStatus);

                // Redirect to profile setup if profile is incomplete and we require it
                if (requireComplete && !profileStatus.is_complete) {
                    // Don't redirect if already on profile page
                    if (!pathname?.includes('/profile')) {
                        router.push('/dashboard/student/profile?setup=true');
                    }
                }
            } catch (error) {
                console.error('Failed to check profile status:', error);
            } finally {
                setLoading(false);
                setChecked(true);
            }
        };

        checkProfile();
    }, [user, requireComplete, router, pathname]);

    return { status, loading: loading || !checked, isComplete: status?.is_complete ?? false };
}
