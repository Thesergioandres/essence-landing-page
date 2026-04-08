import { Lock, LockOpen } from "lucide-react";
import { gsap } from "gsap";
import { useRef } from "react";
import { cn } from "../../../utils/cn";

interface ConfidentialBadgeProps {
  className?: string;
  compact?: boolean;
  label?: string;
  onAttemptReveal?: () => void;
}

export default function ConfidentialBadge({
  className,
  compact = false,
  label = "Confidencial",
  onAttemptReveal,
}: ConfidentialBadgeProps) {
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const openLockRef = useRef<SVGSVGElement | null>(null);
  const closedLockRef = useRef<SVGSVGElement | null>(null);

  const handleAttemptReveal = () => {
    onAttemptReveal?.();

    if (!openLockRef.current || !closedLockRef.current || !containerRef.current) {
      return;
    }

    const timeline = gsap.timeline();

    timeline
      .set(openLockRef.current, { autoAlpha: 1, scale: 1 })
      .set(closedLockRef.current, { autoAlpha: 0, scale: 0.7, y: -3 })
      .fromTo(
        containerRef.current,
        { boxShadow: "0 0 0 rgba(148,163,184,0)" },
        {
          boxShadow:
            "0 0 0 1px rgba(226,232,240,0.45), 0 0 28px rgba(148,163,184,0.45)",
          duration: 0.2,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        },
        0
      )
      .to(openLockRef.current, {
        autoAlpha: 0,
        scale: 0.75,
        duration: 0.14,
        ease: "power2.in",
      })
      .to(
        closedLockRef.current,
        {
          autoAlpha: 1,
          scale: 1.08,
          y: 0,
          duration: 0.2,
          ease: "back.out(2.4)",
        },
        "<"
      )
      .to(closedLockRef.current, {
        scale: 1,
        duration: 0.14,
        ease: "power2.out",
      });
  };

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={handleAttemptReveal}
      className={cn(
        "group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-white/35 bg-[linear-gradient(120deg,#f8fafc_0%,#e2e8f0_26%,#94a3b8_52%,#cbd5e1_74%,#f8fafc_100%)] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_24px_rgba(51,65,85,0.35)]",
        compact ? "min-h-8 px-2.5 py-1 text-[11px]" : "min-h-9 px-3 py-1.5 text-xs",
        className
      )}
      aria-label="Información confidencial protegida"
      title="Contenido protegido: permiso view_costs requerido"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <LockOpen
          ref={openLockRef}
          className="absolute h-4 w-4 text-slate-800"
          aria-hidden="true"
        />
        <Lock
          ref={closedLockRef}
          className="absolute h-4 w-4 text-slate-900"
          aria-hidden="true"
        />
      </span>

      <span className="font-semibold tracking-wide">{label}</span>
      <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-bold uppercase blur-[1.7px]">
        null
      </span>
    </button>
  );
}
