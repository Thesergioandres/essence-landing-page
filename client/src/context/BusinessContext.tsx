import { createContext, useContext } from "react";
import type {
  Business,
  BusinessFeatures,
  Membership,
} from "../features/business/types/business.types";

export type AssistantPlanMap = Record<string, boolean>;
export type { BusinessFeatures }; // Re-export for convenience if needed

export interface BusinessContextValue {
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

export const BusinessContext = createContext<BusinessContextValue | undefined>(
  undefined
);

export const useBusiness = () => {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error("useBusiness debe usarse dentro de BusinessProvider");
  }
  return ctx;
};
