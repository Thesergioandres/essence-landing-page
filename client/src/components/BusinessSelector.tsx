import { useMemo } from "react";
import { useBusiness } from "../context/BusinessContext";

export default function BusinessSelector() {
  const { memberships, businessId, selectBusiness, loading, error, hydrating } =
    useBusiness();

  const hasBusinesses = memberships.length > 0;

  const label = useMemo(() => {
    if (loading || hydrating) return "Cargando negocios...";
    if (error) return error;
    return "Negocio";
  }, [loading, hydrating, error]);

  // REMOVED: El BusinessContext ya maneja el refresh inicial.
  // El useEffect anterior que llamaba refresh() causaba un loop infinito.

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-white">{label}</span>
        {loading && <span className="text-[10px] text-gray-400">Cargando</span>}
      </div>
      {hasBusinesses ? (
        <select
          value={businessId ?? ""}
          onChange={e => selectBusiness(e.target.value || null)}
          className="w-full rounded-md border border-white/10 bg-gray-900/60 px-2 py-1 text-xs text-white focus:border-purple-400 focus:outline-none"
        >
          {memberships.map(membership => (
            <option key={membership._id} value={membership.business?._id}>
              {membership.business?.name || "Sin nombre"}
            </option>
          ))}
        </select>
      ) : loading || hydrating ? (
        <p className="text-[11px] text-amber-200/80">Cargando negocios...</p>
      ) : (
        <p className="text-[11px] text-amber-200/80">
          Actualizando negocios...
        </p>
      )}
    </div>
  );
}
