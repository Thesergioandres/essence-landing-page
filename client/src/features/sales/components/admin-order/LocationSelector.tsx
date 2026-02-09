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
  loading?: boolean;
  allowWarehouse?: boolean;
  onLocationChange: (type: LocationType, id: string, name: string) => void;
}

export function LocationSelector({
  locationType,
  locationId,
  branches,
  loading,
  allowWarehouse = true,
  onLocationChange,
}: LocationSelectorProps) {
  const activeBranches = branches.filter(
    b => b.active !== false && b.isWarehouse !== true
  );
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

        {/* WAREHOUSE Button (Only for Admin - or hidden for distributor?) 
            Actually Plan said Distributors sell from Allowed Warehouse.
            But "Bodega" usually means Main Warehouse.
            If distributor allowedBranches includes Main Warehouse, it appears in select?
            Let's keep "Bodega" button only for Admins for now to avoid confusion, 
            or if User is Distributor, show only if they have explicit access?
            
            Simpler: Hide "Bodega" button if current view is distributor context unless we pass a prop `isDistributor`.
            But we don't pass `isDistributor`. 
            However, we can infer: if locationType can be "distributor", the user is likely a distributor.
            
            Let's make "Bodega" button conditional or simply replace it with "Mi Inventario" when relevant.
            
            BETTER UX:
            Show TWO buttons: [Mi Inventario] [Bodega/Sede] ?
            
            Let's stick to the plan:
            1. Keep "Bodega" button but maybe disable/hide if distributor?
            2. The select dropdown shows allowed branches.
            
            Let's assume "Bodega Principal" is just another branch for the Distributor logic if they have access.
            For Admin, "Bodega" is special.
            
            Let's just RENDER the standard view but add "Mi Inventario" as a toggle option 
            and handle the logic based on what's selected.
        */}

        {/* Warehouse Button - Only show if NOT currently in distributor mode OR if used for admins */}
        {/* We need to differentiate. Let's add a visual separator or just stack them. */}

        {/* ...Wait, if I am admin I don't see "Mi Inventario" usually? 
            Admin CAN see distributor inventory if they select context, but here "Mi Inventario" implies "MY PERSONAL".
            Admin doesn't have personal inventory usually in this context.
            
            So:
            If locationType is 'distributor' OR 'branch' OR 'warehouse' we need to support switching.
        */}

        {allowWarehouse && (
          <button
            type="button"
            onClick={() => {
              // HYBRID MODEL: "Bodega Central" = warehouse stock for dropshipping
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
        <div className="flex-1">
          <select
            value={locationType === "branch" ? locationId || "" : ""}
            onChange={e => {
              const branch = activeBranches.find(b => b._id === e.target.value);
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
      </div>

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
