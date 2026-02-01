import type { FormEvent } from "react";
import { useState } from "react";
import { Input } from "../../../shared/components/ui/Input";
import type { LoginCredentials } from "../types/auth.types";

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void;
  isLoading: boolean;
}

export const LoginForm = ({ onSubmit, isLoading }: LoginFormProps) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <Input
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={e => setFormData({ ...formData, email: e.target.value })}
        required
        autoComplete="email"
        placeholder="tu@email.com"
      />

      <Input
        label="Contraseña"
        type="password"
        name="password"
        value={formData.password}
        onChange={e => setFormData({ ...formData, password: e.target.value })}
        required
        autoComplete="current-password"
        placeholder="••••••••"
      />

      <button
        type="submit"
        disabled={isLoading}
        className="bg-linear-to-r w-full transform rounded-lg from-purple-600 to-pink-600 py-3 font-bold text-white transition hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#070910] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Ingresando..." : "Iniciar sesión"}
      </button>
    </form>
  );
};
