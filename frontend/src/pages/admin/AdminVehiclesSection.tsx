import { useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, Wrench, CheckCircle2 } from 'lucide-react';
import type { Station, Vehicle, VehicleType } from '../../types/rydio';
import { deriveFullDayRateMkd, formatMkd } from '../../utils/pricing';
import type { PendingConfirm } from './types';

interface AdminVehiclesSectionProps {
  vehicles: Vehicle[];
  vehicleTypes: VehicleType[];
  stations: Station[];
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
  onShowError,
  onRequestConfirm,
  onToggleMaintenance,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
}: AdminVehiclesSectionProps) {
  const initialType = vehicleTypes[0];
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
        className="grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-7"
      >
        <div className="sm:col-span-2">
          <label
            htmlFor="add-veh-name"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
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
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div>
          <label
            htmlFor="add-veh-code"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            FLEET CODE
          </label>
          <input
            id="add-veh-code"
            type="text"
            placeholder="RYD-S09"
            value={newVehCode}
            onChange={(e) => setNewVehCode(e.target.value)}
            className="tabular-nums min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div>
          <label
            htmlFor="add-veh-type"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            VEHICLE TYPE
          </label>
          <select
            id="add-veh-type"
            value={newVehTypeId}
            onChange={(e) => handleSelectNewType(e.target.value)}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
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
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            DOCK STATION
          </label>
          <select
            id="add-veh-station"
            value={newVehStationId}
            onChange={(e) => setNewVehStationId(e.target.value)}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
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
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
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
            className="tabular-nums min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div>
          <label
            htmlFor="add-veh-dayrate"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
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
            className="tabular-nums min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-7 lg:flex lg:justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded bg-[#0A1A33] px-5 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-[#1E2D4A] disabled:opacity-45 lg:w-auto"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {creating ? 'ADDING...' : 'ADD VEHICLE'}
          </button>
        </div>
      </form>

      {/* Mobile & Tablet Stacked Vehicle Cards (< xl) */}
      <div className="space-y-3 xl:hidden">
        {vehicles.map((v) => {
          const isEditing = editingVehicleId === v.id;
          const isSaving = savingId === v.id;
          const isToggling = togglingId === v.id;
          const typeName = getType(v.typeId)?.name ?? '—';

          return (
            <div key={v.id} className="rounded-lg border border-[#DDE2E8] bg-white p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid gap-2.5 min-[380px]:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                        MODEL NAME
                      </label>
                      <input
                        type="text"
                        aria-label={`Edit name for ${v.name}`}
                        value={editVehName}
                        onChange={(e) => setEditVehName(e.target.value)}
                        className="min-h-[40px] w-full rounded border border-[#0A1A33] bg-white px-2.5 py-1.5 text-sm text-[#0A1A33]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                        FLEET CODE
                      </label>
                      <input
                        type="text"
                        aria-label={`Edit fleet code for ${v.name}`}
                        value={editVehCode}
                        onChange={(e) => setEditVehCode(e.target.value)}
                        className="tabular-nums min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-sm text-[#0A1A33]"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2.5 min-[380px]:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                        VEHICLE TYPE
                      </label>
                      <select
                        aria-label={`Edit vehicle type for ${v.name}`}
                        value={editTypeId}
                        onChange={(e) => handleEditTypeChange(e.target.value)}
                        className="min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-sm text-[#0A1A33]"
                      >
                        {vehicleTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.12em] text-[#515F73]">
                        STATION
                      </label>
                      <select
                        aria-label={`Edit station for ${v.name}`}
                        value={editStationId}
                        onChange={(e) => setEditStationId(e.target.value)}
                        className="min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-sm text-[#0A1A33]"
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
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.1em] text-[#515F73]">
                        MKD / HR
                      </label>
                      <input
                        type="number"
                        min={50}
                        step={10}
                        value={editRate}
                        onChange={(e) =>
                          handleEditRateChange(editTypeId || v.typeId, Number(e.target.value))
                        }
                        className="tabular-nums min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2 py-1.5 text-sm text-[#0A1A33]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.1em] text-[#515F73]">
                        DAY CAP
                      </label>
                      <input
                        type="number"
                        min={50}
                        step={10}
                        value={editDayRate}
                        onChange={(e) => setEditDayRate(Number(e.target.value))}
                        className="tabular-nums min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2 py-1.5 text-sm text-[#0A1A33]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium tracking-[0.1em] text-[#515F73]">
                        BATTERY %
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editBattery}
                        onChange={(e) => setEditBattery(Number(e.target.value))}
                        className="tabular-nums min-h-[40px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2 py-1.5 text-sm text-[#0A1A33]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void saveEditVehicle(v)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded bg-[#0A1A33] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setEditingVehicleId(null)}
                      className="min-h-[38px] flex-1 rounded border border-[#DDE2E8] bg-white px-3 py-1.5 text-xs font-medium text-[#515F73]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[#0A1A33]">{v.name}</p>
                      <p className="tabular-nums text-xs text-[#515F73]">
                        {v.code} · {typeName}
                      </p>
                    </div>
                    {v.inMaintenance ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[#FECACA] bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-[#991B1B]">
                        <Wrench className="h-3 w-3" />
                        In Service
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#065F46]">
                        <CheckCircle2 className="h-3 w-3" />
                        In Catalog
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#515F73]">
                    <span>{getStationName(v.stationId)}</span>
                    <span className="tabular-nums font-medium text-[#0A1A33]">
                      {formatMkd(v.hourlyRateMkd)}/hr · Cap {formatMkd(v.fullDayRateMkd)} ·{' '}
                      {v.batteryPercent}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-[#DDE2E8] pt-3">
                    <button
                      type="button"
                      onClick={() => startEditVehicle(v)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0A1A33]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => void handleToggleService(v.id)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-45"
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
                      className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded border border-[#DDE2E8] p-2 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table (xl+) */}
      <div className="hidden overflow-x-auto rounded-lg border border-[#DDE2E8] bg-white xl:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#DDE2E8] bg-[#F6F7F9] text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
            <tr>
              <th className="px-4 py-3">VEHICLE</th>
              <th className="px-4 py-3">TYPE</th>
              <th className="px-4 py-3">STATION</th>
              <th className="px-4 py-3">TARIFF &amp; BATTERY</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE2E8]">
            {vehicles.map((v) => {
              const isEditing = editingVehicleId === v.id;
              const isSaving = savingId === v.id;
              const isToggling = togglingId === v.id;
              return (
                <tr key={v.id} className="hover:bg-[#F6F7F9]/60">
                  <td className="px-4 py-3.5">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          aria-label={`Edit name for ${v.name}`}
                          value={editVehName}
                          onChange={(e) => setEditVehName(e.target.value)}
                          className="w-full rounded border border-[#0A1A33] bg-white px-2 py-1 text-xs font-medium text-[#0A1A33]"
                        />
                        <input
                          type="text"
                          aria-label={`Edit fleet code for ${v.name}`}
                          value={editVehCode}
                          onChange={(e) => setEditVehCode(e.target.value)}
                          className="tabular-nums w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2 py-1 text-[11px] text-[#0A1A33]"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-[#0A1A33]">{v.name}</p>
                        <p className="tabular-nums text-xs text-[#515F73]">{v.code}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#515F73]">
                    {isEditing ? (
                      <select
                        aria-label={`Edit vehicle type for ${v.name}`}
                        value={editTypeId}
                        onChange={(e) => handleEditTypeChange(e.target.value)}
                        className="rounded border border-[#0A1A33] bg-white px-2 py-1 text-xs text-[#0A1A33]"
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
                  <td className="px-4 py-3.5 text-xs text-[#515F73]">
                    {isEditing ? (
                      <select
                        aria-label={`Edit station for ${v.name}`}
                        value={editStationId}
                        onChange={(e) => setEditStationId(e.target.value)}
                        className="rounded border border-[#0A1A33] bg-white px-2 py-1 text-xs text-[#0A1A33]"
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
                  <td className="tabular-nums px-4 py-3.5 text-xs font-medium text-[#0A1A33]">
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
                          className="w-20 rounded border border-[#0A1A33] px-2 py-1 text-xs"
                        />
                        <span className="text-[11px] text-[#515F73]">/hr</span>
                        <input
                          type="number"
                          aria-label={`Edit full-day rate cap for ${v.name}`}
                          min={50}
                          step={10}
                          value={editDayRate}
                          onChange={(e) => setEditDayRate(Number(e.target.value))}
                          className="w-20 rounded border border-[#0A1A33] px-2 py-1 text-xs"
                        />
                        <span className="text-[11px] text-[#515F73]">/d</span>
                        <input
                          type="number"
                          aria-label={`Edit battery percentage for ${v.name}`}
                          min={0}
                          max={100}
                          value={editBattery}
                          onChange={(e) => setEditBattery(Number(e.target.value))}
                          className="w-16 rounded border border-[#0A1A33] px-2 py-1 text-xs"
                        />
                        <span className="text-[11px] text-[#515F73]">%</span>
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
                      <span className="inline-flex items-center gap-1 rounded border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-medium text-[#991B1B]">
                        <Wrench className="h-3 w-3" />
                        In Service
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-medium text-[#065F46]">
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
                            className="inline-flex items-center gap-1 rounded bg-[#0A1A33] px-2.5 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
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
                            className="rounded border border-[#DDE2E8] bg-white px-2 py-1.5 text-[11px] text-[#515F73] hover:text-[#0A1A33]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Edit ${v.name}`}
                          onClick={() => startEditVehicle(v)}
                          className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => void handleToggleService(v.id)}
                        className="inline-flex items-center gap-1 rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#0A1A33] hover:border-[#0A1A33] disabled:opacity-45"
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
                        className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
