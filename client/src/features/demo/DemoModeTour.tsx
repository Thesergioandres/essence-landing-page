import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const DEMO_MODE_KEY = "demo-mode";

export default function DemoModeTour() {
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const steps = useMemo(
    () => [
      {
        target: "#demo-dashboard",
        title: "Ahorra tiempo",
        content:
          "Tu panel principal muestra ventas y decisiones clave en segundos.",
      },
      {
        target: "#demo-global-inventory",
        title: "Evita ventas perdidas",
        content:
          "Inventario global en vivo para reponer antes de quedarte sin stock.",
      },
      {
        target: "#demo-business-assistant",
        title: "Vende con estrategia",
        content:
          "Business Assistant sugiere acciones para crecer sin adivinar.",
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(location.search);
    const shouldStart = params.get("demo") === "1";

    if (shouldStart) {
      localStorage.setItem(DEMO_MODE_KEY, "1");
      setRun(true);
      return;
    }

    localStorage.removeItem(DEMO_MODE_KEY);
    setRun(false);
  }, [location.search]);

  const step = steps[stepIndex];

  const updateRect = useCallback(() => {
    if (!run || !step) return;
    const target = document.querySelector(step.target) as HTMLElement | null;
    if (!target) {
      setRect(null);
      return;
    }
    setRect(target.getBoundingClientRect());
  }, [run, step]);

  const finishTour = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DEMO_MODE_KEY);
    }
    setRun(false);
  }, []);

  const goToNextAvailable = useCallback(
    (direction: 1 | -1) => {
      let nextIndex = stepIndex + direction;
      while (nextIndex >= 0 && nextIndex < steps.length) {
        const target = document.querySelector(steps[nextIndex].target);
        if (target) {
          setStepIndex(nextIndex);
          return;
        }
        nextIndex += direction;
      }
      finishTour();
    },
    [finishTour, stepIndex, steps]
  );

  useEffect(() => {
    if (!run) return;
    const firstIndex = steps.findIndex(stepItem =>
      document.querySelector(stepItem.target)
    );
    if (firstIndex >= 0) {
      setStepIndex(firstIndex);
    } else {
      finishTour();
    }
  }, [finishTour, run, steps]);

  useEffect(() => {
    if (!run) return;
    updateRect();
    const handleScroll = () => updateRect();
    const handleResize = () => updateRect();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [run, updateRect]);

  useEffect(() => {
    if (!run) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finishTour();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finishTour, run]);

  if (!run || !step) return null;

  const padding = 10;
  const highlightStyle = rect
    ? {
        top: Math.max(rect.top - padding, 8),
        left: Math.max(rect.left - padding, 8),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  const tooltipTop = rect
    ? rect.bottom + 16 + 220 > window.innerHeight
      ? Math.max(rect.top - 200, 20)
      : rect.bottom + 16
    : 80;
  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left, 20), window.innerWidth - 340)
    : 20;

  return (
    <div className="z-10000 fixed inset-0">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => finishTour()}
      />
      {highlightStyle && (
        <div
          className="absolute rounded-2xl border border-fuchsia-400/60 shadow-[0_0_0_3px_rgba(217,70,239,0.35)]"
          style={highlightStyle}
        />
      )}
      <div
        className="absolute max-w-[320px] rounded-2xl border border-white/10 bg-[#0b0f19] p-4 text-slate-200 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">
          Paso {stepIndex + 1} de {steps.length}
        </p>
        <h4 className="mt-2 text-lg font-semibold text-white">{step.title}</h4>
        <p className="mt-2 text-sm text-slate-300">{step.content}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => finishTour()}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            Omitir
          </button>
          <button
            type="button"
            onClick={() => goToNextAvailable(-1)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200"
            disabled={stepIndex === 0}
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => goToNextAvailable(1)}
            className="rounded-full bg-fuchsia-500 px-3 py-1 text-xs font-semibold text-white"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
