import { useMemo } from "react";
import { useBusiness } from "../context/BusinessContext";

const sanitizeIdString = (raw: string): string => {
  const trimmed = String(raw || "").trim();
  if (
    !trimmed ||
    trimmed === "[object Object]" ||
    trimmed === "undefined" ||
    trimmed === "null"
  ) {
    return "";
  }

  const objectIdMatch = trimmed.match(/[a-fA-F0-9]{24}/);
  if (objectIdMatch) {
    return objectIdMatch[0];
  }

  return trimmed;
};

const bytesToHexObjectId = (bytes: unknown): string => {
  if (!Array.isArray(bytes) || bytes.length !== 12) {
    return "";
  }

  const isValidByteArray = bytes.every(
    item => typeof item === "number" && item >= 0 && item <= 255
  );
  if (!isValidByteArray) {
    return "";
  }

  return bytes
    .map(item => item.toString(16).padStart(2, "0"))
    .join("")
    .toLowerCase();
};

const resolveEntityId = (value: unknown): string => {
  if (typeof value === "string") {
    return sanitizeIdString(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
    oid?: unknown;
    businessId?: unknown;
    business_id?: unknown;
    toHexString?: () => string;
    toString?: () => string;
    buffer?: unknown;
    data?: unknown;
  };

  const fromToHex =
    typeof candidate.toHexString === "function"
      ? sanitizeIdString(candidate.toHexString())
      : "";

  const nested =
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    resolveEntityId(candidate.oid) ||
    resolveEntityId(candidate.businessId) ||
    resolveEntityId(candidate.business_id);

  const fromBuffer =
    bytesToHexObjectId(candidate.buffer) || bytesToHexObjectId(candidate.data);

  if (fromToHex) {
    return fromToHex;
  }

  if (fromBuffer) {
    return fromBuffer;
  }

  if (nested) {
    return nested;
  }

  if (typeof candidate.toString === "function") {
    return sanitizeIdString(candidate.toString());
  }

  return "";
};

const resolveBusinessId = (membership: {
  business?: unknown;
  businessId?: unknown;
  business_id?: unknown;
}): string => {
  return (
    resolveEntityId(membership.business) ||
    resolveEntityId(membership.businessId) ||
    resolveEntityId(membership.business_id)
  );
};

const resolveBusinessName = (membership: { business?: unknown }): string => {
  if (typeof membership.business === "string") {
    return "Negocio";
  }

  if (!membership.business || typeof membership.business !== "object") {
    return "Sin nombre";
  }

  const business = membership.business as { name?: unknown };
  return typeof business.name === "string" && business.name.trim().length > 0
    ? business.name
    : "Sin nombre";
};

export default function BusinessSelector() {
  const { memberships, businessId, selectBusiness, loading, error, hydrating } =
    useBusiness();

  const businessOptions = useMemo(
    () =>
      memberships
        .map(membership => ({
          key: membership._id,
          value: resolveBusinessId(membership),
          label: resolveBusinessName(membership),
        }))
        .filter(option => option.value.length > 0),
    [memberships]
  );

  const hasBusinesses = businessOptions.length > 0;

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
          <option value="" disabled>
            Selecciona un negocio
          </option>
          {businessOptions.map(option => (
            <option key={option.key} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : loading || hydrating ? (
        <p className="text-[11px] text-amber-200/80">Cargando negocios...</p>
      ) : businessId ? (
        <p className="text-[11px] text-emerald-200/80">Negocio activo</p>
      ) : (
        <p className="text-[11px] text-amber-200/80">
          Actualizando negocios...
        </p>
      )}
    </div>
  );
}
