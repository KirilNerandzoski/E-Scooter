import { useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { VehicleType } from '../../types/rydio';
import { deriveFullDayRateMkd, formatMkd } from '../../utils/pricing';
import type { PendingConfirm } from './types';

interface AdminTypesSectionProps {
  vehicleTypes: VehicleType[];
  onShowError: (message: string) => void;
  onRequestConfirm: (confirm: PendingConfirm) => void;
  onAddType: (vt: Omit<VehicleType, 'id'>) => Promise<boolean>;
  onUpdateType: (typeId: string, patch: Partial<VehicleType>) => Promise<boolean>;
  onDeleteType: (typeId: string) => Promise<void>;
}

export function AdminTypesSection({
  vehicleTypes,
  onShowError,
  onRequestConfirm,
  onAddType,
  onUpdateType,
  onDeleteType,
}: AdminTypesSectionProps) {
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [newTypeRate, setNewTypeRate] = useState(200);
  const [newTypeDiscount, setNewTypeDiscount] = useState(20);
  const [creating, setCreating] = useState(false);

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeDesc, setEditTypeDesc] = useState('');
  const [editTypeRate, setEditTypeRate] = useState(180);
  const [editTypeDiscount, setEditTypeDiscount] = useState(20);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (!newTypeName.trim()) {
      onShowError('Vehicle type name is required.');
      return;
    }
    setCreating(true);
    try {
      const ok = await onAddType({
        name: newTypeName.trim(),
        description: newTypeDesc.trim() || 'Urban electric mobility vehicle.',
        defaultHourlyRateMkd: Math.max(50, Number.isFinite(newTypeRate) ? newTypeRate : 180),
        fullDayDiscountPercent: Math.min(
          90,
          Math.max(0, Number.isFinite(newTypeDiscount) ? newTypeDiscount : 20)
        ),
      });
      if (ok) {
        setNewTypeName('');
        setNewTypeDesc('');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
      <form
        noValidate
        onSubmit={(e) => void handleCreateType(e)}
        className="grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5"
      >
        <div>
          <label
            htmlFor="add-type-name"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            TYPE NAME
          </label>
          <input
            id="add-type-name"
            type="text"
            placeholder="e.g. Cargo Scooter"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            required
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="add-type-desc"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            DESCRIPTION
          </label>
          <input
            id="add-type-desc"
            type="text"
            placeholder="Short description"
            value={newTypeDesc}
            onChange={(e) => setNewTypeDesc(e.target.value)}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div>
          <label
            htmlFor="add-type-rate"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            DEFAULT (MKD / HR)
          </label>
          <input
            id="add-type-rate"
            type="number"
            min={50}
            step={10}
            value={newTypeRate}
            onChange={(e) => setNewTypeRate(Number(e.target.value))}
            className="tabular-nums min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div>
          <label
            htmlFor="add-type-discount"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            DAY DISCOUNT (%)
          </label>
          <div className="flex gap-2">
            <input
              id="add-type-discount"
              type="number"
              min={0}
              max={90}
              step={5}
              value={newTypeDiscount}
              onChange={(e) => setNewTypeDiscount(Number(e.target.value))}
              className="tabular-nums min-h-[42px] w-20 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-2 text-sm text-[#0A1A33]"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1 rounded bg-[#0A1A33] px-3 py-2 text-xs font-medium tracking-[0.12em] text-white hover:bg-[#1E2D4A] disabled:opacity-45"
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

      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
        {vehicleTypes.map((t) => {
          const isEditing = editingTypeId === t.id;
          const isSaving = savingId === t.id;
          const sampleDayCap = deriveFullDayRateMkd(
            t.defaultHourlyRateMkd,
            t.fullDayDiscountPercent
          );

          return (
            <div
              key={t.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white p-4 sm:p-5"
            >
              {isEditing ? (
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                      TYPE NAME
                    </label>
                    <input
                      type="text"
                      aria-label={`Edit name for ${t.name}`}
                      value={editTypeName}
                      onChange={(e) => setEditTypeName(e.target.value)}
                      className="min-h-[40px] w-full rounded border border-[#0A1A33] bg-[#F6F7F9] px-2.5 py-1.5 text-sm font-medium text-[#0A1A33]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                      DESCRIPTION
                    </label>
                    <input
                      type="text"
                      aria-label={`Edit description for ${t.name}`}
                      value={editTypeDesc}
                      onChange={(e) => setEditTypeDesc(e.target.value)}
                      className="min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                        DEFAULT (MKD / HR)
                      </label>
                      <input
                        type="number"
                        aria-label={`Edit default hourly rate for ${t.name}`}
                        min={50}
                        step={10}
                        value={editTypeRate}
                        onChange={(e) => setEditTypeRate(Number(e.target.value))}
                        className="tabular-nums min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                        DAY DISCOUNT (%)
                      </label>
                      <input
                        type="number"
                        aria-label={`Edit full-day discount percent for ${t.name}`}
                        min={0}
                        max={90}
                        step={5}
                        value={editTypeDiscount}
                        onChange={(e) => setEditTypeDiscount(Number(e.target.value))}
                        className="tabular-nums min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setEditingTypeId(null)}
                      className="min-h-[36px] rounded border border-[#DDE2E8] px-3 py-1.5 text-[11px] text-[#515F73] hover:text-[#0A1A33]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={async () => {
                        if (!editTypeName.trim()) {
                          onShowError('Vehicle type name cannot be empty.');
                          return;
                        }
                        setSavingId(t.id);
                        try {
                          const ok = await onUpdateType(t.id, {
                            name: editTypeName.trim(),
                            description: editTypeDesc.trim(),
                            defaultHourlyRateMkd: Math.max(50, editTypeRate),
                            fullDayDiscountPercent: Math.min(90, Math.max(0, editTypeDiscount)),
                          });
                          if (ok) setEditingTypeId(null);
                        } finally {
                          setSavingId(null);
                        }
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded bg-[#0A1A33] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#1E2D4A] disabled:opacity-50"
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
              ) : (
                <div>
                  <h3 className="font-display text-xl text-[#0A1A33]">{t.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#515F73]">{t.description}</p>
                  <p className="tabular-nums mt-3 text-xs font-medium text-[#0A1A33]">
                    Default {formatMkd(t.defaultHourlyRateMkd)}/hr · {t.fullDayDiscountPercent}%
                    full-day discount ({formatMkd(sampleDayCap)}/day default)
                  </p>
                </div>
              )}

              {!isEditing && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Edit ${t.name}`}
                    onClick={() => {
                      setEditingTypeId(t.id);
                      setEditTypeName(t.name);
                      setEditTypeDesc(t.description);
                      setEditTypeRate(t.defaultHourlyRateMkd);
                      setEditTypeDiscount(t.fullDayDiscountPercent);
                    }}
                    className="min-h-[36px] min-w-[36px] rounded border border-[#DDE2E8] p-2 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.name}`}
                    onClick={() =>
                      onRequestConfirm({
                        title: `Delete vehicle type "${t.name}"?`,
                        description:
                          'Vehicle types with assigned fleet vehicles cannot be deleted until those vehicles are reassigned.',
                        confirmLabel: 'Delete Type',
                        action: () => onDeleteType(t.id),
                      })
                    }
                    className="min-h-[36px] min-w-[36px] rounded border border-[#DDE2E8] p-2 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
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
