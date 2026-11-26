import { useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Station } from '../../types/rydio';
import type { PendingConfirm } from './types';

interface AdminStationsSectionProps {
  stations: Station[];
  onShowError: (message: string) => void;
  onRequestConfirm: (confirm: PendingConfirm) => void;
  onAddStation: (station: Omit<Station, 'id'>) => Promise<boolean>;
  onUpdateStation: (stationId: string, patch: Partial<Station>) => Promise<boolean>;
  onDeleteStation: (stationId: string) => Promise<void>;
}

function nextUnusedCode(prefix: string, existingCodes: string[], startNum: number) {
  const taken = new Set(existingCodes.map((c) => c.trim().toLowerCase()));
  let n = startNum;
  while (taken.has(`${prefix}${String(n).padStart(2, '0')}`.toLowerCase())) {
    n += 1;
  }
  return `${prefix}${String(n).padStart(2, '0')}`;
}

export function AdminStationsSection({
  stations,
  onShowError,
  onRequestConfirm,
  onAddStation,
  onUpdateStation,
  onDeleteStation,
}: AdminStationsSectionProps) {
  const [newStationCode, setNewStationCode] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [newStationDistrict, setNewStationDistrict] = useState('Centar');
  const [newStationAddress, setNewStationAddress] = useState('');
  const [newStationCapacity, setNewStationCapacity] = useState(10);
  const [creating, setCreating] = useState(false);

  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editStationCode, setEditStationCode] = useState('');
  const [editStationName, setEditStationName] = useState('');
  const [editStationDistrict, setEditStationDistrict] = useState('');
  const [editStationAddress, setEditStationAddress] = useState('');
  const [editStationCapacity, setEditStationCapacity] = useState(10);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (!newStationName.trim()) {
      onShowError('Station name is required.');
      return;
    }
    const code =
      newStationCode.trim() ||
      nextUnusedCode(
        'SKP-',
        stations.map((s) => s.code),
        stations.length + 1
      );

    setCreating(true);
    try {
      const ok = await onAddStation({
        code,
        name: newStationName.trim(),
        district: newStationDistrict.trim() || 'Centar',
        address: newStationAddress.trim() || 'Skopje Mobility Dock',
        capacity: Math.max(1, Number.isFinite(newStationCapacity) ? newStationCapacity : 10),
      });
      if (ok) {
        setNewStationCode('');
        setNewStationName('');
        setNewStationAddress('');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
      <form
        noValidate
        onSubmit={(e) => void handleCreateStation(e)}
        className="grid gap-3 rounded-lg border border-mist bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-6"
      >
        <div>
          <label
            htmlFor="add-st-name"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            STATION NAME
          </label>
          <input
            id="add-st-name"
            type="text"
            placeholder="e.g. Bit Pazar"
            value={newStationName}
            onChange={(e) => setNewStationName(e.target.value)}
            required
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="add-st-code"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            STATION CODE
          </label>
          <input
            id="add-st-code"
            type="text"
            placeholder="SKP-07"
            value={newStationCode}
            onChange={(e) => setNewStationCode(e.target.value)}
            className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="add-st-district"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            DISTRICT
          </label>
          <input
            id="add-st-district"
            type="text"
            placeholder="Centar"
            value={newStationDistrict}
            onChange={(e) => setNewStationDistrict(e.target.value)}
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="add-st-address"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            STREET ADDRESS
          </label>
          <input
            id="add-st-address"
            type="text"
            placeholder="Boulevard & dock bay"
            value={newStationAddress}
            onChange={(e) => setNewStationAddress(e.target.value)}
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="add-st-capacity"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            CAPACITY (DOCKS)
          </label>
          <div className="flex gap-2">
            <input
              id="add-st-capacity"
              type="number"
              min={2}
              value={newStationCapacity}
              onChange={(e) => setNewStationCapacity(Number(e.target.value))}
              className="tabular-nums min-h-[42px] w-20 rounded border border-mist bg-paper-white px-2.5 py-2 text-sm text-indigo-depth"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1 rounded bg-indigo-depth px-3 py-2 text-xs font-medium tracking-[0.12em] text-white hover:bg-ink-current disabled:opacity-45"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? '...' : 'ADD'}
            </button>
          </div>
        </div>
      </form>

      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {stations.map((s) => {
          const isEditing = editingStationId === s.id;
          const isSaving = savingId === s.id;

          return (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-mist bg-white p-4 sm:p-5"
            >
              {isEditing ? (
                <div className="flex-1 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink">
                        CODE
                      </label>
                      <input
                        type="text"
                        aria-label={`Edit code for ${s.name}`}
                        value={editStationCode}
                        onChange={(e) => setEditStationCode(e.target.value)}
                        className="tabular-nums min-h-[38px] w-full rounded border border-mist bg-paper-white px-2.5 py-1 text-xs font-medium tracking-[0.1em] text-indigo-depth"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink">
                        DISTRICT
                      </label>
                      <input
                        type="text"
                        aria-label={`Edit district for ${s.name}`}
                        value={editStationDistrict}
                        onChange={(e) => setEditStationDistrict(e.target.value)}
                        className="min-h-[38px] w-full rounded border border-mist bg-paper-white px-2.5 py-1 text-xs text-indigo-depth"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink">
                      STATION NAME
                    </label>
                    <input
                      type="text"
                      aria-label={`Edit name for ${s.name}`}
                      value={editStationName}
                      onChange={(e) => setEditStationName(e.target.value)}
                      className="min-h-[38px] w-full rounded border border-indigo-depth bg-paper-white px-2.5 py-1.5 text-sm font-medium text-indigo-depth"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink">
                      STREET ADDRESS
                    </label>
                    <input
                      type="text"
                      aria-label={`Edit address for ${s.name}`}
                      value={editStationAddress}
                      onChange={(e) => setEditStationAddress(e.target.value)}
                      className="min-h-[38px] w-full rounded border border-mist bg-paper-white px-2.5 py-1.5 text-xs text-indigo-depth"
                    />
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink">
                        DOCKS
                      </label>
                      <input
                        type="number"
                        aria-label={`Edit dock capacity for ${s.name}`}
                        min={2}
                        value={editStationCapacity}
                        onChange={(e) => setEditStationCapacity(Number(e.target.value))}
                        className="tabular-nums min-h-[36px] w-20 rounded border border-mist bg-paper-white px-2.5 py-1 text-xs text-indigo-depth"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setEditingStationId(null)}
                        className="min-h-[36px] rounded border border-mist px-2.5 py-1.5 text-[11px] text-dilute-ink hover:text-indigo-depth"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                          if (!editStationName.trim() || !editStationCode.trim()) {
                            onShowError('Station name and code cannot be empty.');
                            return;
                          }
                          setSavingId(s.id);
                          try {
                            const ok = await onUpdateStation(s.id, {
                              code: editStationCode.trim(),
                              name: editStationName.trim(),
                              district: editStationDistrict.trim() || s.district,
                              address: editStationAddress.trim() || s.address,
                              capacity: Math.max(1, editStationCapacity),
                            });
                            if (ok) setEditingStationId(null);
                          } finally {
                            setSavingId(null);
                          }
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded bg-indigo-depth px-3 py-1.5 text-[11px] font-medium text-white hover:bg-ink-current disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <span className="tabular-nums text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
                    {s.code} · {s.district}
                  </span>
                  <h2 className="mt-1 font-display text-xl text-indigo-depth">{s.name}</h2>
                  <p className="mt-1 text-xs text-dilute-ink">{s.address}</p>
                  <p className="tabular-nums mt-2 text-xs font-medium text-indigo-depth">
                    Capacity: {s.capacity} docks
                  </p>
                </div>
              )}

              {!isEditing && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Edit ${s.name}`}
                    onClick={() => {
                      setEditingStationId(s.id);
                      setEditStationCode(s.code);
                      setEditStationName(s.name);
                      setEditStationDistrict(s.district);
                      setEditStationAddress(s.address);
                      setEditStationCapacity(s.capacity);
                    }}
                    className="min-h-[36px] min-w-[36px] rounded border border-mist p-2 text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${s.name}`}
                    onClick={() =>
                      onRequestConfirm({
                        title: `Delete station "${s.name}"?`,
                        description:
                          'Stations that still hold docked vehicles cannot be deleted until those vehicles are moved.',
                        confirmLabel: 'Delete Station',
                        action: () => onDeleteStation(s.id),
                      })
                    }
                    className="min-h-[36px] min-w-[36px] rounded border border-mist p-2 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
