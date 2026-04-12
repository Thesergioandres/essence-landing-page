import { AnimatePresence, m as motion } from "framer-motion";
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
      setCurrentName(currentUser?.name || "Empleado");
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
      const originalToken = localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY);
      if (!originalToken) {
        throw new Error("No se encontró token original de admin");
      }

      localStorage.setItem("token", originalToken);
      localStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);

      try {
        const profile = await authService.getProfile();
        localStorage.setItem("user", JSON.stringify(profile));
      } catch {
        localStorage.removeItem("user");
      }

      window.dispatchEvent(new Event("auth-changed"));
      window.location.reload();
    } catch (error: any) {
      console.error("Error al volver a cuenta admin:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo restaurar la sesión de administrador"
      );
      setIsReverting(false);
    }
  };

  return (
    <AnimatePresence>
      {isImpersonating && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 360,
            damping: 28,
            mass: 0.55,
          }}
          className="z-100 fixed top-0 flex w-full items-center justify-between bg-orange-600/90 px-4 py-2 font-bold text-white"
        >
          <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-3">
            <p className="truncate text-xs sm:text-sm">
              ⚠️ MODO SOPORTE: Operando en la cuenta de {currentName}
            </p>
            <button
              onClick={handleRevert}
              disabled={isReverting}
              className="shrink-0 rounded border border-white/30 bg-black/15 px-3 py-1 text-xs font-bold text-white transition hover:bg-black/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isReverting ? "Restaurando..." : "Volver a Admin"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
