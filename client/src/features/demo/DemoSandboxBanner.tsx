import { AlertTriangle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../auth/services";
import { demoService } from "./services/demo.service";

const formatExpiry = (rawDate: string | null) => {
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function DemoSandboxBanner() {
  const navigate = useNavigate();
  const [tearingDown, setTearingDown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDemoSession = demoService.isDemoSession();
  const expiresAtLabel = useMemo(
    () => formatExpiry(demoService.getDemoExpiry()),
    []
  );

  if (!isDemoSession) {
    return null;
  }

  const handleTeardown = async () => {
    if (tearingDown) return;

    setTearingDown(true);
    setErrorMessage(null);

    try {
      await demoService.teardownSandbox();
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status !== 404 && status !== 410) {
        setErrorMessage(
          "No se pudo borrar el entorno demo. Intenta de nuevo en unos segundos."
        );
        setTearingDown(false);
        return;
      }
    }

    demoService.clearSandboxSession();
    authService.logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="sticky top-2 z-40 mb-4 rounded-2xl border border-amber-300/50 bg-amber-500/15 px-4 py-3 backdrop-blur-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-400/20 p-1.5 text-amber-200">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-100">
              MODO DEMO - Los datos no se guardaran
            </p>
            <p className="text-xs text-amber-200/90">
              Este entorno se elimina automaticamente en 2 horas.
              {expiresAtLabel ? ` Expira aprox. a las ${expiresAtLabel}.` : ""}
            </p>
            {errorMessage && (
              <p className="mt-1 text-xs text-red-200">{errorMessage}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleTeardown}
          disabled={tearingDown}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300/60 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Trash2 className="h-4 w-4" />
          {tearingDown ? "Borrando entorno..." : "Salir y Borrar Datos"}
        </button>
      </div>
    </div>
  );
}
