import type { ReactNode } from "react";
import { useBusiness } from "../context/BusinessContext";
import type { BusinessFeatures } from "../types";

interface FeatureSectionProps {
  feature: keyof BusinessFeatures;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Componente que renderiza sus hijos solo si el feature está habilitado.
 * Útil para ocultar secciones completas del UI basándose en features.
 */
export default function FeatureSection({
  feature,
  children,
  fallback = null,
}: FeatureSectionProps) {
  const { features, loading, hydrating } = useBusiness();

  // Mientras se carga, no mostrar nada
  if (loading || hydrating) {
    return null;
  }

  // Verificar si el feature está habilitado (default: true)
  const isEnabled = features[feature] !== false;

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook para verificar si un feature está habilitado
 */
export function useFeature(feature: keyof BusinessFeatures): boolean {
  const { features, loading, hydrating } = useBusiness();

  if (loading || hydrating) {
    return false;
  }

  return features[feature] !== false;
}

/**
 * Hook para verificar múltiples features
 */
export function useFeatures(
  featureList: (keyof BusinessFeatures)[]
): Record<keyof BusinessFeatures, boolean> {
  const { features, loading, hydrating } = useBusiness();

  const result = {} as Record<keyof BusinessFeatures, boolean>;

  for (const feature of featureList) {
    result[feature] = !loading && !hydrating && features[feature] !== false;
  }

  return result;
}
