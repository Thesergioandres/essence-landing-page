import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { businessService } from "../features/business/services";
import type {
  Business,
  BusinessFeatures,
  Membership,
} from "../features/business/types/business.types";
import { globalSettingsService } from "../features/common/services";
import { normalizeEmployeeRole } from "../shared/utils/roleAliases";

type PlanKey = "starter" | "pro" | "enterprise";
type AssistantPlanMap = Record<PlanKey, boolean>;
type RefreshBusinessOptions = {
  silent?: boolean;
};

interface BusinessContextValue {
  businessId: string | null;
  business: Business | null;
  features: BusinessFeatures;
  memberships: Membership[];
  hydrating: boolean;
  loading: boolean;
  error: string | null;
  selectBusiness: (id: string | null) => void;
  refresh: (options?: RefreshBusinessOptions) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | undefined>(
  undefined
);

const defaultFeatures: BusinessFeatures = {
  products: true,
  inventory: true,
  sales: true,
  gamification: true,
  incidents: true,
  expenses: true,
  assistant: false,
  reports: true,
  transfers: true,
  employees: true,
  rankings: true,
  branches: true,
  credits: true,
  customers: true,
  defectiveProducts: true,
};

const defaultAssistantByPlan: AssistantPlanMap = {
  starter: false,
  pro: false,
  enterprise: true,
};

const TRANSIENT_SERVER_STATUS = new Set([500, 502, 503, 504]);

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const BUSINESS_CONTEXT_DEBUG_PREFIX = "[Essence Debug] | BusinessContext |";

const logBusinessContextWarn = (action: string, details?: unknown) => {
  console.warn(`${BUSINESS_CONTEXT_DEBUG_PREFIX} ${action}`, details);
};

const logBusinessContextError = (action: string, details?: unknown) => {
  console.error(`${BUSINESS_CONTEXT_DEBUG_PREFIX} ${action}`, details);
};

const resolveEntityId = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") {
      return null;
    }

    return trimmed;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
    businessId?: unknown;
  };

  const resolvedByStructure =
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    resolveEntityId(candidate.businessId);

  if (resolvedByStructure) {
    return resolvedByStructure;
  }

  if (typeof (value as { toString?: unknown }).toString === "function") {
    const rawValue = (value as { toString: () => string }).toString();
    const stringified = typeof rawValue === "string" ? rawValue.trim() : "";

    if (
      stringified &&
      stringified !== "[object Object]" &&
      OBJECT_ID_REGEX.test(stringified)
    ) {
      return stringified;
    }
  }

  return null;
};

const normalizeMembership = (membership: Membership): Membership => {
  const businessId = resolveEntityId(membership.business);

  const normalizedBusiness =
    typeof membership.business === "string"
      ? {
          _id: businessId || membership.business,
          name: "Negocio",
        }
      : {
          ...membership.business,
          _id: businessId || membership.business?._id || "",
          name: membership.business?.name || "Negocio",
        };

  return {
    ...membership,
    role: normalizeEmployeeRole(membership.role),
    business: normalizedBusiness,
  };
};

const normalizeMemberships = (memberships: Membership[]): Membership[] =>
  memberships.map(normalizeMembership);

const getMembershipBusinessId = (membership: Membership): string =>
  resolveEntityId(membership.business) || "";

const hasSameMembershipSnapshot = (
  current: Membership[],
  next: Membership[]
) => {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((membership, index) => {
    const nextMembership = next[index];
    if (!nextMembership) return false;

    return (
      membership._id === nextMembership._id &&
      membership.status === nextMembership.status &&
      membership.role === nextMembership.role &&
      getMembershipBusinessId(membership) ===
        getMembershipBusinessId(nextMembership)
    );
  });
};

/**
 * Read memberships from localStorage user object (set by login)
 * This prevents the "amnesia" bug where memberships are empty until API responds
 */
function getInitialMemberships(): Membership[] {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return normalizeMemberships(user.memberships || []);
    }
  } catch (error) {
    logBusinessContextWarn(
      "No se pudieron hidratar membresias iniciales desde localStorage",
      error
    );
  }
  return [];
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businessId, setBusinessId] = useState<string | null>(
    localStorage.getItem("businessId")
  );
  // ðŸ”‘ FIX: Initialize memberships from localStorage to prevent redirect flash
  const [memberships, setMemberships] = useState<Membership[]>(
    getInitialMemberships
  );
  const membershipsRef = useRef<Membership[]>(memberships);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [assistantByPlan, setAssistantByPlan] = useState<AssistantPlanMap>(
    defaultAssistantByPlan
  );
  const tokenRef = useRef<string | null>(localStorage.getItem("token"));
  const isFetchingRef = useRef(false); // Guard against concurrent refresh calls
  const retryRef = useRef(0); // Guard for auto-retry

  const finalizeInitialization = useCallback(() => {
    setInitializing(prev => (prev ? false : prev));
  }, []);

  useEffect(() => {
    membershipsRef.current = memberships;
  }, [memberships]);

  const syncBusinessId = useCallback((id: string | null) => {
    setBusinessId(prev => (prev === id ? prev : id));
    if (id) {
      localStorage.setItem("businessId", id);
    } else {
      localStorage.removeItem("businessId");
    }
  }, []);

  const hydrateFromStoredSession = useCallback(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;

      const user = JSON.parse(userStr) as {
        memberships?: Membership[];
      };
      const storedMemberships = normalizeMemberships(user.memberships || []);

      if (storedMemberships.length === 0) return;

      setMemberships(prev =>
        hasSameMembershipSnapshot(prev, storedMemberships)
          ? prev
          : storedMemberships
      );

      const selectedBusinessId = resolveEntityId(
        localStorage.getItem("businessId")
      );
      const activeMemberships = storedMemberships.filter(
        membership => membership.status === "active"
      );
      const selectedStillValid =
        selectedBusinessId &&
        activeMemberships.some(
          membership =>
            getMembershipBusinessId(membership) === selectedBusinessId
        );

      if (selectedStillValid) {
        return;
      }

      const autoSelectedBusinessId =
        activeMemberships.length === 1
          ? getMembershipBusinessId(activeMemberships[0]) || null
          : null;

      if (autoSelectedBusinessId) {
        syncBusinessId(autoSelectedBusinessId);
      }
    } catch (error) {
      logBusinessContextWarn(
        "Fallo la hidratacion de sesion almacenada",
        error
      );
    }
  }, [syncBusinessId]);

  const refresh = useCallback(
    async (options: RefreshBusinessOptions = {}) => {
      const { silent = false } = options;

      // Debounce: Skip if already fetching
      if (isFetchingRef.current) {
        logBusinessContextWarn(
          "Refresh omitido porque ya existe una peticion en curso",
          { silent }
        );
        if (!silent) {
          finalizeInitialization();
        }
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        setMemberships(prev => (prev.length > 0 ? [] : prev));
        syncBusinessId(null);
        if (!silent) {
          finalizeInitialization();
        }
        return;
      }

      isFetchingRef.current = true;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const publicSettingsPromise = silent
          ? Promise.resolve(null)
          : globalSettingsService.getPublicSettings().catch(error => {
              logBusinessContextWarn(
                "Fallaron ajustes publicos durante refresh de negocio",
                error
              );
              return null;
            });

        const [{ memberships: fetched }, publicSettings] = await Promise.all([
          businessService.getMyMemberships(),
          publicSettingsPromise,
        ]);

        if (publicSettings?.plans) {
          setAssistantByPlan({
            starter:
              publicSettings.plans.starter?.features?.businessAssistant ??
              false,
            pro: publicSettings.plans.pro?.features?.businessAssistant ?? false,
            enterprise:
              publicSettings.plans.enterprise?.features?.businessAssistant ??
              true,
          });
        }

        console.warn("[Essence Debug]", 
          "[BusinessContext] Fetched memberships:",
          fetched?.length,
          fetched
        );

        const fetchedMemberships = normalizeMemberships(
          (fetched || []) as Membership[]
        );
        const effectiveMemberships =
          silent &&
          fetchedMemberships.length === 0 &&
          membershipsRef.current.length > 0
            ? membershipsRef.current
            : fetchedMemberships;

        setMemberships(prev =>
          hasSameMembershipSnapshot(prev, effectiveMemberships)
            ? prev
            : effectiveMemberships
        );

        // Safe Retry Logic: Si devuelve vacÃ­o y no hemos reintentado, prueba una vez mÃ¡s
        if ((!fetched || fetched.length === 0) && retryRef.current < 1) {
          logBusinessContextWarn(
            "Refresh devolvio membresias vacias; se reintentara una vez",
            { silent, fetchedLength: fetched?.length || 0 }
          );
          retryRef.current += 1;
          isFetchingRef.current = false; // Liberar lock para el reintento
          if (!silent) {
            finalizeInitialization();
          }
          setTimeout(() => {
            void refresh(options);
          }, 800);
          return;
        }

        // Si Ã©xito, limpiar reintentos
        if (fetched && fetched.length > 0) {
          retryRef.current = 0;
        }

        const stored = resolveEntityId(localStorage.getItem("businessId"));
        const activeMemberships = effectiveMemberships.filter(
          membership => membership.status === "active"
        );
        const hasStored =
          Boolean(stored) &&
          activeMemberships.some(
            membership => getMembershipBusinessId(membership) === stored
          );
        const onlyOneActive =
          activeMemberships.length === 1
            ? getMembershipBusinessId(activeMemberships[0]) || null
            : null;
        const onlyOneTotal =
          effectiveMemberships.length === 1
            ? getMembershipBusinessId(effectiveMemberships[0]) || null
            : null;
        const nextId =
          (hasStored ? stored : onlyOneActive || onlyOneTotal) || null;

        syncBusinessId(nextId);

        if (!silent) {
          finalizeInitialization();
        }
      } catch (err) {
        const status = (err as { response?: { status?: number; data?: any } })
          ?.response?.status;
        const code = (err as { response?: { status?: number; data?: any } })
          ?.response?.data?.code;
        const isTransientServerError =
          typeof status === "number" && TRANSIENT_SERVER_STATUS.has(status);
        const isSessionBootstrapError =
          status === 401 ||
          status === 403 ||
          status === 404 ||
          status === 429 ||
          isTransientServerError;

        // Si el token quedÃ³ viejo/ilegal y el backend responde 401, limpia sesiÃ³n
        // Para 403, solo limpiar si NO es "owner_inactive" ni "pending" (usuario reciÃ©n registrado)
        const isPendingUser = code === "pending";
        const isOwnerInactive = code === "owner_inactive";

        logBusinessContextError("Fallo el refresh de contexto de negocio", {
          status,
          code,
          silent,
          error: err,
        });

        if (isTransientServerError) {
          if (retryRef.current < 2) {
            retryRef.current += 1;
            logBusinessContextWarn(
              "Error transitorio del servidor en bootstrap; reintentando refresh",
              {
                status,
                retryAttempt: retryRef.current,
                hasCachedMemberships: membershipsRef.current.length > 0,
              }
            );

            isFetchingRef.current = false;
            if (!silent) {
              finalizeInitialization();
            }

            setTimeout(() => {
              void refresh(options);
            }, 1200);
            return;
          }

          const hasFallbackMemberships = membershipsRef.current.length > 0;
          if (!silent && !hasFallbackMemberships) {
            setError("El servidor esta iniciando. Intenta nuevamente.");
          }

          if (!silent) {
            finalizeInitialization();
          }

          return;
        }

        if (status === 401) {
          logBusinessContextWarn(
            "Token invalido en refresh; limpiando sesion local"
          );
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          syncBusinessId(null);
          setMemberships(prev => (prev.length > 0 ? [] : prev));
        } else if (status === 403 && !isOwnerInactive && !isPendingUser) {
          // 403 por otras razones (token invÃ¡lido, etc) - limpiar sesiÃ³n
          logBusinessContextWarn(
            "Refresh denegado (403) fuera de owner_inactive/pending; limpiando sesion",
            { code }
          );
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          syncBusinessId(null);
          setMemberships(prev => (prev.length > 0 ? [] : prev));
        }
        // Si es usuario pending (reciÃ©n registrado), NO limpiar token - solo marcar memberships vacÃ­as
        if (!silent && (isPendingUser || status === 403)) {
          logBusinessContextWarn(
            "Refresh sin membresias por estado pending/403; se mantiene sesion",
            { isPendingUser, status, code }
          );
          setMemberships(prev => (prev.length > 0 ? [] : prev));
        }

        if (!isSessionBootstrapError && !isPendingUser && !silent) {
          logBusinessContextError(
            "Error no esperado obteniendo membresias",
            err
          );
          setError("No se pudieron cargar tus negocios");
        }

        if (!silent) {
          finalizeInitialization();
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    },
    [finalizeInitialization, syncBusinessId]
  );

  const selectBusiness = useCallback(
    (id: string | null) => {
      const normalizedBusinessId = resolveEntityId(id);
      syncBusinessId(normalizedBusinessId);
      setError(null);

      // Background refresh to keep memberships/features fresh without bloquear UI.
      void refresh({ silent: true });
    },
    [refresh, syncBusinessId]
  );

  useEffect(() => {
    const run = async () => {
      await refresh();
    };
    void run();
  }, [refresh]);

  // Escuchar evento session-refresh para actualizar cuando cambie el usuario/rol
  useEffect(() => {
    const handleSessionRefresh = async () => {
      logBusinessContextWarn("Evento de refresco de sesion detectado", {
        source: "session-refresh/auth-changed",
      });
      tokenRef.current = localStorage.getItem("token");
      hydrateFromStoredSession();
      await refresh();
    };

    window.addEventListener("session-refresh", handleSessionRefresh);
    window.addEventListener("auth-changed", handleSessionRefresh);

    return () => {
      window.removeEventListener("session-refresh", handleSessionRefresh);
      window.removeEventListener("auth-changed", handleSessionRefresh);
    };
  }, [hydrateFromStoredSession, refresh]);

  useEffect(() => {
    const currentToken = localStorage.getItem("token");
    if (currentToken !== tokenRef.current) {
      tokenRef.current = currentToken;
      void refresh();
    }
  }, [refresh]);

  const selectedMembership = useMemo(
    () =>
      memberships.find(m => getMembershipBusinessId(m) === businessId) ?? null,
    [memberships, businessId]
  );

  const features = useMemo<BusinessFeatures>(() => {
    const selectedPlan = (selectedMembership?.business?.plan ||
      "starter") as PlanKey;
    const baseFeatures = selectedMembership?.business?.config?.features || {};

    return {
      ...defaultFeatures,
      ...baseFeatures,
      assistant: assistantByPlan[selectedPlan] === true,
    };
  }, [assistantByPlan, selectedMembership]);

  const value: BusinessContextValue = {
    businessId: selectedMembership
      ? getMembershipBusinessId(selectedMembership)
      : null,
    business:
      selectedMembership && typeof selectedMembership.business !== "string"
        ? selectedMembership.business
        : null,
    features,
    memberships,
    hydrating: initializing,
    loading,
    error,
    selectBusiness,
    refresh,
  };

  return (
    <BusinessContext.Provider value={value}>
      {initializing && tokenRef.current ? (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-200">
          Cargando negocio...
        </div>
      ) : (
        children
      )}
    </BusinessContext.Provider>
  );
}

export const useBusiness = () => {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error("useBusiness debe usarse dentro de BusinessProvider");
  }
  return ctx;
};

