import { useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Search, Trash2, Wrench, CheckCircle2 } from 'lucide-react';
import type { Station, Vehicle, VehicleType } from '../../types/rydio';
import { deriveFullDayRateMkd, formatMkd } from '../../utils/pricing';
import type { PendingConfirm } from './types';

export type VehicleStatusFilter = 'ALL' | 'CATALOG' | 'SERVICE';

interface AdminVehiclesSectionProps {
  vehicles: Vehicle[];
  vehicleTypes: VehicleType[];
  stations: Station[];
  initialStatusFilter?: VehicleStatusFilter;
  onShowError: (message: string) => void;
  onRequestConfirm: (confirm: PendingConfirm) => void;
  onToggleMaintenance: (vehicleId: string) => Promise<void>;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<boolean>;
  onUpdateVehicle: (vehicleId: string, patch: Partial<Vehicle>) => Promise<boolean>;
  onDeleteVehicle: (vehicleId: string) => Promise<void>;
}

function nextUnusedCode(prefix: string, existingCodes: string[], startNum: number) {
  const taken = new Set(existingCodes.map((c) => c.trim().toLowerCase()));
  let n = startNum;
  while (taken.has(`${prefix}${String(n).padStart(2, '0')}`.toLowerCase())) {
    n += 1;
  }
  return `${prefix}${String(n).padStart(2, '0')}`;
}

export function AdminVehiclesSection({
  vehicles,
  vehicleTypes,
  stations,
  initialStatusFilter = 'ALL',
  onShowError,
  onRequestConfirm,
  onToggleMaintenance,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
}: AdminVehiclesSectionProps) {
  const initialType = vehicleTypes[0];
  const [vehSearch, setVehSearch] = useState('');
  const [vehStatusFilter, setVehStatusFilter] = useState<VehicleStatusFilter>(initialStatusFilter);
  const [newVehName, setNewVehName] = useState('');
  const [newVehCode, setNewVehCode] = useState('');
  const [newVehTypeId, setNewVehTypeId] = useState(initialType?.id ?? '');
  const [newVehStationId, setNewVehStationId] = useState(stations[0]?.id ?? '');
  const [newVehRate, setNewVehRate] = useState(initialType?.defaultHourlyRateMkd ?? 180);
  const [newVehDayRate, setNewVehDayRate] = useState(() =>
    deriveFullDayRateMkd(
      initialType?.defaultHourlyRateMkd ?? 180,
      initialType?.fullDayDiscountPercent ?? 20
    )
  );
  const [creating, setCreating] = useState(false);

  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehName, setEditVehName] = useState('');
  const [editVehCode, setEditVehCode] = useState('');
  const [editTypeId, setEditTypeId] = useState('');
  const [editRate, setEditRate] = useState(180);
  const [editDayRate, setEditDayRate] = useState(950);
  const [editStationId, setEditStationId] = useState('');
  const [editBattery, setEditBattery] = useState(90);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const getStationName = (id?: string) => stations.find((s) => s.id === id)?.name ?? '—';
  const getType = (id: string) => vehicleTypes.find((t) => t.id === id);

  const filteredVehicles = useMemo(() => {
    const q = vehSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (vehStatusFilter === 'CATALOG' && v.inMaintenance) return false;
      if (vehStatusFilter === 'SERVICE' && !v.inMaintenance) return false;
      if (q) {
        const stationName = stations.find((s) => s.id === v.stationId)?.name.toLowerCase() ?? '';
        const typeName = vehicleTypes.find((t) => t.id === v.typeId)?.name.toLowerCase() ?? '';
        return (
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          stationName.includes(q) ||
          typeName.includes(q)
        );
      }
      return true;
    });
  }, [vehicles, vehSearch, vehStatusFilter, stations, vehicleTypes]);

  const handleSelectNewType = (typeId: string) => {
    setNewVehTypeId(typeId);
    const chosen = getType(typeId);
    if (chosen) {
      setNewVehRate(chosen.defaultHourlyRateMkd);
      setNewVehDayRate(
        deriveFullDayRateMkd(chosen.defaultHourlyRateMkd, chosen.fullDayDiscountPercent)
      );
    }
  };

  const handleChangeNewRate = (rate: number) => {
    setNewVehRate(rate);
    const chosen = getType(newVehTypeId || vehicleTypes[0]?.id || '');
    setNewVehDayRate(deriveFullDayRateMkd(rate, chosen?.fullDayDiscountPercent ?? 20));
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (!newVehName.trim()) {
      onShowError('Vehicle name is required.');
      return;
    }
    const code =
      newVehCode.trim() ||
      nextUnusedCode(
        'RYD-',
        vehicles.map((v) => v.code),
        vehicles.length + 1
      );
    const safeRate = Math.max(50, Number.isFinite(newVehRate) ? newVehRate : 180);
    const chosenType = getType(newVehTypeId || vehicleTypes[0]?.id || '');
    const safeDayRate = Math.max(
      safeRate,
      Number.isFinite(newVehDayRate) && newVehDayRate > 0
        ? newVehDayRate
        : deriveFullDayRateMkd(safeRate, chosenType?.fullDayDiscountPercent ?? 20)
    );

    setCreating(true);
    try {
      const ok = await onAddVehicle({
        code,
        name: newVehName.trim(),
        typeId: newVehTypeId || vehicleTypes[0]?.id || '',
        stationId: newVehStationId || stations[0]?.id || '',
        hourlyRateMkd: safeRate,
        fullDayRateMkd: safeDayRate,
        batteryPercent: 100,
        rangeKm: 50,
        maxSpeedKmh: 25,
        inMaintenance: false,
      });
      if (ok) {
        setNewVehName('');
        setNewVehCode('');
      }
    } finally {
      setCreating(false);
    }
  };

  const startEditVehicle = (v: Vehicle) => {
    setEditingVehicleId(v.id);
    setEditVehName(v.name);
    setEditVehCode(v.code);
    setEditTypeId(v.typeId);
    setEditRate(v.hourlyRateMkd);
    setEditDayRate(v.fullDayRateMkd);
    setEditStationId(v.stationId);
    setEditBattery(v.batteryPercent);
  };

  const handleEditTypeChange = (nextTypeId: string) => {
    setEditTypeId(nextTypeId);
    const chosen = getType(nextTypeId);
    if (chosen) {
      setEditRate(chosen.defaultHourlyRateMkd);
      setEditDayRate(
        deriveFullDayRateMkd(chosen.defaultHourlyRateMkd, chosen.fullDayDiscountPercent)
      );
    }
  };

  const handleEditRateChange = (vehicleTypeId: string, nextRate: number) => {
    setEditRate(nextRate);
    const vt = getType(vehicleTypeId);
    setEditDayRate(deriveFullDayRateMkd(nextRate, vt?.fullDayDiscountPercent ?? 20));
  };

  const saveEditVehicle = async (v: Vehicle) => {
    if (savingId) return;
    if (!editVehName.trim() || !editVehCode.trim()) {
      onShowError('Vehicle name and fleet code cannot be empty.');
      return;
    }
    const safeRate = Math.max(50, Number.isFinite(editRate) ? editRate : 180);
    const safeDay = Math.max(safeRate, Number.isFinite(editDayRate) ? editDayRate : safeRate);
    setSavingId(v.id);
    try {
      const ok = await onUpdateVehicle(v.id, {
        name: editVehName.trim(),
        code: editVehCode.trim(),
        typeId: editTypeId || v.typeId,
        hourlyRateMkd: safeRate,
        fullDayRateMkd: safeDay,
        stationId: editStationId,
        batteryPercent: Math.max(0, Math.min(100, Number.isFinite(editBattery) ? editBattery : 100)),
      });
      if (ok) {
        setEditingVehicleId(null);
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleService = async (vehicleId: string) => {
    if (togglingId) return;
    setTogglingId(vehicleId);
    try {
      await onToggleMaintenance(vehicleId);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
      <form
        noValidate
        onSubmit={(e) => void handleCreateVehicle(e)}
        className="grid gap-3 rounded-lg border border-mist bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-7"
      >
        <div className="sm:col-span-2">
          <label
            htmlFor="add-veh-name"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            MODEL NAME
          </label>
          <input
            id="add-veh-name"
            type="text"
            placeholder="e.g. Rydio S2"
            value={newVehName}
            onChange={(e) => setNewVehName(e.target.value)}
            required
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="add-veh-code"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            FLEET CODE
          </label>
          <input
            id="add-veh-code"
            type="text"
            placeholder="RYD-S09"
            value={newVehCode}
            onChange={(e) => setNewVehCode(e.target.value)}
            className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="add-veh-type"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            VEHICLE TYPE
          </label>
          <select
            id="add-veh-type"
            value={newVehTypeId}
            onChange={(e) => handleSelectNewType(e.target.value)}
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          >
            {vehicleTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="add-veh-station"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            DOCK STATION
          </label>
          <select
            id="add-veh-station"
            value={newVehStationId}
            onChange={(e) => setNewVehStationId(e.target.value)}
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="add-veh-rate"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            MKD / HR
          </label>
          <input
            id="add-veh-rate"
            type="number"
            min={50}
            step={10}
            value={newVehRate}
            onChange={(e) => handleChangeNewRate(Number(e.target.value))}
            className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="add-veh-dayrate"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            DAY CAP (MKD)
          </label>
          <input
            id="add-veh-dayrate"
            type="number"
            min={50}
            step={10}
            value={newVehDayRate}
            onChange={(e) => setNewVehDayRate(Number(e.target.value))}
            className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-7 lg:flex lg:justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded bg-indigo-depth px-5 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-ink-current disabled:opacity-45 lg:w-auto"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {creating ? 'ADDING...' : 'ADD VEHICLE'}
          </button>
        </div>
      </form>

      {/* Quick Fleet Search & Status Filter */}
      <div className="flex flex-col gap-3 rounded-lg border border-mist bg-surface-pure p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-dilute-ink" />
          <input
            type="search"
            aria-label="Search fleet vehicles by name, code, type, or station"
            placeholder="Filter by model, code, or station…"
            value={vehSearch}
            onChange={(e) => setVehSearch(e.target.value)}
            className="min-h-[38px] w-full rounded border border-mist bg-paper-white py-1.5 pr-3 pl-8 text-xs text-indigo-depth"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter vehicles by service state">
          {(
            [
              ['ALL', `All (${vehicles.length})`],
              ['CATALOG', `In Catalog (${vehicles.filter((v) => !v.inMaintenance).length})`],
              ['SERVICE', `In Service (${vehicles.filter((v) => v.inMaintenance).length})`],
            ] as const
          ).map(([key, label]) => {
            const active = vehStatusFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setVehStatusFilter(key)}
                className={`min-h-[36px] rounded border px-3 py-1 text-[11px] font-medium tracking-[0.08em] transition-colors ${
                  active
                    ? 'border-indigo-depth bg-indigo-depth text-surface-pure'
                    : 'border-mist bg-paper-white text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile & Tablet Stacked Vehicle Cards (< xl) */}
      <div className="space-y-3 xl:hidden">
        {filteredVehicles.length === 0 ? (
          <div className="rounded-lg border border-mist bg-surface-pure p-8 text-center text-sm text-dilute-ink">
            No vehicles match your search or status filter.
          </div>
        ) : (
          filteredVehicles.map((v) => {
          const isEditing = editingVehicleId === v.id;
          const isSaving = savingId === v.id;
          const isToggling = togglingId === v.id;
          const typeName = getType(v.typeId)?.name ?? '—';

          return (
            <div key={v.id} className="rounded-lg border border-mist bg-surface-pure p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid gap-2.5 min-[380px]:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`mob-edit-name-${v.id}`}
                        className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink"
                      >
                        MODEL NAME
                      </label>
                      <input
                        id={`mob-edit-name-${v.id}`}
                        type="text"
                        aria-label={`Edit name for ${v.name}`}
                        value={editVehName}
                        onChange={(e) => setEditVehName(e.target.value)}
                        className="min-h-[40px] w-full rounded border border-indigo-depth bg-surface-pure px-2.5 py-1.5 text-sm text-indigo-depth"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`mob-edit-code-${v.id}`}
                        className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink"
                      >
                        FLEET CODE
                      </label>
                      <input
                        id={`mob-edit-code-${v.id}`}
                        type="text"
                        aria-label={`Edit fleet code for ${v.name}`}
                        value={editVehCode}
                        onChange={(e) => setEditVehCode(e.target.value)}
                        className="tabular-nums min-h-[40px] w-full rounded border border-mist bg-paper-white px-2.5 py-1.5 text-sm text-indigo-depth"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2.5 min-[380px]:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`mob-edit-type-${v.id}`}
                        className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink"
                      >
                        VEHICLE TYPE
                      </label>
                      <select
                        id={`mob-edit-type-${v.id}`}
                        aria-label={`Edit vehicle type for ${v.name}`}
                        value={editTypeId}
                        onChange={(e) => handleEditTypeChange(e.target.value)}
                        className="min-h-[40px] w-full rounded border border-mist bg-paper-white px-2.5 py-1.5 text-sm text-indigo-depth"
                      >
                        {vehicleTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`mob-edit-station-${v.id}`}
                        className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-dilute-ink"
                      >
                        STATION
                      </label>
                      <select
                        id={`mob-edit-station-${v.id}`}
                        aria-label={`Edit station for ${v.name}`}
                        value={editStationId}
                        onChange={(e) => setEditStationId(e.target.value)}
                        className="min-h-[40px] w-full rounded border border-mist bg-paper-white px-2.5 py-1.5 text-sm text-indigo-depth"
                      >
                        {stations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label
                        htmlFor={`mob-edit-rate-${v.id}`}
                        className="mb-1 block text-[10px] font-medium tracking-[0.1em] text-dilute-ink"
                      >
                        MKD / HR
                      </label>
                      <input
                        id={`mob-edit-rate-${v.id}`}
                        type="number"
                        aria-label={`Edit hourly rate in MKD for ${v.name}`}
                        min={50}
                        step={10}
                        value={editRate}
                        onChange={(e) =>
                          handleEditRateChange(editTypeId || v.typeId, Number(e.target.value))
                        }
                        className="tabular-nums min-h-[40px] w-full rounded border border-mist bg-paper-white px-2 py-1.5 text-sm text-indigo-depth"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`mob-edit-daycap-${v.id}`}
                        className="mb-1 block text-[10px] font-medium tracking-[0.1em] text-dilute-ink"
                      >
                        DAY CAP
                      </label>
                      <input
                        id={`mob-edit-daycap-${v.id}`}
                        type="number"
                        aria-label={`Edit full-day rate cap in MKD for ${v.name}`}
                        min={50}
                        step={10}
                        value={editDayRate}
                        onChange={(e) => setEditDayRate(Number(e.target.value))}
                        className="tabular-nums min-h-[40px] w-full rounded border border-mist bg-paper-white px-2 py-1.5 text-sm text-indigo-depth"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`mob-edit-battery-${v.id}`}
                        className="mb-1 block text-[10px] font-medium tracking-[0.1em] text-dilute-ink"
                      >
                        BATTERY %
                      </label>
                      <input
                        id={`mob-edit-battery-${v.id}`}
                        type="number"
                        aria-label={`Edit battery percentage for ${v.name}`}
                        min={0}
                        max={100}
                        value={editBattery}
                        onChange={(e) => setEditBattery(Number(e.target.value))}
                        className="tabular-nums min-h-[40px] w-full rounded border border-mist bg-paper-white px-2 py-1.5 text-sm text-indigo-depth"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void saveEditVehicle(v)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded bg-indigo-depth px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setEditingVehicleId(null)}
                      className="min-h-[38px] flex-1 rounded border border-mist bg-white px-3 py-1.5 text-xs font-medium text-dilute-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-indigo-depth">{v.name}</p>
                      <p className="tabular-nums text-xs text-dilute-ink">
                        {v.code} · {typeName}
                      </p>
                    </div>
                    {v.inMaintenance ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[11px] font-medium text-status-danger-text">
                        <Wrench className="h-3 w-3" />
                        In Service
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-status-ok-border bg-status-ok-bg px-2 py-0.5 text-[11px] font-medium text-status-ok-text">
                        <CheckCircle2 className="h-3 w-3" />
                        In Catalog
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-dilute-ink">
                    <span>{getStationName(v.stationId)}</span>
                    <span className="tabular-nums font-medium text-indigo-depth">
                      {formatMkd(v.hourlyRateMkd)}/hr · Cap {formatMkd(v.fullDayRateMkd)} ·{' '}
                      {v.batteryPercent}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-mist pt-3">
                    <button
                      type="button"
                      onClick={() => startEditVehicle(v)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded border border-mist bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-depth"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => void handleToggleService(v.id)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded border border-mist bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-45"
                    >
                      {isToggling && <Loader2 className="h-3 w-3 animate-spin" />}
                      {v.inMaintenance ? 'Restore' : 'Service'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${v.name}`}
                      onClick={() =>
                        onRequestConfirm({
                          title: `Delete ${v.name}?`,
                          description: `Vehicle ${v.code} (${v.name}) will be removed from the active fleet. Completed ride history and revenue will be preserved.`,
                          confirmLabel: 'Delete Vehicle',
                          action: () => onDeleteVehicle(v.id),
                        })
                      }
                      className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded border border-mist p-2 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        }))}
      </div>

      {/* Desktop Table (xl+) */}
      <div className="hidden overflow-x-auto rounded-lg border border-mist bg-surface-pure xl:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist bg-paper-white text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
            <tr>
              <th className="px-4 py-3">VEHICLE</th>
              <th className="px-4 py-3">TYPE</th>
              <th className="px-4 py-3">STATION</th>
              <th className="px-4 py-3">TARIFF &amp; BATTERY</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-dilute-ink">
                  No vehicles match your search or status filter.
                </td>
              </tr>
            ) : (
              filteredVehicles.map((v) => {
              const isEditing = editingVehicleId === v.id;
              const isSaving = savingId === v.id;
              const isToggling = togglingId === v.id;
              return (
                <tr key={v.id} className="hover:bg-paper-white/60">
                  <td className="px-4 py-3.5">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          aria-label={`Edit name for ${v.name}`}
                          value={editVehName}
                          onChange={(e) => setEditVehName(e.target.value)}
                          className="w-full rounded border border-indigo-depth bg-white px-2 py-1 text-xs font-medium text-indigo-depth"
                        />
                        <input
                          type="text"
                          aria-label={`Edit fleet code for ${v.name}`}
                          value={editVehCode}
                          onChange={(e) => setEditVehCode(e.target.value)}
                          className="tabular-nums w-full rounded border border-mist bg-paper-white px-2 py-1 text-[11px] text-indigo-depth"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-indigo-depth">{v.name}</p>
                        <p className="tabular-nums text-xs text-dilute-ink">{v.code}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-dilute-ink">
                    {isEditing ? (
                      <select
                        aria-label={`Edit vehicle type for ${v.name}`}
                        value={editTypeId}
                        onChange={(e) => handleEditTypeChange(e.target.value)}
                        className="rounded border border-indigo-depth bg-white px-2 py-1 text-xs text-indigo-depth"
                      >
                        {vehicleTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      getType(v.typeId)?.name ?? '—'
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-dilute-ink">
                    {isEditing ? (
                      <select
                        aria-label={`Edit station for ${v.name}`}
                        value={editStationId}
                        onChange={(e) => setEditStationId(e.target.value)}
                        className="rounded border border-indigo-depth bg-white px-2 py-1 text-xs text-indigo-depth"
                      >
                        {stations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      getStationName(v.stationId)
                    )}
                  </td>
                  <td className="tabular-nums px-4 py-3.5 text-xs font-medium text-indigo-depth">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="number"
                          aria-label={`Edit hourly rate for ${v.name}`}
                          min={50}
                          step={10}
                          value={editRate}
                          onChange={(e) =>
                            handleEditRateChange(editTypeId || v.typeId, Number(e.target.value))
                          }
                          className="w-20 rounded border border-indigo-depth px-2 py-1 text-xs"
                        />
                        <span className="text-[11px] text-dilute-ink">/hr</span>
                        <input
                          type="number"
                          aria-label={`Edit full-day rate cap for ${v.name}`}
                          min={50}
                          step={10}
                          value={editDayRate}
                          onChange={(e) => setEditDayRate(Number(e.target.value))}
                          className="w-20 rounded border border-indigo-depth px-2 py-1 text-xs"
                        />
                        <span className="text-[11px] text-dilute-ink">/d</span>
                        <input
                          type="number"
                          aria-label={`Edit battery percentage for ${v.name}`}
                          min={0}
                          max={100}
                          value={editBattery}
                          onChange={(e) => setEditBattery(Number(e.target.value))}
                          className="w-16 rounded border border-indigo-depth px-2 py-1 text-xs"
                        />
                        <span className="text-[11px] text-dilute-ink">%</span>
                      </div>
                    ) : (
                      <span>
                        {formatMkd(v.hourlyRateMkd)}/hr · Cap {formatMkd(v.fullDayRateMkd)} ·{' '}
                        {v.batteryPercent}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {v.inMaintenance ? (
                      <span className="inline-flex items-center gap-1 rounded border border-status-danger-border bg-status-danger-bg px-2.5 py-1 text-[11px] font-medium text-status-danger-text">
                        <Wrench className="h-3 w-3" />
                        In Service
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-status-ok-border bg-status-ok-bg px-2.5 py-1 text-[11px] font-medium text-status-ok-text">
                        <CheckCircle2 className="h-3 w-3" />
                        In Catalog
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void saveEditVehicle(v)}
                            className="inline-flex items-center gap-1 rounded bg-indigo-depth px-2.5 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => setEditingVehicleId(null)}
                            className="rounded border border-mist bg-white px-2 py-1.5 text-[11px] text-dilute-ink hover:text-indigo-depth"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Edit ${v.name}`}
                          onClick={() => startEditVehicle(v)}
                          className="rounded border border-mist bg-white p-1.5 text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => void handleToggleService(v.id)}
                        className="inline-flex items-center gap-1 rounded border border-mist bg-white px-2.5 py-1.5 text-[11px] font-medium text-indigo-depth hover:border-indigo-depth disabled:opacity-45"
                      >
                        {isToggling && <Loader2 className="h-3 w-3 animate-spin" />}
                        {v.inMaintenance ? 'Restore' : 'Service'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${v.name}`}
                        onClick={() =>
                          onRequestConfirm({
                            title: `Delete ${v.name}?`,
                            description: `Vehicle ${v.code} (${v.name}) will be removed from the active fleet. Completed ride history and revenue will be preserved.`,
                            confirmLabel: 'Delete Vehicle',
                            action: () => onDeleteVehicle(v.id),
                          })
                        }
                        className="rounded border border-mist p-1.5 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
