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
import { businessService } from "../api/services";
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

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businessId, setBusinessId] = useState<string | null>(
    localStorage.getItem("businessId")
  );
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const tokenRef = useRef<string | null>(localStorage.getItem("token"));

  const syncBusinessId = (id: string | null) => {
    setBusinessId(id);
    if (id) {
      localStorage.setItem("businessId", id);
    } else {
      localStorage.removeItem("businessId");
    }
  };

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMemberships([]);
      syncBusinessId(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { memberships: fetched } = await businessService.getMyMemberships();
      setMemberships(fetched);

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
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await refresh();
      setInitializing(false);
    };
    void run();
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
