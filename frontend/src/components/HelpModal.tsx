import { Clock, HelpCircle, Keyboard, MapPin, ShieldAlert, Sparkles, X } from 'lucide-react';
import { Modal } from './Modal';

interface HelpModalProps {
  canAccessAdmin: boolean;
  onClose: () => void;
}

export function HelpModal({ canAccessAdmin, onClose }: HelpModalProps) {
  return (
    <Modal labelledBy="help-modal-title" maxWidthClass="max-w-xl" onClose={onClose}>
      <div className="flex items-start justify-between gap-3 rounded-t-lg border-b border-mist bg-surface-pure px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="mt-1 h-5 w-5 shrink-0 text-indigo-depth" />
          <div>
            <h2
              id="help-modal-title"
              className="font-display text-xl font-normal text-indigo-depth sm:text-2xl"
            >
              Rider Guide, Tariffs &amp; Shortcuts
            </h2>
            <p className="mt-1 text-xs text-dilute-ink">
              Transparent pricing rules, station pickup &amp; drop-off policies, and quick navigation.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rider guide"
          className="inline-flex min-h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded border border-mist p-1.5 text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-mist bg-surface-pure p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-indigo-depth">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              AUTOMATIC DAILY CAP
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-dilute-ink">
              Rides bill hourly (rounded up to whole hours) and automatically cap at the vehicle’s
              24-hour full-day rate once your multi-hour total reaches the daily cap (~5–6h). Max
              booking duration is 7 days (168h).
            </p>
          </div>

          <div className="rounded-md border border-mist bg-surface-pure p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-indigo-depth">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              RETURN TO ANY SKOPJE HUB
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-dilute-ink">
              Pick up your reserved scooter or e-bike at its docked station (up to 30 minutes before
              your start time) and lock it into any of the Skopje Vardar corridor stations when done.
            </p>
          </div>

          <div className="rounded-md border border-mist bg-surface-pure p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-indigo-depth">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              FREE CANCELLATION CUTOFF
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-dilute-ink">
              Upcoming reservations can be cancelled at 0 MKD up to <strong>1 hour before</strong>{' '}
              the scheduled start time from <strong>My Rides</strong>.
            </p>
          </div>

          <div className="rounded-md border border-mist bg-surface-pure p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-indigo-depth">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              LATE RETURN TARIFF (1.5×)
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-dilute-ink">
              Returning past your booked end time adds a <strong>1.5× hourly tariff</strong> per
              overdue hour (settled automatically against server time upon dock lock).
            </p>
          </div>
        </div>

        <div className="rounded-md border border-mist bg-paper-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-indigo-depth">
            <Keyboard className="h-3.5 w-3.5 shrink-0" />
            KEYBOARD SHORTCUTS
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-dilute-ink sm:grid-cols-3">
            <div className="flex items-center justify-between rounded border border-mist bg-surface-pure px-2.5 py-1.5">
              <span>Home</span>
              <kbd className="tabular-nums font-semibold text-indigo-depth">Alt + 1</kbd>
            </div>
            <div className="flex items-center justify-between rounded border border-mist bg-surface-pure px-2.5 py-1.5">
              <span>Catalog</span>
              <kbd className="tabular-nums font-semibold text-indigo-depth">Alt + 2</kbd>
            </div>
            <div className="flex items-center justify-between rounded border border-mist bg-surface-pure px-2.5 py-1.5">
              <span>Stations</span>
              <kbd className="tabular-nums font-semibold text-indigo-depth">Alt + 3</kbd>
            </div>
            <div className="flex items-center justify-between rounded border border-mist bg-surface-pure px-2.5 py-1.5">
              <span>My Rides</span>
              <kbd className="tabular-nums font-semibold text-indigo-depth">Alt + 4</kbd>
            </div>
            {canAccessAdmin && (
              <div className="flex items-center justify-between rounded border border-mist bg-surface-pure px-2.5 py-1.5">
                <span>Admin</span>
                <kbd className="tabular-nums font-semibold text-indigo-depth">Alt + 5</kbd>
              </div>
            )}
            <div className="flex items-center justify-between rounded border border-mist bg-surface-pure px-2.5 py-1.5">
              <span>Rider Guide</span>
              <kbd className="tabular-nums font-semibold text-indigo-depth">?</kbd>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] w-full rounded bg-indigo-depth px-5 py-2 text-xs font-medium tracking-[0.14em] text-surface-pure hover:bg-ink-current sm:w-auto"
          >
            GOT IT
          </button>
        </div>
      </div>
    </Modal>
  );
}
