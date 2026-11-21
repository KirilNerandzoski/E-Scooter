import { useState } from 'react';
import { X, AlertCircle, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { UserAccount } from '../types/rydio';
import { Modal } from './Modal';
import { signInWithSupabase, signUpWithSupabase } from '../services/rydioApi';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  useSupabaseAuth: boolean;
  users: UserAccount[];
  onSupabaseAuthSuccess: () => Promise<void>;
  onLocalLoginSuccess: (user: UserAccount) => void;
  onLocalRegisterSuccess: (newUser: UserAccount) => void;
  onClose: () => void;
}

export function AuthModal({
  initialMode = 'login',
  useSupabaseAuth,
  users,
  onSupabaseAuthSuccess,
  onLocalLoginSuccess,
  onLocalRegisterSuccess,
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (!normalizedEmail.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    if (useSupabaseAuth) {
      setSubmitting(true);
      try {
        if (mode === 'login') {
          await signInWithSupabase(normalizedEmail, password);
          await onSupabaseAuthSuccess();
        } else {
          const res = await signUpWithSupabase(name.trim(), normalizedEmail, password);
          if (res.needsEmailConfirm) {
            setInfoMessage(
              'Account created! Check your email to confirm your address, then sign in.'
            );
            setMode('login');
          } else {
            await onSupabaseAuthSuccess();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Local fallback mode (when Supabase tables are not yet deployed)
    if (mode === 'login') {
      const account = users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (!account || account.password !== password) {
        setError('Invalid email or password. Check your credentials or create a new account.');
        return;
      }
      if (!account.active) {
        setError('This account has been suspended by an administrator.');
        return;
      }
      onLocalLoginSuccess(account);
      return;
    }

    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      setError('An account with this email already exists. Sign in instead.');
      return;
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role:
        normalizedEmail === 'superadmin@rydio.mk' || normalizedEmail === 'kiril.nerandz99@gmail.com'
          ? 'SuperAdmin'
          : 'Customer',
      active: true,
      createdAt: new Date().toISOString(),
    };
    onLocalRegisterSuccess(newUser);
  };

  const fillSuperAdmin = () => {
    setMode('login');
    setEmail('superadmin@rydio.mk');
    setPassword('SuperAdmin123!');
    setError(null);
  };

  return (
    <Modal labelledBy="auth-modal-title" maxWidthClass="max-w-md" onClose={onClose}>
      <div className="flex items-start justify-between rounded-t-lg border-b border-[#DDE2E8] bg-white px-6 py-5">
        <div>
          <h2 id="auth-modal-title" className="font-display text-2xl font-normal text-[#0A1A33]">
            {mode === 'login' ? 'Sign in to Rydio' : 'Create your Rydio account'}
          </h2>
          <p className="mt-1 text-xs text-[#515F73]">
            {mode === 'login'
              ? 'Access your reservations, pickup controls, and ride history.'
              : 'Register once to reserve scooters and e-bikes across Skopje.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Authentication mode"
        className="grid grid-cols-2 border-b border-[#DDE2E8] bg-white px-6"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`border-b-2 py-3 text-xs font-medium tracking-[0.14em] transition-colors ${
            mode === 'login'
              ? 'border-[#0A1A33] text-[#0A1A33]'
              : 'border-transparent text-[#515F73] hover:text-[#0A1A33]'
          }`}
        >
          SIGN IN
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          onClick={() => {
            setMode('register');
            setError(null);
          }}
          className={`border-b-2 py-3 text-xs font-medium tracking-[0.14em] transition-colors ${
            mode === 'register'
              ? 'border-[#0A1A33] text-[#0A1A33]'
              : 'border-transparent text-[#515F73] hover:text-[#0A1A33]'
          }`}
        >
          CREATE ACCOUNT
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[#9B2C2C]/30 bg-[#FFF5F5] px-3.5 py-2.5 text-xs text-[#822020]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-[#0A1A33]/25 bg-white px-3.5 py-2.5 text-xs text-[#0A1A33]"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {mode === 'register' && (
          <div>
            <label
              htmlFor="auth-name"
              className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
            >
              FULL NAME
            </label>
            <input
              id="auth-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ana Stojanovska"
              className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33]"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="auth-email"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
          >
            EMAIL ADDRESS
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.mk"
            className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33]"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
          >
            PASSWORD
          </label>
          <input
            id="auth-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33]"
          />
        </div>

        {mode === 'register' && (
          <div>
            <label
              htmlFor="auth-confirm"
              className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
            >
              CONFIRM PASSWORD
            </label>
            <input
              id="auth-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33]"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-white transition-colors hover:bg-[#1E2D4A] disabled:opacity-50"
        >
          {submitting
            ? 'PLEASE WAIT...'
            : mode === 'login'
              ? 'SIGN IN'
              : 'CREATE ACCOUNT'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <details className="border-t border-[#DDE2E8] pt-3 text-[11px] text-[#515F73]">
          <summary className="cursor-pointer font-medium tracking-[0.08em] text-[#515F73] hover:text-[#0A1A33]">
            SuperAdmin setup info
          </summary>
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-[#DDE2E8] bg-white px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#0A1A33]" />
              <span>
                Register with <strong className="text-[#0A1A33]">superadmin@rydio.mk</strong> or{' '}
                <strong className="text-[#0A1A33]">kiril.nerandz99@gmail.com</strong> for automatic
                SuperAdmin access.
              </span>
            </div>
            {!useSupabaseAuth && (
              <button
                type="button"
                onClick={fillSuperAdmin}
                className="shrink-0 rounded border border-[#0A1A33]/30 px-2.5 py-1 text-[11px] font-medium tracking-[0.1em] text-[#0A1A33] hover:bg-[#0A1A33] hover:text-white"
              >
                FILL
              </button>
            )}
          </div>
        </details>
      </form>
    </Modal>
  );
}
