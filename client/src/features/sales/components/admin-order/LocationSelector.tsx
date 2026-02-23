/**
 * Location Selector Component
 * Allows selecting between Warehouse (Bodega) and Branches (Sedes)
 */

import { Building2, Warehouse as WarehouseIcon } from "lucide-react";
import type { Branch } from "../../../business/types/business.types";
import type { LocationType } from "../../types/admin-order.types";

interface LocationSelectorProps {
  locationType: LocationType;
  locationId: string | null;
  branches: Branch[];
  isDistributor?: boolean;
  loading?: boolean;
  onLocationChange: (type: LocationType, id: string, name: string) => void;
}

export function LocationSelector({
  locationType,
  locationId,
  branches,
  isDistributor = false,
  loading,
  onLocationChange,
}: LocationSelectorProps) {
  const activeAllowedBranches = branches.filter(b => b.active !== false);
  const activeBranches = activeAllowedBranches.filter(
    b => b.isWarehouse !== true
  );
  const hasWarehouseAccess = activeAllowedBranches.some(
    b => b.isWarehouse === true
  );
  const hasBranchAccess = activeBranches.length > 0;
  const showWarehouseButton = !isDistributor || hasWarehouseAccess;
  const showBranchSelector = !isDistributor || hasBranchAccess;
  const getBranchLabel = (branch: Branch) => `Sede: ${branch.name}`;
  const selectedBranch = branches.find(b => b._id === locationId) || null;
  const selectedLabel =
    selectedBranch && !selectedBranch.isWarehouse
      ? getBranchLabel(selectedBranch)
      : "Sin seleccionar";

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-400">
        📍 Ubicación de Stock
      </h3>

      <div className="flex gap-2">
        {/* DISTRIBUTOR: My Inventory Button */}
        <button
          type="button"
          onClick={() =>
            onLocationChange("distributor", "distributor", "Mi Inventario")
          }
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition ${
            locationType === "distributor"
              ? "border-blue-500 bg-blue-500/20 text-blue-300"
              : "border-gray-600 bg-gray-800/50 text-gray-400 hover:border-gray-500 hover:text-gray-300"
          }`}
        >
          <WarehouseIcon className="h-5 w-5" />
          Mi Inventario
        </button>

        {showWarehouseButton && (
          <button
            type="button"
            onClick={() => {
              onLocationChange("warehouse", "warehouse", "Bodega Central");
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition ${
              locationType === "warehouse"
                ? "border-purple-500 bg-purple-500/20 text-purple-300"
                : "border-gray-600 bg-gray-800/50 text-gray-400 hover:border-gray-500 hover:text-gray-300"
            }`}
          >
            <Building2 className="h-5 w-5" />
            Bodega Central
          </button>
        )}

        {/* Branch Selector */}
        {showBranchSelector && (
          <div className="flex-1">
            <select
              value={locationType === "branch" ? locationId || "" : ""}
              onChange={e => {
                const branch = activeBranches.find(
                  b => b._id === e.target.value
                );
                if (!branch) return;
                onLocationChange("branch", branch._id, branch.name);
              }}
              disabled={loading}
              className={`w-full rounded-lg border px-4 py-3 font-medium transition ${
                locationType === "branch"
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-gray-600 bg-gray-800/50 text-gray-400"
              }`}
            >
              <option value="">Seleccionar Sede...</option>
              {activeBranches.map(branch => (
                <option key={branch._id} value={branch._id}>
                  {getBranchLabel(branch)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isDistributor && !hasBranchAccess && !hasWarehouseAccess && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          No tienes sedes autorizadas. Solo puedes vender desde Mi Inventario.
        </div>
      )}

      {/* Location Indicator */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <div
          className={`h-2 w-2 rounded-full ${
            locationType === "distributor"
              ? "bg-blue-500"
              : locationType === "warehouse"
                ? "bg-purple-500"
                : "bg-cyan-500"
          }`}
        />
        <span className="text-gray-400">
          Stock desde:{" "}
          <span className="font-medium text-white">
            {locationType === "warehouse"
              ? "Bodega Central"
              : locationType === "distributor"
                ? "Mi Inventario Personal"
                : selectedLabel}
          </span>
        </span>
      </div>
    </div>
  );
}
