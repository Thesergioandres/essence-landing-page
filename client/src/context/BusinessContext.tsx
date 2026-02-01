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
import type { Business, BusinessFeatures, Membership } from "../types";

interface BusinessContextValue {
  businessId: string | null;
  business: Business | null;
  features: BusinessFeatures;
  memberships: Membership[];
  hydrating: boolean;
  loading: boolean;
  error: string | null;
  selectBusiness: (id: string | null) => void;
  refresh: () => Promise<void>;
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
  distributors: true,
  rankings: true,
  branches: true,
  credits: true,
  customers: true,
  defectiveProducts: true,
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
      return user.memberships || [];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businessId, setBusinessId] = useState<string | null>(
    localStorage.getItem("businessId")
  );
  // 🔑 FIX: Initialize memberships from localStorage to prevent redirect flash
  const [memberships, setMemberships] = useState<Membership[]>(
    getInitialMemberships
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const tokenRef = useRef<string | null>(localStorage.getItem("token"));
  const isFetchingRef = useRef(false); // Guard against concurrent refresh calls
  const retryRef = useRef(0); // Guard for auto-retry

  const syncBusinessId = (id: string | null) => {
    setBusinessId(id);
    if (id) {
      localStorage.setItem("businessId", id);
    } else {
      localStorage.removeItem("businessId");
    }
  };

  const refresh = useCallback(async () => {
    // Debounce: Skip if already fetching
    if (isFetchingRef.current) {
      console.log("[BusinessContext] Refresh skipped - already fetching");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMemberships([]);
      syncBusinessId(null);
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { memberships: fetched } = await businessService.getMyMemberships();
      console.log(
        "[BusinessContext] Fetched memberships:",
        fetched?.length,
        fetched
      );
      console.log(
        "[BusinessContext] Fetched memberships:",
        fetched?.length,
        fetched
      );
      setMemberships(fetched || []);

      // Safe Retry Logic: Si devuelve vacío y no hemos reintentado, prueba una vez más
      if ((!fetched || fetched.length === 0) && retryRef.current < 1) {
        console.log("[BusinessContext] Empty list, retrying once...");
        retryRef.current += 1;
        isFetchingRef.current = false; // Liberar lock para el reintento
        setTimeout(() => refresh(), 800);
        return;
      }

      // Si éxito, limpiar reintentos
      if (fetched && fetched.length > 0) {
        retryRef.current = 0;
      }

      const stored = localStorage.getItem("businessId");
      const hasStored = stored && fetched.some(m => m.business?._id === stored);
      const onlyOne =
        fetched.length === 1 ? (fetched[0].business?._id ?? null) : null;
      const nextId = hasStored ? stored : onlyOne;

      syncBusinessId(nextId);
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: any } })
        ?.response?.status;
      const code = (err as { response?: { status?: number; data?: any } })
        ?.response?.data?.code;

      // Si el token quedó viejo/ilegal y el backend responde 401/403, limpia sesión para evitar loops en público
      if (status === 401 || (status === 403 && code !== "owner_inactive")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        syncBusinessId(null);
        setMemberships([]);
      }

      console.error("Error fetching memberships", err);
      setError("No se pudieron cargar tus negocios");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await refresh();
      setInitializing(false);
    };
    void run();
  }, [refresh]);

  // Escuchar evento session-refresh para actualizar cuando cambie el usuario/rol
  useEffect(() => {
    const handleSessionRefresh = async () => {
      console.log("[BusinessContext] Session refresh triggered");
      tokenRef.current = localStorage.getItem("token");
      setInitializing(true);
      await refresh();
      setInitializing(false);
    };

    window.addEventListener("session-refresh", handleSessionRefresh);
    window.addEventListener("auth-changed", handleSessionRefresh);

    return () => {
      window.removeEventListener("session-refresh", handleSessionRefresh);
      window.removeEventListener("auth-changed", handleSessionRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    const currentToken = localStorage.getItem("token");
    if (currentToken !== tokenRef.current) {
      tokenRef.current = currentToken;
      void refresh();
    }
  }, [refresh]);

  const selectedMembership = useMemo(
    () => memberships.find(m => m.business?._id === businessId) ?? null,
    [memberships, businessId]
  );

  const features = useMemo<BusinessFeatures>(() => {
    return selectedMembership?.business?.config?.features || defaultFeatures;
  }, [selectedMembership]);

  const value: BusinessContextValue = {
    businessId: selectedMembership?.business?._id || null,
    business: selectedMembership?.business || null,
    features,
    memberships,
    hydrating: initializing,
    loading,
    error,
    selectBusiness: syncBusinessId,
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
