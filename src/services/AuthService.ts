// ============================================================
//  مسار SaaS — AuthService (Supabase Auth wrapper)
// ============================================================

import type { UserProfile, Center, Subscription, UserRole } from '@/types/saas';

// ── Supabase client (lazy init) ──────────────────────────────
let _supabase: ReturnType<typeof createSupabaseClient> | null = null;

type SupabaseConfig = { url: string; key: string };

function createSupabaseClient(config: SupabaseConfig) {
  // Dynamic import to avoid hard dependency when Supabase not configured
  const { createClient } = (window as unknown as { supabase: { createClient: typeof import('@supabase/supabase-js').createClient } }).supabase ?? {};
  if (createClient) return createClient(config.url, config.key);
  throw new Error('Supabase not loaded');
}

function getSupabase() {
  if (_supabase) return _supabase;
  const cfg = AuthService.getConfig();
  if (!cfg) throw new Error('Supabase not configured');
  _supabase = createSupabaseClient(cfg);
  return _supabase;
}

// ── Auth Service ─────────────────────────────────────────────
export const AuthService = {

  // ── Config management ────────────────────────────────────
  getConfig(): SupabaseConfig | null {
    const url = localStorage.getItem('massar_supabase_url');
    const key = localStorage.getItem('massar_supabase_key');
    if (url && key) return { url, key };
    return null;
  },

  setConfig(url: string, key: string): void {
    localStorage.setItem('massar_supabase_url', url.trim());
    localStorage.setItem('massar_supabase_key', key.trim());
    _supabase = null; // force reinit
  },

  isConfigured(): boolean {
    return !!this.getConfig();
  },

  // ── Session ──────────────────────────────────────────────
  async getSession() {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as { auth: { getSession: () => Promise<{ data: { session: unknown }; error: unknown }> } }).auth.getSession();
    if (error) throw error;
    return (data as { session: { user: { id: string; email: string } } | null }).session;
  },

  async getCurrentUser() {
    const session = await this.getSession();
    return session?.user ?? null;
  },

  // ── Sign Up ──────────────────────────────────────────────
  async signUp(email: string, password: string, fullName: string): Promise<{ userId: string }> {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as {
      auth: { signUp: (opts: object) => Promise<{ data: { user: { id: string } | null }; error: unknown }> }
    }).auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign up failed');
    return { userId: data.user.id };
  },

  // ── Sign In ──────────────────────────────────────────────
  async signIn(email: string, password: string): Promise<{ userId: string; email: string }> {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as {
      auth: { signInWithPassword: (opts: object) => Promise<{ data: { user: { id: string; email: string } | null }; error: unknown }> }
    }).auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed');
    return { userId: data.user.id, email: data.user.email };
  },

  // ── Sign Out ─────────────────────────────────────────────
  async signOut(): Promise<void> {
    const sb = getSupabase();
    const { error } = await (sb as unknown as {
      auth: { signOut: () => Promise<{ error: unknown }> }
    }).auth.signOut();
    if (error) throw error;
    _supabase = null;
  },

  // ── Profile ──────────────────────────────────────────────
  async getProfile(userId: string): Promise<UserProfile | null> {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
          }
        }
      }
    }).from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    if (!data) return null;
    return mapProfile(data);
  },

  async createProfile(userId: string, fullName: string, role: UserRole = 'therapist'): Promise<UserProfile> {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as {
      from: (table: string) => {
        upsert: (row: object) => {
          select: () => {
            single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
          }
        }
      }
    }).from('user_profiles')
      .upsert({ id: userId, full_name: fullName, role })
      .select()
      .single();
    if (error) throw error;
    return mapProfile(data!);
  },

  async updateProfile(userId: string, updates: Partial<Pick<UserProfile, 'fullName' | 'phone' | 'specialization' | 'preferences'>>): Promise<void> {
    const sb = getSupabase();
    const mapped: Record<string, unknown> = {};
    if (updates.fullName)       mapped.full_name       = updates.fullName;
    if (updates.phone)          mapped.phone           = updates.phone;
    if (updates.specialization) mapped.specialization  = updates.specialization;
    if (updates.preferences)    mapped.preferences     = updates.preferences;
    mapped.updated_at = new Date().toISOString();

    const { error } = await (sb as unknown as {
      from: (table: string) => {
        update: (row: object) => { eq: (col: string, val: string) => Promise<{ error: unknown }> }
      }
    }).from('user_profiles').update(mapped).eq('id', userId);
    if (error) throw error;
  },

  // ── Center & Subscription ────────────────────────────────
  async getCenter(centerId: string): Promise<Center | null> {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
          }
        }
      }
    }).from('centers').select('*').eq('id', centerId).single();
    if (error || !data) return null;
    return mapCenter(data);
  },

  async createCenter(name: string, slug: string): Promise<Center> {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as {
      from: (table: string) => {
        insert: (row: object) => {
          select: () => { single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> }
        }
      }
    }).from('centers').insert({ name, slug }).select().single();
    if (error) throw error;
    return mapCenter(data!);
  },

  async getSubscription(centerId: string): Promise<Subscription | null> {
    const sb = getSupabase();
    const { data, error } = await (sb as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
          }
        }
      }
    }).from('subscriptions').select('*').eq('center_id', centerId).single();
    if (error || !data) return null;
    return mapSubscription(data);
  },

  // ── Auth state change listener ───────────────────────────
  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    try {
      const sb = getSupabase();
      return (sb as unknown as {
        auth: {
          onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
            data: { subscription: { unsubscribe: () => void } }
          }
        }
      }).auth.onAuthStateChange(callback).data.subscription;
    } catch {
      return { unsubscribe: () => {} };
    }
  },
};

// ── Mappers ──────────────────────────────────────────────────
function mapProfile(d: Record<string, unknown>): UserProfile {
  return {
    id:              d.id as string,
    centerId:        d.center_id as string | null,
    role:            (d.role as UserRole) ?? 'therapist',
    fullName:        (d.full_name as string) ?? '',
    avatarUrl:       d.avatar_url as string | undefined,
    phone:           d.phone as string | undefined,
    specialization:  d.specialization as string | undefined,
    isActive:        (d.is_active as boolean) ?? true,
    preferences:     (d.preferences as Record<string, unknown>) ?? {},
    lastSeenAt:      d.last_seen_at as string | undefined,
    createdAt:       d.created_at as string,
  };
}

function mapCenter(d: Record<string, unknown>): Center {
  return {
    id:       d.id as string,
    name:     d.name as string,
    nameEn:   d.name_en as string | undefined,
    slug:     d.slug as string,
    logoUrl:  d.logo_url as string | undefined,
    country:  (d.country as string) ?? 'SA',
    city:     d.city as string | undefined,
    phone:    d.phone as string | undefined,
    email:    d.email as string | undefined,
    website:  d.website as string | undefined,
    settings: (d.settings as Record<string, unknown>) ?? {},
    createdAt: d.created_at as string,
  };
}

function mapSubscription(d: Record<string, unknown>): Subscription {
  return {
    id:              d.id as string,
    centerId:        d.center_id as string,
    plan:            d.plan as 'free' | 'pro' | 'enterprise',
    status:          d.status as Subscription['status'],
    trialEndsAt:     d.trial_ends_at as string,
    studentLimit:    d.student_limit as number,
    therapistLimit:  d.therapist_limit as number,
    features: {
      analytics:       (d.features as Record<string, boolean>)?.analytics ?? false,
      exportWord:      (d.features as Record<string, boolean>)?.export_word ?? false,
      exportExcel:     (d.features as Record<string, boolean>)?.export_excel ?? false,
      aiAnalysis:      (d.features as Record<string, boolean>)?.ai_analysis ?? false,
      apiAccess:       (d.features as Record<string, boolean>)?.api_access ?? false,
      prioritySupport: (d.features as Record<string, boolean>)?.priority_support ?? false,
    },
  };
}
