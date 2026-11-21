import { useState } from 'react';
import { X, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import type { UserAccount } from '../types/rydio';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  users: UserAccount[];
  onLoginSuccess: (user: UserAccount) => void;
  onRegisterSuccess: (newUser: UserAccount) => void;
  onClose: () => void;
}

export function AuthModal({
  initialMode = 'login',
  users,
  onLoginSuccess,
  onRegisterSuccess,
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

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
      onLoginSuccess(account);
      return;
    }

    // Register new Customer account
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
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      setError('An account with this email already exists. Sign in instead.');
      return;
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'Customer',
      active: true,
      createdAt: new Date().toISOString(),
    };
    onRegisterSuccess(newUser);
  };

  const fillSuperAdmin = () => {
    setMode('login');
    setEmail('superadmin@rydio.mk');
    setPassword('SuperAdmin123!');
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1A33]/45 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md rounded-lg border border-[#DDE2E8] bg-[#F6F7F9] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between rounded-t-lg border-b border-[#DDE2E8] bg-white px-6 py-5">
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-2xl font-normal text-[#0A1A33]"
            >
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

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 border-b border-[#DDE2E8] bg-white px-6">
          <button
            type="button"
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
            <div className="flex items-start gap-2 rounded-md border border-[#9B2C2C]/30 bg-[#FFF5F5] px-3.5 py-2.5 text-xs text-[#822020]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-name"
                className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
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
                className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
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
              className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
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
              className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-confirm"
                className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
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
                className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-white transition-colors hover:bg-[#1E2D4A]"
          >
            {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          {/* SuperAdmin quick-fill helper for evaluation */}
          <div className="border-t border-[#DDE2E8] pt-4">
            <div className="flex items-center justify-between rounded-md border border-[#DDE2E8] bg-white px-3.5 py-2.5 text-[11px]">
              <div className="flex items-center gap-2 text-[#515F73]">
                <ShieldCheck className="h-4 w-4 text-[#0A1A33]" />
                <span>
                  SuperAdmin: <strong className="text-[#0A1A33]">superadmin@rydio.mk</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={fillSuperAdmin}
                className="rounded border border-[#0A1A33]/30 px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-[#0A1A33] hover:bg-[#0A1A33] hover:text-white"
              >
                FILL
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
