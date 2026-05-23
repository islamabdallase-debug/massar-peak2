// ============================================================
//  مسار SaaS — Auth Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AuthService } from '@/services/AuthService';
import type { UserProfile, Center, Subscription, UserRole } from '@/types/saas';
import { ROLE_PERMISSIONS } from '@/types/saas';

type PermKey = keyof (typeof ROLE_PERMISSIONS)['therapist'];

interface AuthUser {
  id: string;
  email: string;
}

export interface AuthStore {
  // ── State
  user:           AuthUser | null;
  profile:        UserProfile | null;
  center:         Center | null;
  subscription:   Subscription | null;
  isLoading:      boolean;
  isAuthenticated: boolean;
  authError:      string | null;

  // ── Actions
  setUser:         (user: AuthUser | null) => void;
  setProfile:      (profile: UserProfile | null) => void;
  setCenter:       (center: Center | null) => void;
  setSubscription: (sub: Subscription | null) => void;
  setLoading:      (loading: boolean) => void;
  setAuthError:    (error: string | null) => void;

  // ── Computed helpers
  hasPermission:   (perm: PermKey) => boolean;
  canUseFeature:   (feature: keyof Subscription['features']) => boolean;
  isAtStudentLimit: () => boolean;
  getRoleLabel:    () => string;

  // ── Auth actions
  loadAuthState:   () => Promise<void>;
  signOut:         () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state
        user:             null,
        profile:          null,
        center:           null,
        subscription:     null,
        isLoading:        true,
        isAuthenticated:  false,
        authError:        null,

        // ── Setters
        setUser:         (user) => set({ user, isAuthenticated: !!user }),
        setProfile:      (profile) => set({ profile }),
        setCenter:       (center) => set({ center }),
        setSubscription: (subscription) => set({ subscription }),
        setLoading:      (isLoading) => set({ isLoading }),
        setAuthError:    (authError) => set({ authError }),

        // ── Permission helpers
        hasPermission: (perm) => {
          const { profile } = get();
          if (!profile) return false;
          return ROLE_PERMISSIONS[profile.role]?.[perm] ?? false;
        },

        canUseFeature: (feature) => {
          const { subscription } = get();
          if (!subscription) return false;
          // Map camelCase to features key
          const map: Record<string, keyof Subscription['features']> = {
            analytics:       'analytics',
            exportWord:      'exportWord',
            exportExcel:     'exportExcel',
            aiAnalysis:      'aiAnalysis',
            apiAccess:       'apiAccess',
            prioritySupport: 'prioritySupport',
          };
          return subscription.features[map[feature] ?? feature] ?? false;
        },

        isAtStudentLimit: () => {
          const { subscription } = get();
          if (!subscription || subscription.studentLimit === -1) return false;
          // This is a quick in-memory check; server enforces the real limit
          return false; // updated dynamically via CenterStats
        },

        getRoleLabel: () => {
          const { profile } = get();
          if (!profile) return '';
          return ROLE_PERMISSIONS[profile.role]?.label ?? profile.role;
        },

        // ── Load auth state on app start
        loadAuthState: async () => {
          set({ isLoading: true, authError: null });
          try {
            if (!AuthService.isConfigured()) {
              set({ isLoading: false, isAuthenticated: false });
              return;
            }
            const user = await AuthService.getCurrentUser();
            if (!user) {
              set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
              return;
            }
            set({ user: { id: user.id, email: user.email ?? '' }, isAuthenticated: true });

            // Load profile
            const profile = await AuthService.getProfile(user.id);
            set({ profile });

            // Load center + subscription
            if (profile?.centerId) {
              const [center, subscription] = await Promise.all([
                AuthService.getCenter(profile.centerId),
                AuthService.getSubscription(profile.centerId),
              ]);
              set({ center, subscription });
            }
          } catch (e) {
            set({ authError: (e as Error).message });
          } finally {
            set({ isLoading: false });
          }
        },

        signOut: async () => {
          try {
            await AuthService.signOut();
          } catch { /* ignore */ }
          set({
            user: null, profile: null, center: null,
            subscription: null, isAuthenticated: false, authError: null,
          });
        },
      }),
      {
        name: 'massar-auth-store',
        partialize: (state) => ({
          // Only persist non-sensitive auth data
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'MassarAuthStore' }
  )
);
