import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService } from "../features/auth/services";
import type { User } from "../features/auth/types/auth.types";
import { AuthContext, type AuthContextValue } from "./auth-context.ts";

const getStoredUser = (): User | null => {
  return (authService.getCurrentUser() as User | null) || null;
};

const clearLocalSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("businessId");
};

const shouldClearSession = (error: unknown) => {
  const status = (error as { response?: { status?: number; data?: any } })
    ?.response?.status;
  const code = (error as { response?: { status?: number; data?: any } })
    ?.response?.data?.code;

  if (status === 401) return true;
  if (status === 403 && code !== "owner_inactive" && code !== "SUBSCRIPTION_INACTIVE" && code !== "pending") {
    return true;
  }

  return false;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [loading, setLoading] = useState(
    authService.hasToken() || authService.hasRefreshToken()
  );
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    const hasToken = authService.hasToken();
    const hasRefreshToken = authService.hasRefreshToken();

    if (!hasToken && !hasRefreshToken) {
      setUser(null);
      setLoading(false);
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      if (!authService.hasToken() && authService.hasRefreshToken()) {
        const refreshed = await authService.refreshToken();
        if (!refreshed?.token) {
          setUser(null);
          setLoading(false);
          return null;
        }
      }

      let profile: User | null = null;

      try {
        profile = await authService.syncSession();
      } catch (syncError) {
        const canRetryWithRefresh =
          authService.hasRefreshToken() &&
          ((syncError as { response?: { status?: number } })?.response
            ?.status === 401 ||
            (syncError as { response?: { status?: number } })?.response
              ?.status === 403);

        if (!canRetryWithRefresh) {
          throw syncError;
        }

        const refreshed = await authService.refreshToken();
        if (!refreshed?.token) {
          throw syncError;
        }

        profile = await authService.syncSession();
      }

      if (!profile) {
        setUser(null);
        setLoading(false);
        setError(null);
        return null;
      }

      setUser(profile);
      setLoading(false);
      setError(null);
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(new Event("session-refresh"));
      return profile;
    } catch (err) {
      if (shouldClearSession(err)) {
        clearLocalSession();
        setUser(null);
      } else {
        setUser(getStoredUser());
      }

      setLoading(false);
      setError("No se pudo restaurar sesión");
      return getStoredUser();
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const syncAuthState = () => {
      const hasToken = authService.hasToken();
      const hasRefreshToken = authService.hasRefreshToken();

      if (!hasToken && !hasRefreshToken) {
        setUser(prev => (prev ? null : prev));
        setLoading(false);
        setError(null);
        return;
      }

      const storedUser = getStoredUser();
      setUser(storedUser);
    };

    window.addEventListener("auth-changed", syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener("auth-changed", syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user && authService.hasToken()),
      checkAuth,
    }),
    [checkAuth, error, loading, user]
  );

  const hasStoredSession =
    authService.hasToken() || authService.hasRefreshToken();

  return (
    <AuthContext.Provider value={value}>
      {loading && hasStoredSession ? (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-gray-200">
            Restaurando sesión...
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
