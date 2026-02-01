import { useEffect, useState } from "react";
import api from "../api/axios";
import { authService } from "../features/auth/services";
import type { Membership, User } from "../types";

interface SessionState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useSession() {
  // Inicializar loading: true si hay token, para esperar sincronización con servidor
  const hasToken = !!localStorage.getItem("token");
  const [state, setState] = useState<SessionState>({
    user: authService.getCurrentUser(),
    loading: hasToken, // Esperar sincronización si hay token
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const syncFromStorage = () => {
      if (!mounted) return;
      const current = authService.getCurrentUser();
      setState(prev => ({ ...prev, user: current }));
    };

    const loadProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setState({ user: null, loading: false, error: null });
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const profile = await authService.getProfile();
        if (!mounted) return;
        setState(() => {
          const merged = { ...profile } as User;
          localStorage.setItem("user", JSON.stringify(merged));
          return { user: merged, loading: false, error: null };
        });

        // Si es god o distribuidor y no hay businessId, intenta fijar el único negocio asignado
        const hasBusiness = !!localStorage.getItem("businessId");
        if (
          (profile.role === "god" || profile.role === "distribuidor") &&
          !hasBusiness
        ) {
          try {
            const { data } = await api.get<{ memberships: Membership[] }>(
              "/business/me/memberships"
            );
            const memberships = data?.memberships || [];
            if (memberships.length === 1 && memberships[0]?.business?._id) {
              localStorage.setItem("businessId", memberships[0].business._id);
            }
          } catch (err) {
            console.warn(
              "No se pudo fijar businessId para usuario en session",
              err
            );
          }
        }
      } catch (error) {
        console.error("useSession profile error", error);

        const status = (error as { response?: { status?: number; data?: any } })
          ?.response?.status;
        const code = (error as { response?: { status?: number; data?: any } })
          ?.response?.data?.code;

        // Si el token expiró o no tiene permisos, limpia sesión
        if (status === 401 || (status === 403 && code !== "owner_inactive")) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("businessId");
        }

        if (!mounted) return;
        setState(prev => ({
          ...prev,
          loading: false,
          error: "No se pudo cargar perfil",
        }));
      }
    };

    // Handler para session-refresh: recarga completamente el perfil
    const handleSessionRefresh = async () => {
      console.log("[useSession] Session refresh triggered");
      await loadProfile();
    };

    // Sync on auth change (login/logout) and storage events (other tabs)
    window.addEventListener("auth-changed", syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("session-refresh", handleSessionRefresh);

    // Carga inicial
    loadProfile();

    return () => {
      mounted = false;
      window.removeEventListener("auth-changed", syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("session-refresh", handleSessionRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
