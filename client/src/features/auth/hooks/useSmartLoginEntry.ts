import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../../hooks/useSession";
import { authService } from "../services";

export function useSmartLoginEntry() {
  const navigate = useNavigate();
  const { user, loading, checkAuth } = useSession();

  const enter = useCallback(async () => {
    if (loading) return;

    const currentUser = user || authService.getCurrentUser();

    if (currentUser && authService.hasToken()) {
      navigate(authService.getDashboardRoute(currentUser.role));
      return;
    }

    if (!authService.hasToken() && !authService.hasRefreshToken()) {
      navigate("/login");
      return;
    }

    const profile = await checkAuth();
    if (profile && authService.hasToken()) {
      navigate(authService.getDashboardRoute(profile.role));
      return;
    }

    navigate("/login");
  }, [checkAuth, loading, navigate, user]);

  return {
    enter,
    loading,
  };
}
