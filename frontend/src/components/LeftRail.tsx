import { useEffect, useState } from 'react';
import {
  Home,
  LayoutGrid,
  MapPin,
  Clock,
  SlidersHorizontal,
  Menu,
  X,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { UserAccount } from '../types/rydio';
import { canAccessAdminPanel, isPrimarySuperAdmin } from '../utils/rbac';

export type NavTab = 'home' | 'catalog' | 'stations' | 'my-rides' | 'admin';

interface LeftRailProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: UserAccount | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  activeStationsCount: number;
  freeFleetCount: number;
  activeRideCount: number;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'HOME', icon: Home },
  { id: 'catalog', label: 'CATALOG', icon: LayoutGrid },
  { id: 'stations', label: 'STATIONS', icon: MapPin },
  { id: 'my-rides', label: 'MY RIDES', icon: Clock },
  { id: 'admin', label: 'ADMIN', icon: SlidersHorizontal },
];

function RydioMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className="shrink-0 sm:h-[34px] sm:w-[34px]"
    >
      <circle cx="18" cy="18" r="16.5" stroke="#0A1A33" strokeWidth="1.4" />
      <path
        d="M5.5 21.5C9.5 16.5 13.8 14.5 18 16.8C22.2 19.1 26.2 17.4 30.5 13"
        stroke="#0A1A33"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 26C12.8 22.4 16.8 21.5 21.2 23.2C24.8 24.6 27.6 23.8 30 21.6"
        stroke="#1E2D4A"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="24" cy="12" r="2.2" fill="#0A1A33" />
    </svg>
  );
}

export function LeftRail({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenAuth,
  onLogout,
  activeStationsCount,
  freeFleetCount,
  activeRideCount,
}: LeftRailProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const isPrivileged = canAccessAdminPanel(currentUser);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.id === 'admin' && !isPrivileged) return false;
    return true;
  });

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-[58px] items-center justify-between gap-2 border-b border-[#DDE2E8] bg-[#F6F7F9]/95 px-3.5 backdrop-blur-sm sm:px-5 lg:hidden">
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="flex min-h-[40px] items-center gap-2 text-left"
        >
          <RydioMark />
          <span className="font-display text-[13px] font-medium tracking-[0.22em] text-[#0A1A33] sm:text-sm sm:tracking-[0.26em]">
            RYDIO
          </span>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {currentUser ? (
            <span className="hidden rounded border border-[#DDE2E8] bg-white px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-[#0A1A33] min-[370px]:inline-flex min-[370px]:items-center min-[370px]:gap-1">
              {isPrimarySuperAdmin(currentUser) && <ShieldCheck className="h-3 w-3 shrink-0" />}
              {currentUser.role.toUpperCase()}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAuth('login');
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded bg-[#0A1A33] px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-white"
            >
              SIGN IN
            </button>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded border border-[#DDE2E8] bg-white p-2 text-[#0A1A33]"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer + Dimmed Backdrop Scrim */}
      {mobileOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
            className="rydio-backdrop-enter fixed inset-0 top-[58px] z-20 bg-[#0A1A33]/40 backdrop-blur-[2px] lg:hidden"
          />
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            className="rydio-drawer-enter pb-safe fixed inset-x-0 top-[58px] z-30 max-h-[calc(100dvh-58px)] overflow-y-auto border-b border-[#DDE2E8] bg-[#F6F7F9] px-4 pt-4 shadow-xl lg:hidden"
          >
            <div className="flex flex-col gap-1.5">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex min-h-[44px] items-center justify-between rounded-md px-3.5 py-2.5 text-xs font-medium tracking-[0.16em] transition-colors ${
                      isActive
                        ? 'bg-[#0A1A33] text-[#F6F7F9]'
                        : 'text-[#515F73] hover:bg-white hover:text-[#0A1A33]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                      {item.label}
                    </span>
                    {item.id === 'my-rides' && activeRideCount > 0 && (
                      <span
                        className={`tabular-nums rounded-full px-2 py-0.5 text-[11px] ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[#0A1A33] text-white'
                        }`}
                      >
                        {activeRideCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Live Fleet Counters inside Mobile Drawer */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[#DDE2E8] pt-4">
              <div className="rounded-md border border-[#DDE2E8] bg-white px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-[0.12em] text-[#515F73]">STATIONS</p>
                <p className="tabular-nums mt-0.5 font-display text-lg font-semibold text-[#0A1A33]">
                  {String(activeStationsCount).padStart(2, '0')}
                </p>
              </div>
              <div className="rounded-md border border-[#DDE2E8] bg-white px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-[0.12em] text-[#515F73]">FREE</p>
                <p className="tabular-nums mt-0.5 font-display text-lg font-semibold text-[#0A1A33]">
                  {freeFleetCount}
                </p>
              </div>
            </div>

            {/* Mobile User Profile / Auth Controls */}
            <div className="mt-3 border-t border-[#DDE2E8] pt-3">
              {currentUser ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#DDE2E8] bg-white p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isPrimarySuperAdmin(currentUser) && (
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#0A1A33]" />
                      )}
                      <p className="truncate text-xs font-semibold text-[#0A1A33]">
                        {currentUser.name}
                      </p>
                    </div>
                    <p className="truncate text-[11px] text-[#515F73]">{currentUser.email}</p>
                    <span className="mt-1 inline-block rounded bg-[#F6F7F9] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#0A1A33]">
                      {currentUser.role.toUpperCase()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onLogout();
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-[#0A1A33]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    SIGN OUT
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onOpenAuth('login');
                    }}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded bg-[#0A1A33] px-3 py-2 text-[11px] font-medium tracking-[0.12em] text-white"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    SIGN IN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onOpenAuth('register');
                    }}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded border border-[#DDE2E8] bg-white px-3 py-2 text-[11px] font-medium tracking-[0.12em] text-[#0A1A33]"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    REGISTER
                  </button>
                </div>
              )}
            </div>
          </nav>
        </>
      )}

      {/* Desktop Persistent Left Vertical Rail */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-[196px] lg:flex-col lg:justify-between lg:border-r lg:border-[#DDE2E8] lg:bg-[#F6F7F9] lg:px-5 lg:py-7">
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="group flex w-full flex-col items-center gap-2.5 pb-7 text-center"
          >
            <RydioMark />
            <span className="font-display text-xs font-medium tracking-[0.32em] text-[#0A1A33] transition-opacity group-hover:opacity-75">
              RYDIO
            </span>
          </button>

          <div className="mb-6 h-px w-full bg-[#DDE2E8]" />

          <nav aria-label="Primary navigation" className="flex flex-col gap-1.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectTab(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                    isActive
                      ? 'text-[#0A1A33]'
                      : 'text-[#515F73] hover:bg-white/70 hover:text-[#0A1A33]'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      isActive
                        ? 'border-[#0A1A33] bg-[#0A1A33] text-[#F6F7F9]'
                        : 'border-[#DDE2E8] bg-white text-[#515F73] group-hover:border-[#0A1A33] group-hover:text-[#0A1A33]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </span>
                  <span className="flex-1 text-[11px] font-medium tracking-[0.14em]">
                    {item.label}
                  </span>
                  {item.id === 'my-rides' && activeRideCount > 0 && (
                    <span className="tabular-nums rounded-full bg-[#0A1A33] px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {activeRideCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Live Fleet Totals + Real Account Controls */}
        <div className="space-y-4 border-t border-[#DDE2E8] pt-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium tracking-[0.1em] text-[#515F73]">
                STATIONS
              </span>
              <span className="tabular-nums text-xs font-semibold text-[#0A1A33]">
                {String(activeStationsCount).padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium tracking-[0.1em] text-[#515F73]">
                FREE
              </span>
              <span className="tabular-nums text-xs font-semibold text-[#0A1A33]">
                {freeFleetCount}
              </span>
            </div>
          </div>

          {currentUser ? (
            <div className="space-y-2.5 rounded-md border border-[#DDE2E8] bg-white p-3">
              <div>
                <div className="flex items-center gap-1.5">
                  {isPrimarySuperAdmin(currentUser) && (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#0A1A33]" />
                  )}
                  <p className="truncate text-xs font-semibold text-[#0A1A33]">
                    {currentUser.name}
                  </p>
                </div>
                <p className="truncate text-[11px] text-[#515F73]">{currentUser.email}</p>
                <span className="mt-1.5 inline-block rounded bg-[#F6F7F9] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#0A1A33]">
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-[11px] font-medium tracking-[0.12em] text-[#515F73] transition-colors hover:border-[#0A1A33] hover:text-[#0A1A33]"
              >
                <LogOut className="h-3 w-3" />
                SIGN OUT
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="flex w-full items-center justify-center gap-1.5 rounded bg-[#0A1A33] px-3 py-2 text-[11px] font-medium tracking-[0.14em] text-white transition-colors hover:bg-[#1E2D4A]"
              >
                <LogIn className="h-3.5 w-3.5" />
                SIGN IN
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-[#0A1A33] transition-colors hover:border-[#0A1A33]"
              >
                CREATE ACCOUNT
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
