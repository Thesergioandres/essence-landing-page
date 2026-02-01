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

      // Save Session
      localStorage.setItem("token", response.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          _id: response._id,
          name: response.name,
          email: response.email,
          role: response.role,
          business: response.business,
        })
      );
      localStorage.setItem("businessId", response.business);

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
      // Auto Login logic could go here or redirect to login
      // For now, let's auto-login as per typical simplified flow
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response));
      localStorage.setItem("businessId", response.business);

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
