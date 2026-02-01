import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../api/auth.service";
import type {
  LoginCredentials,
  RegisterCredentials,
} from "../types/auth.types";

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login(credentials);

      // 🔑 POLYFILL: Map memberships to legacy business field for backward compatibility
      const memberships = response.memberships || [];
      const primaryBusiness = memberships[0]?.business;
      const businessId = primaryBusiness?._id || response.business;

      // Save Session
      localStorage.setItem("token", response.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          _id: response._id,
          name: response.name,
          email: response.email,
          role: response.role,
          status: response.status,
          business: businessId, // Legacy compatibility
          memberships, // New V2 data
        })
      );

      if (businessId) {
        localStorage.setItem("businessId", businessId);
      }

      // 🔔 Notify BusinessContext that auth changed
      window.dispatchEvent(new Event("auth-changed"));

      // Redirect Logic
      if (response.role === "distribuidor") {
        navigate("/distributor/dashboard");
      } else if (["admin", "super_admin", "god"].includes(response.role)) {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }

      return response;
    } catch (err: any) {
      const message = err.response?.data?.message || "Error al iniciar sesión";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.register(credentials);

      // 🔑 POLYFILL: Map memberships to legacy business field
      const memberships = response.memberships || [];
      const primaryBusiness = memberships[0]?.business;
      const businessId = primaryBusiness?._id || response.business;

      localStorage.setItem("token", response.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...response,
          business: businessId,
          memberships,
        })
      );

      if (businessId) {
        localStorage.setItem("businessId", businessId);
      }

      navigate("/"); // Default redirect
      return response;
    } catch (err: any) {
      const message = err.response?.data?.message || "Error al registrarse";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    navigate("/login");
  };

  return {
    login,
    register,
    logout,
    isLoading,
    error,
  };
};
