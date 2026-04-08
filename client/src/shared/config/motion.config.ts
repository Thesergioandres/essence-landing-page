import { useCallback, useEffect, useMemo, useState } from "react";

export type MotionMode = "suave" | "estandar" | "premium";

export interface MotionProfile {
  routeDuration: number;
  routeEnterY: number;
  routeExitY: number;
  routeEnterScale: number;
  routeExitScale: number;
  routeEnterBlur: number;
  routeExitBlur: number;
  viewDuration: number;
  viewEnterY: number;
  viewExitY: number;
  viewEnterScale: number;
  viewExitScale: number;
  viewEnterBlur: number;
  viewExitBlur: number;
}

export interface MotionModeOption {
  value: MotionMode;
  label: string;
  description: string;
}

const MOTION_MODE_STORAGE_KEY = "essence_motion_mode";
const MOTION_MODE_EVENT = "motion-mode-changed";
const DEFAULT_MOTION_MODE: MotionMode = "premium";

export const MOTION_MODE_OPTIONS: MotionModeOption[] = [
  {
    value: "suave",
    label: "Suave",
    description: "Transiciones ligeras, maximo enfoque en rapidez.",
  },
  {
    value: "estandar",
    label: "Estandar",
    description: "Balance entre dinamismo visual y velocidad.",
  },
  {
    value: "premium",
    label: "Premium",
    description: "Experiencia cinematica con mayor presencia visual.",
  },
];

export const MOTION_PROFILES: Record<MotionMode, MotionProfile> = {
  suave: {
    routeDuration: 0.24,
    routeEnterY: 8,
    routeExitY: 6,
    routeEnterScale: 0.998,
    routeExitScale: 0.999,
    routeEnterBlur: 2,
    routeExitBlur: 1,
    viewDuration: 0.22,
    viewEnterY: 10,
    viewExitY: 8,
    viewEnterScale: 0.998,
    viewExitScale: 0.999,
    viewEnterBlur: 2,
    viewExitBlur: 1,
  },
  estandar: {
    routeDuration: 0.32,
    routeEnterY: 12,
    routeExitY: 9,
    routeEnterScale: 0.996,
    routeExitScale: 0.998,
    routeEnterBlur: 4,
    routeExitBlur: 2,
    viewDuration: 0.3,
    viewEnterY: 16,
    viewExitY: 10,
    viewEnterScale: 0.996,
    viewExitScale: 0.998,
    viewEnterBlur: 4,
    viewExitBlur: 2,
  },
  premium: {
    routeDuration: 0.38,
    routeEnterY: 16,
    routeExitY: 10,
    routeEnterScale: 0.995,
    routeExitScale: 0.998,
    routeEnterBlur: 6,
    routeExitBlur: 4,
    viewDuration: 0.32,
    viewEnterY: 22,
    viewExitY: 12,
    viewEnterScale: 0.995,
    viewExitScale: 0.998,
    viewEnterBlur: 5,
    viewExitBlur: 3,
  },
};

const normalizeMotionMode = (value?: string | null): MotionMode => {
  if (value === "suave" || value === "estandar" || value === "premium") {
    return value;
  }
  return DEFAULT_MOTION_MODE;
};

const readStoredMotionMode = (): MotionMode => {
  if (typeof window === "undefined") {
    return DEFAULT_MOTION_MODE;
  }

  return normalizeMotionMode(localStorage.getItem(MOTION_MODE_STORAGE_KEY));
};

const applyMotionModeDataset = (mode: MotionMode) => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-motion-mode", mode);
};

export const setGlobalMotionMode = (mode: MotionMode) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedMode = normalizeMotionMode(mode);
  localStorage.setItem(MOTION_MODE_STORAGE_KEY, normalizedMode);
  applyMotionModeDataset(normalizedMode);
  window.dispatchEvent(
    new CustomEvent<MotionMode>(MOTION_MODE_EVENT, {
      detail: normalizedMode,
    })
  );
};

export const useMotionProfile = () => {
  const [mode, setMode] = useState<MotionMode>(() => readStoredMotionMode());

  useEffect(() => {
    applyMotionModeDataset(mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncMode = () => {
      setMode(readStoredMotionMode());
    };

    const onMotionModeChanged = (event: Event) => {
      const customEvent = event as CustomEvent<MotionMode>;
      setMode(normalizeMotionMode(customEvent.detail));
    };

    window.addEventListener("storage", syncMode);
    window.addEventListener(MOTION_MODE_EVENT, onMotionModeChanged);

    return () => {
      window.removeEventListener("storage", syncMode);
      window.removeEventListener(MOTION_MODE_EVENT, onMotionModeChanged);
    };
  }, []);

  const motionProfile = useMemo(() => MOTION_PROFILES[mode], [mode]);

  const updateMode = useCallback((nextMode: MotionMode) => {
    setGlobalMotionMode(nextMode);
  }, []);

  return {
    mode,
    motionProfile,
    setMotionMode: updateMode,
  };
};
