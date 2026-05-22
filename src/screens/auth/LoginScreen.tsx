// ============================================================
//  مسار SaaS — Login Screen
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
  onSuccess: () => void;
}

export function LoginScreen({ onSwitchToRegister, onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const { loadAuthState } = useAuthStore();

  useEffect(() => { emailRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return; }
    setLoading(true); setError('');
    try {
      await AuthService.signIn(email, password);
      await loadAuthState();
      onSuccess();
    } catch (err) {
      setError(mapAuthError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--gold, #f9a825)', marginBottom: '4px' }}>مسار</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>منصة تقييم RFT المتكاملة</div>
        </div>

        <h2 style={titleStyle}>تسجيل الدخول</h2>

        <form onSubmit={handleSubmit} noValidate>
          <Field label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} inputRef={emailRef} autoComplete="email" />
          <Field label="كلمة المرور" type="password" value={password} onChange={setPassword} autoComplete="current-password" />

          {error && <ErrorMsg>{error}</ErrorMsg>}

          <Button variant="primary" type="submit" loading={loading} fullWidth style={{ marginTop: '8px', fontSize: '1rem', padding: '13px' }}>
            دخول
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
          ليس لديك حساب؟{' '}
          <button onClick={onSwitchToRegister} style={linkBtnStyle}>إنشاء حساب جديد</button>
        </div>
      </div>
    </div>
  );
}

// ─── Register Screen ─────────────────────────────────────────
interface RegisterScreenProps {
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}

export function RegisterScreen({ onSwitchToLogin, onSuccess }: RegisterScreenProps) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '', centerName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loadAuthState } = useAuthStore();

  const set = (key: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim())  { setError('يرجى إدخال الاسم الكامل'); return; }
    if (!form.email.trim())     { setError('يرجى إدخال البريد الإلكتروني'); return; }
    if (form.password.length < 8) { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (form.password !== form.confirm) { setError('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true); setError('');
    try {
      const { userId } = await AuthService.signUp(form.email, form.password, form.fullName);
      await AuthService.createProfile(userId, form.fullName, 'center_admin');
      if (form.centerName.trim()) {
        const slug = form.centerName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        const center = await AuthService.createCenter(form.centerName.trim(), slug);
        // Link profile to center
        await AuthService.updateProfile(userId, {});
        const profile = await AuthService.getProfile(userId);
        if (profile && center) {
          // profile already linked via trigger in DB; we just reload
        }
      }
      await loadAuthState();
      onSuccess();
    } catch (err) {
      setError(mapAuthError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--gold, #f9a825)' }}>مسار</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>إنشاء حساب جديد</div>
        </div>

        <h2 style={titleStyle}>إنشاء حساب</h2>

        <form onSubmit={handleSubmit} noValidate>
          <Field label="الاسم الكامل" type="text" value={form.fullName} onChange={set('fullName')} autoComplete="name" />
          <Field label="البريد الإلكتروني" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          <Field label="كلمة المرور (8 أحرف على الأقل)" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          <Field label="تأكيد كلمة المرور" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          <Field label="اسم المركز / المدرسة (اختياري)" type="text" value={form.centerName} onChange={set('centerName')} />

          {error && <ErrorMsg>{error}</ErrorMsg>}

          <Button variant="primary" type="submit" loading={loading} fullWidth style={{ marginTop: '8px', fontSize: '1rem', padding: '13px' }}>
            إنشاء الحساب
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
          لديك حساب؟{' '}
          <button onClick={onSwitchToLogin} style={linkBtnStyle}>تسجيل الدخول</button>
        </div>
      </div>
    </div>
  );
}

// ─── Auth Gate (wrapper) ─────────────────────────────────────
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return mode === 'login'
      ? <LoginScreen onSwitchToRegister={() => setMode('register')} onSuccess={() => {}} />
      : <RegisterScreen onSwitchToLogin={() => setMode('login')} onSuccess={() => {}} />;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div style={{ ...containerStyle, flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>⟳</div>
      <div style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'Cairo, sans-serif' }}>جاري التحميل...</div>
    </div>
  );
}

// ─── Reusable Field ──────────────────────────────────────────
function Field({ label, type, value, onChange, inputRef, autoComplete }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  autoComplete?: string;
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '6px', fontWeight: 600 }}>
        {label}
      </label>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        style={{
          width: '100%', padding: '11px 14px', borderRadius: '9px',
          border: '1px solid var(--border, #334155)', background: 'var(--bg, #0a0f1a)',
          color: 'var(--text, #f1f5f9)', fontFamily: 'Cairo, sans-serif', fontSize: '0.92rem',
          direction: 'rtl', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: '8px', padding: '10px 14px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
      ⚠️ {children}
    </div>
  );
}

// ─── Error mapper ────────────────────────────────────────────
function mapAuthError(msg: string): string {
  if (msg.includes('Invalid login'))    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (msg.includes('User already'))     return 'هذا البريد الإلكتروني مسجّل بالفعل';
  if (msg.includes('Password'))         return 'كلمة المرور ضعيفة جداً';
  if (msg.includes('not configured'))   return 'لم يتم إعداد خدمة Supabase بعد. راجع إعدادات السحابة.';
  return msg;
}

// ─── Styles ──────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg, #0a0f1a)', padding: '20px',
};
const cardStyle: React.CSSProperties = {
  background: 'var(--surface, #1e293b)', borderRadius: '20px', padding: '36px 40px',
  width: '100%', maxWidth: '420px', fontFamily: 'Cairo, sans-serif', direction: 'rtl',
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
};
const titleStyle: React.CSSProperties = {
  margin: '0 0 24px', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text, #f1f5f9)',
};
const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--blue, #3b82f6)', cursor: 'pointer',
  fontFamily: 'Cairo, sans-serif', fontSize: '0.85rem', textDecoration: 'underline',
};
