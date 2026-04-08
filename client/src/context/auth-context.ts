import { createContext } from "react";
import type { User } from "../features/auth/types/auth.types";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  checkAuth: () => Promise<User | null>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);
