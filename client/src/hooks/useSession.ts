import { useAuthContext } from "../context/useAuthContext";

export function useSession() {
  return useAuthContext();
}
