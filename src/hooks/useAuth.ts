// ============================================================
//  مسار SaaS — useAuth hook
// ============================================================

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AuthService } from '@/services/AuthService';

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    // Load auth state on mount
    store.loadAuthState();

    // Listen for Supabase auth state changes
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      subscription = AuthService.onAuthStateChange(async (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await store.loadAuthState();
        } else if (event === 'SIGNED_OUT') {
          store.setUser(null);
          store.setProfile(null);
          store.setCenter(null);
          store.setSubscription(null);
        }
      });
    } catch { /* Supabase not configured */ }

    return () => subscription?.unsubscribe();
  }, []);

  return {
    user:             store.user,
    profile:          store.profile,
    center:           store.center,
    subscription:     store.subscription,
    isLoading:        store.isLoading,
    isAuthenticated:  store.isAuthenticated,
    authError:        store.authError,
    hasPermission:    store.hasPermission,
    canUseFeature:    store.canUseFeature,
    isAtStudentLimit: store.isAtStudentLimit,
    getRoleLabel:     store.getRoleLabel,
    signOut:          store.signOut,
  };
}
