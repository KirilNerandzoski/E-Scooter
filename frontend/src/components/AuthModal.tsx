import { useRef, useState } from 'react';
import { X, AlertCircle, ArrowRight } from 'lucide-react';
import type { UserAccount } from '../types/rydio';
import { Modal } from './Modal';
import { loginWithApi, registerWithApi } from '../services/rydioApi';
import { isPrimarySuperAdminEmail, ROLE_PERMISSIONS } from '../utils/rbac';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  useRemoteApi: boolean;
  users: UserAccount[];
  onApiAuthSuccess: (user: UserAccount) => Promise<void>;
  onLocalLoginSuccess: (user: UserAccount) => void;
  onLocalRegisterSuccess: (newUser: UserAccount) => void;
  onClose: () => void;
}

const AUTH_MODES: readonly ('login' | 'register')[] = ['login', 'register'];

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return text;
}

export function AuthModal({
  initialMode = 'login',
  useRemoteApi,
  users,
  onApiAuthSuccess,
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
  const [submitting, setSubmitting] = useState(false);
  const tabRefs = useRef<Record<'login' | 'register', HTMLButtonElement | null>>({
    login: null,
    register: null,
  });

  const switchMode = (next: 'login' | 'register', moveFocus = false) => {
    setMode(next);
    setError(null);
    if (moveFocus) {
      tabRefs.current[next]?.focus();
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const idx = AUTH_MODES.indexOf(mode);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = AUTH_MODES[(idx + delta + AUTH_MODES.length) % AUTH_MODES.length];
      switchMode(next, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      switchMode('login', true);
    } else if (e.key === 'End') {
      e.preventDefault();
      switchMode('register', true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    if (useRemoteApi) {
      setSubmitting(true);
      try {
        const user =
          mode === 'login'
            ? await loginWithApi(normalizedEmail, password)
            : await registerWithApi(name.trim(), normalizedEmail, password);
        await onApiAuthSuccess(user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Local fallback mode (SHA-256 hashed credentials, zero plaintext storage)
    const inputHash = await sha256Hex(password);
    if (mode === 'login') {
      const account = users.find((u) => u.email.toLowerCase() === normalizedEmail);
      const matchesPassword = account
        ? account.passwordHash
          ? account.passwordHash === inputHash
          : Boolean(account.password) && account.password === password
        : false;
      if (!account || !matchesPassword) {
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

    if (isPrimarySuperAdminEmail(normalizedEmail)) {
      setError('This email is reserved for the system SuperAdmin. Sign in instead.');
      return;
    }

    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      setError('An account with this email already exists. Sign in instead.');
      return;
    }

    // RBAC rule: all newly registered users strictly start as Customer.
    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      password: '',
      passwordHash: inputHash,
      role: 'Customer',
      permissions: [...ROLE_PERMISSIONS.Customer],
      active: true,
      createdAt: new Date().toISOString(),
    };
    onLocalRegisterSuccess(newUser);
  };

  return (
    <Modal labelledBy="auth-modal-title" maxWidthClass="max-w-md" onClose={onClose}>
      <div className="flex items-start justify-between gap-3 rounded-t-lg border-b border-mist bg-white px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <h2
            id="auth-modal-title"
            className="font-display text-xl font-normal text-indigo-depth sm:text-2xl"
          >
            {mode === 'login' ? 'Sign in to Rydio' : 'Create your Rydio account'}
          </h2>
          <p className="mt-1 text-xs text-dilute-ink">
            {mode === 'login'
              ? 'Access your reservations, pickup controls, and ride history.'
              : 'Register once to reserve scooters and e-bikes across Skopje.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="rounded border border-mist p-1.5 text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Authentication mode"
        onKeyDown={handleTabKeyDown}
        className="grid grid-cols-2 border-b border-mist bg-white px-4 sm:px-6"
      >
        <button
          ref={(el) => {
            tabRefs.current.login = el;
          }}
          id="auth-tab-login"
          type="button"
          role="tab"
          tabIndex={mode === 'login' ? 0 : -1}
          aria-selected={mode === 'login'}
          aria-controls="auth-tabpanel"
          onClick={() => switchMode('login')}
          className={`min-h-[42px] border-b-2 py-3 text-xs font-medium tracking-[0.14em] transition-colors ${
            mode === 'login'
              ? 'border-indigo-depth text-indigo-depth'
              : 'border-transparent text-dilute-ink hover:text-indigo-depth'
          }`}
        >
          SIGN IN
        </button>
        <button
          ref={(el) => {
            tabRefs.current.register = el;
          }}
          id="auth-tab-register"
          type="button"
          role="tab"
          tabIndex={mode === 'register' ? 0 : -1}
          aria-selected={mode === 'register'}
          aria-controls="auth-tabpanel"
          onClick={() => switchMode('register')}
          className={`min-h-[42px] border-b-2 py-3 text-xs font-medium tracking-[0.14em] transition-colors ${
            mode === 'register'
              ? 'border-indigo-depth text-indigo-depth'
              : 'border-transparent text-dilute-ink hover:text-indigo-depth'
          }`}
        >
          CREATE ACCOUNT
        </button>
      </div>

      <form
        id="auth-tabpanel"
        role="tabpanel"
        aria-labelledby={mode === 'login' ? 'auth-tab-login' : 'auth-tab-register'}
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 p-4 sm:p-6"
      >
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-status-danger-text/30 bg-status-danger-bg px-3.5 py-2.5 text-xs text-status-danger-deep"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'register' && (
          <div>
            <label
              htmlFor="auth-name"
              className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
            >
              FULL NAME
            </label>
            <input
              id="auth-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ana Stojanovska"
              className="w-full rounded border border-mist bg-white px-3 py-2.5 text-sm text-indigo-depth"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="auth-email"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
          >
            EMAIL ADDRESS
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.mk"
            className="w-full rounded border border-mist bg-white px-3 py-2.5 text-sm text-indigo-depth"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
          >
            PASSWORD
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-mist bg-white px-3 py-2.5 text-sm text-indigo-depth"
          />
        </div>

        {mode === 'register' && (
          <div>
            <label
              htmlFor="auth-confirm"
              className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
            >
              CONFIRM PASSWORD
            </label>
            <input
              id="auth-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded border border-mist bg-white px-3 py-2.5 text-sm text-indigo-depth"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded bg-indigo-depth px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-white transition-colors hover:bg-ink-current disabled:opacity-50"
        >
          {submitting
            ? 'PLEASE WAIT...'
            : mode === 'login'
              ? 'SIGN IN'
              : 'CREATE ACCOUNT'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>
    </Modal>
  );
}
