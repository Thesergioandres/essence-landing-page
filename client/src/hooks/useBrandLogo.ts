import { useEffect, useState } from "react";
import { useBusiness } from "../context/BusinessContext";

// Helper para resolver el logo: logo del negocio seleccionado -> logo custom almacenado -> logo por defecto del ERP
export function useBrandLogo() {
  const { business } = useBusiness();
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("brandLogoUrl") || undefined;
    setCustomLogo(stored || null);

    const handleUpdate = () => {
      const updated = localStorage.getItem("brandLogoUrl") || undefined;
      setCustomLogo(updated || null);
    };

    window.addEventListener("storage", handleUpdate);
    window.addEventListener("brand-logo-updated", handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("brand-logo-updated", handleUpdate);
    };
  }, []);

  // Prioridad: logo del negocio actual -> logo custom almacenado -> logo por defecto del sistema
  const businessLogo = business?.logoUrl?.trim() || null;
  const storedLogo = customLogo?.trim() || null;

  return businessLogo || storedLogo || "/erp-logo.png";
}
