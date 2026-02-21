import { useEffect, useState } from "react";
import { authService } from "../features/auth/services";

const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [currentName, setCurrentName] = useState("");

  useEffect(() => {
    const syncState = () => {
      const hasOriginalToken = Boolean(
        localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY)
      );
      const currentUser = authService.getCurrentUser();
      setIsImpersonating(hasOriginalToken);
      setCurrentName(currentUser?.name || "Distribuidor");
    };

    syncState();
    window.addEventListener("auth-changed", syncState);
    window.addEventListener("storage", syncState);

    return () => {
      window.removeEventListener("auth-changed", syncState);
      window.removeEventListener("storage", syncState);
    };
  }, []);

  const handleRevert = async () => {
    if (isReverting) return;
    setIsReverting(true);
    try {
      await authService.revertImpersonation();
    } catch (error: any) {
      console.error("Error al volver a cuenta admin:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo restaurar la sesión de administrador"
      );
      setIsReverting(false);
    }
  };

  if (!isImpersonating) return null;

  return (
    <div className="z-70 fixed left-0 right-0 top-0 border-b border-orange-500/40 bg-orange-900/95 px-4 py-2 text-white backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
        <p className="truncate text-xs font-semibold sm:text-sm">
          ⚠️ MODO SOPORTE: Estás operando en la cuenta de {currentName}.
        </p>
        <button
          onClick={handleRevert}
          disabled={isReverting}
          className="shrink-0 rounded-md border border-orange-300/50 bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isReverting ? "Restaurando..." : "Volver a mi cuenta Admin"}
        </button>
      </div>
    </div>
  );
}
