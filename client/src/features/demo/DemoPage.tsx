import { gsap } from "gsap";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../auth/services";
import { demoService } from "./services/demo.service";

type DemoState = "building" | "error";

export default function DemoPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<DemoState>("building");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const pulseRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (headlineRef.current) {
        gsap.fromTo(
          headlineRef.current,
          { opacity: 0.55, y: 6 },
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "power2.out",
            repeat: -1,
            yoyo: true,
          }
        );
      }

      if (pulseRef.current) {
        gsap.fromTo(
          pulseRef.current,
          { scale: 0.9, opacity: 0.3 },
          {
            scale: 1.25,
            opacity: 0.05,
            duration: 1.8,
            ease: "power2.out",
            repeat: -1,
          }
        );
      }

      if (progressRef.current) {
        gsap.fromTo(
          progressRef.current,
          { width: "10%" },
          {
            width: "95%",
            duration: 2,
            ease: "power1.inOut",
            repeat: -1,
            yoyo: true,
          }
        );
      }
    });

    return () => {
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const buildSandbox = async () => {
      setState("building");
      setErrorMessage(null);

      try {
        if (demoService.isDemoSession() && localStorage.getItem("token")) {
          try {
            await demoService.teardownSandbox();
          } catch {
            // Ignorar si ya expiro o fue eliminado por TTL
          }
        }

        demoService.clearSandboxSession();

        const payload = await demoService.setupSandbox();

        if (cancelled) return;

        demoService.applySandboxSession(payload);
        const dashboard = authService.getDashboardRoute(payload.user?.role);
        navigate(`${dashboard}?demo=1`, { replace: true });
      } catch (error) {
        if (cancelled) return;

        const message =
          (error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          "No se pudo construir el entorno de pruebas. Intenta nuevamente.";

        setErrorMessage(message);
        setState("error");
      }
    };

    void buildSandbox();

    return () => {
      cancelled = true;
    };
  }, [navigate, retryCount]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a101c] px-6 py-16 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(251,113,133,0.2),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.15),transparent_40%)]" />

      <div
        ref={pulseRef}
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-center shadow-[0_20px_80px_-30px_rgba(8,145,178,0.45)] backdrop-blur-xl sm:p-10">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100">
          Sandbox Engine
        </div>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-500/10">
          <LoaderCircle className="h-8 w-8 animate-spin text-cyan-200" />
        </div>

        <h1
          ref={headlineRef}
          className="text-balance text-3xl font-black text-white sm:text-4xl"
        >
          Construyendo tu entorno de pruebas...
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
          Estamos creando un negocio temporal con usuarios, inventario,
          historico de ventas y analiticas reales para que pruebes todo el ERP
          en modo seguro.
        </p>

        <div className="mx-auto mt-8 w-full max-w-lg rounded-full border border-white/10 bg-black/35 p-1">
          <div
            ref={progressRef}
            className="bg-linear-to-r h-2.5 rounded-full from-cyan-300 via-sky-400 to-rose-300"
          />
        </div>

        {state === "error" && (
          <div className="mt-6 rounded-2xl border border-red-300/50 bg-red-500/10 p-4 text-left">
            <div className="flex items-start gap-2 text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setRetryCount(count => count + 1)}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300/60 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
