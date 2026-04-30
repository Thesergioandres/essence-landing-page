import { m as motion } from "framer-motion";
import {
    ArrowUpRight,
    BarChart3,
    BookOpen,
    Building2,
    Check,
    Clock3,
    CreditCard,
    Megaphone,
    Package,
    ShieldCheck,
    ShoppingCart,
    Truck,
    Users,
    Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../../../components/Footer";
import Navbar from "../../../components/Navbar";
import { Button } from "../../../shared/components/ui";
import { globalSettingsService } from "../services";

type IconType = ComponentType<{ className?: string }>;

type PricingPlan = {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  limits: {
    branches: number;
    employees: number;
  };
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.07 },
  },
};

const heroSignals = [
  {
    label: "Ventas recuperadas",
    value: "+22%",
    detail: "Reactivacion medible durante el primer mes.",
    tone: "text-emerald-200",
  },
  {
    label: "Tiempo operativo",
    value: "-30%",
    detail: "Menos tareas manuales y menos reprocesos.",
    tone: "text-cyan-200",
  },
  {
    label: "Margen protegido",
    value: "+12%",
    detail: "Control de precios y costos en tiempo real.",
    tone: "text-amber-200",
  },
];

const trustMetrics = [
  {
    title: "Implementacion guiada",
    value: "7 dias",
    note: "Equipo listo para operar rapido",
    icon: Clock3,
  },
  {
    title: "Cobertura operativa",
    value: "360°",
    note: "Ventas, inventario, comisiones y reportes",
    icon: Building2,
  },
  {
    title: "Visibilidad comercial",
    value: "Tiempo real",
    note: "Decisiones con datos vivos",
    icon: BarChart3,
  },
  {
    title: "Escalabilidad",
    value: "Multi-sede",
    note: "Listo para crecer por etapas",
    icon: Users,
  },
];

const painPoints = [
  "Quiebres de stock inesperados que frenan ventas en hora pico.",
  "Comisiones y cobros con diferencias al cierre del mes.",
  "Promociones sin control de margen y sin seguimiento por canal.",
  "Equipos operando con versiones distintas de la informacion.",
];

const solutionOutcomes = [
  "Inventario unificado por bodega, sede y empleado.",
  "Precios y promociones alineados con rentabilidad real.",
  "Cobranza, cartera y comisiones bajo un mismo flujo.",
  "Tablero ejecutivo para actuar el mismo dia.",
];

const operatingPillars: Array<{
  title: string;
  description: string;
  icon: IconType;
  tag: string;
  highlights: string[];
}> = [
  {
    title: "Inventario Anticipativo",
    description:
      "Detecta faltantes antes de perder clientes y prioriza reposicion donde mas vende.",
    icon: Package,
    tag: "Inventario",
    highlights: [
      "Alertas de quiebre",
      "Rotacion por sede",
      "Reabastecimiento rapido",
    ],
  },
  {
    title: "Ventas Omnicanal",
    description:
      "Gestiona ventas de mostrador, empleados y promociones con una sola trazabilidad.",
    icon: ShoppingCart,
    tag: "Ventas",
    highlights: ["Precio por canal", "Carrito agil", "Control de descuentos"],
  },
  {
    title: "Catalogo Comercial",
    description:
      "Comparte catalogos listos para WhatsApp y acelera pedidos sin friccion.",
    icon: Megaphone,
    tag: "Comercial",
    highlights: [
      "Catalogo compartible",
      "PDF listo para cliente",
      "Identidad de marca",
    ],
  },
  {
    title: "Cobranza y Credito",
    description:
      "Mantiene visible el dinero por cobrar y evita cartera desordenada.",
    icon: CreditCard,
    tag: "Finanzas",
    highlights: [
      "Cartera pendiente",
      "Abonos registrados",
      "Seguimiento de vencimientos",
    ],
  },
  {
    title: "Logistica Confiable",
    description:
      "Despachos y recepciones con historial completo para evitar descuadres.",
    icon: Truck,
    tag: "Logistica",
    highlights: [
      "Solicitudes de despacho",
      "Confirmacion de recepcion",
      "Trazabilidad total",
    ],
  },
  {
    title: "Gobierno y Seguridad",
    description:
      "Protege datos sensibles y asegura que cada perfil vea solo lo que corresponde.",
    icon: ShieldCheck,
    tag: "Control",
    highlights: [
      "Privacidad financiera",
      "Permisos por rol",
      "Auditoria de acciones",
    ],
  },
];

const rolloutSteps: Array<{
  title: string;
  detail: string;
  icon: IconType;
}> = [
  {
    title: "Diagnostico operativo",
    detail:
      "Levantamos tu proceso actual para definir prioridades de impacto inmediato.",
    icon: BookOpen,
  },
  {
    title: "Configuracion guiada",
    detail:
      "Activamos modulos, perfiles y reglas comerciales para tu realidad diaria.",
    icon: Zap,
  },
  {
    title: "Escalamiento con datos",
    detail:
      "Con reportes vivos, ajustas decisiones cada semana y sostienes crecimiento.",
    icon: ArrowUpRight,
  },
];

const testimonials = [
  {
    name: "Ana Gomez",
    role: "Duena de tienda",
    quote:
      "Pasamos de reaccionar tarde a anticiparnos. El inventario ya no nos frena las ventas.",
    metric: "+18% ventas",
  },
  {
    name: "Luis Perez",
    role: "Empleado",
    quote:
      "El catalogo compartible nos ayudo a cerrar pedidos sin llamadas eternas.",
    metric: "-35% tiempo operativo",
  },
  {
    name: "Marcela Ruiz",
    role: "Gerente de operaciones",
    quote:
      "El cierre financiero es mas limpio. Hoy tenemos claridad para decidir rapido.",
    metric: "+12% margen",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [plans, setPlans] = useState<PricingPlan[]>([]);

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  useEffect(() => {
    globalSettingsService
      .getPublicSettings()
      .then(settings => {
        setMaintenanceMode(Boolean(settings.maintenanceMode));
        const planValues = Object.values(settings.plans ?? {}).filter(
          (p): p is NonNullable<typeof p> => p != null && typeof p === "object"
        );
        setPlans(planValues);
      })
      .catch(() => null);
  }, []);

  const pricingCards = useMemo<PricingPlan[]>(() => {
    if (plans.length > 0) return plans;

    return [
      {
        id: "starter",
        name: "Starter",
        description: "Para negocios en etapa inicial",
        monthlyPrice: 19,
        yearlyPrice: 190,
        currency: "USD",
        limits: { branches: 1, employees: 2 },
      },
      {
        id: "pro",
        name: "Pro",
        description: "Para equipos que escalan ventas",
        monthlyPrice: 49,
        yearlyPrice: 490,
        currency: "USD",
        limits: { branches: 3, employees: 10 },
      },
      {
        id: "enterprise",
        name: "Enterprise",
        description: "Para operaciones multi-sede avanzadas",
        monthlyPrice: 99,
        yearlyPrice: 990,
        currency: "USD",
        limits: { branches: 10, employees: 50 },
      },
    ];
  }, [plans]);

  const handleDemoClick = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("demo-mode", "1");
    }
    navigate("/demo?demo=1");
  };

  return (
    <div
      className="bg-app-base min-h-screen overflow-x-hidden text-slate-100"
      style={{
        fontFamily: "'Space Grotesk', 'Sora', 'Montserrat', sans-serif",
      }}
    >
      <Navbar />

      {maintenanceMode && (
        <div className="border-y border-amber-300/35 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-100">
          Estamos en mantenimiento programado. Puedes explorar precios y
          solicitar acceso, pero algunas funciones podrian verse limitadas de
          forma temporal.
        </div>
      )}

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-44 -top-20 h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-[120px]" />
          <div className="absolute -top-10 right-[-180px] h-[460px] w-[460px] rounded-full bg-amber-400/15 blur-[140px]" />
          <div className="absolute bottom-[-220px] left-1/3 h-[460px] w-[460px] rounded-full bg-emerald-500/15 blur-[140px]" />
          <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(8,11,20,0.96),rgba(11,17,30,0.9),rgba(7,12,19,0.96))]" />
          <div className="bg-size-[26px_26px] absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] opacity-35" />
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="relative mx-auto max-w-7xl px-3 py-14 sm:px-5 sm:py-16 md:px-8 md:py-20"
        >
          <div className="grid items-center gap-8 lg:grid-cols-[1.08fr,0.92fr]">
            <motion.div variants={fadeUp}>
              <span className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Plataforma comercial de alto rendimiento
              </span>

              <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Convierte operacion en
                <span className="bg-linear-to-r block from-cyan-200 via-emerald-200 to-amber-200 bg-clip-text text-transparent">
                  crecimiento predecible
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Essence unifica inventario, ventas, logistica y rentabilidad
                para que tomes decisiones comerciales todos los dias con
                seguridad.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDemoClick}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border-emerald-300/45 bg-emerald-400/10 px-7 text-sm font-semibold text-emerald-100 hover:border-emerald-200 hover:bg-emerald-400/20"
                >
                  Ver demo interactiva
                  <ArrowUpRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={scrollToPricing}
                  className="min-h-11 rounded-full border-white/25 px-7 text-sm font-semibold text-slate-100 hover:border-cyan-300"
                >
                  Ver precios
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap gap-2 text-xs">
                {[
                  "Activacion guiada",
                  "Control por sedes",
                  "Reportes ejecutivos",
                  "Escalable por plan",
                ].map(badge => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-200"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 230, damping: 24 }}
              className="relative rounded-3xl border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-5 shadow-[0_34px_90px_-55px_rgba(34,211,238,0.65)] backdrop-blur-sm sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                  Radar ejecutivo
                </p>
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                  En vivo
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {heroSignals.map(signal => (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-white/15 bg-black/25 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-200">{signal.label}</p>
                      <p className={`text-base font-semibold ${signal.tone}`}>
                        {signal.value}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {signal.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">
                    Ticket promedio
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">+9.4%</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">
                    Cumplimiento diario
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">94%</p>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            variants={staggerContainer}
            className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {trustMetrics.map(metric => {
              const Icon = metric.icon;
              return (
                <motion.div
                  key={metric.title}
                  variants={fadeUp}
                  className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 text-cyan-100">
                    <Icon className="h-4 w-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {metric.title}
                    </p>
                  </div>
                  <p className="mt-2 text-xl font-bold text-white">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{metric.note}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      <motion.section
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.24 }}
        className="mx-auto max-w-7xl px-3 py-12 sm:px-5 sm:py-14 md:px-8 md:py-16"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <motion.div
            variants={fadeUp}
            className="rounded-3xl border border-rose-300/25 bg-rose-500/10 p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-100">
              Lo que frena el crecimiento
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
              Operacion fragmentada, ventas inestables
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-slate-200">
              {painPoints.map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="rounded-3xl border border-emerald-300/25 bg-[linear-gradient(150deg,rgba(16,185,129,0.12),rgba(8,12,20,0.72))] p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
              Resultado con Essence
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
              Control diario para vender mejor
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-slate-100">
              {solutionOutcomes.map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-100">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => navigate("/register")}
                className="min-h-11 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Empezar ahora
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={scrollToPricing}
                className="min-h-11 rounded-full border-white/25 px-6 text-sm font-semibold text-slate-100 hover:border-emerald-200"
              >
                Comparar planes
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        id="modulos"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="mx-auto max-w-7xl px-3 py-12 sm:px-5 sm:py-14 md:px-8 md:py-16"
      >
        <motion.div
          variants={fadeUp}
          className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Motor de crecimiento
            </p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Modulos diseñados para resultados
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
              Cada modulo ataca una fuga real de dinero o tiempo en tu negocio.
            </p>
          </div>

          <span className="inline-flex min-h-10 items-center rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
            Activacion por etapas
          </span>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {operatingPillars.map(item => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 250, damping: 22 }}
                className="group rounded-3xl border border-white/10 bg-[linear-gradient(170deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/10 text-cyan-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-200">
                    {item.tag}
                  </span>
                </div>

                <h3 className="mt-4 text-xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {item.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.highlights.map(highlight => (
                    <span
                      key={highlight}
                      className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-slate-200"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </motion.section>

      <motion.section
        id="pricing"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.22 }}
        className="mx-auto max-w-7xl px-3 py-12 sm:px-5 sm:py-14 md:px-8 md:py-16"
      >
        <motion.div variants={fadeUp} className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
            Planes SaaS
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            Escala por etapas, sin pagar de mas
          </h2>
          <p className="mx-auto mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
            Elige un plan segun tu operacion actual y expande sedes o
            empleados cuando el negocio lo necesite.
          </p>

          <div className="mt-5 inline-flex rounded-full border border-white/15 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`min-h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                !isYearly
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`min-h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                isYearly
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              Anual
            </button>
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {pricingCards.map(plan => {
            const isPro = plan.id === "pro";
            const amount = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const cycle = isYearly ? "/año" : "/mes";
            const subLine = isYearly
              ? `${plan.currency} ${Math.round(plan.yearlyPrice / 12)} /mes equivalente`
              : `${plan.currency} ${plan.yearlyPrice} al año`;

            return (
              <motion.article
                key={plan.id}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
                className={`relative rounded-3xl border p-6 text-left ${
                  isPro
                    ? "border-cyan-300/45 bg-[linear-gradient(160deg,rgba(34,211,238,0.18),rgba(8,12,20,0.8))] shadow-[0_28px_80px_-55px_rgba(34,211,238,0.9)]"
                    : "border-white/15 bg-white/5"
                }`}
              >
                {isPro && (
                  <span className="absolute right-4 top-4 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                    Recomendado
                  </span>
                )}

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
                  {plan.name}
                </p>
                <p className="mt-3 text-4xl font-bold text-white">
                  {plan.currency} {amount}
                  <span className="text-sm font-medium text-slate-300">
                    {cycle}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400">{subLine}</p>
                <p className="mt-3 text-sm text-slate-200/95">
                  {plan.description}
                </p>

                <ul className="mt-5 space-y-2.5 text-sm text-slate-200">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>{plan.limits.branches} sedes incluidas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      {plan.limits.employees} empleados incluidos
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>Inventario, ventas y comisiones en tiempo real</span>
                  </li>
                </ul>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/register")}
                  className={`mt-6 min-h-11 w-full rounded-full text-sm font-semibold ${
                    isPro
                      ? "border-cyan-200/65 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                      : "border-white/25 bg-slate-900/75 text-slate-100 hover:bg-slate-800"
                  }`}
                >
                  Empezar con {plan.name}
                </Button>
              </motion.article>
            );
          })}
        </motion.div>
      </motion.section>

      <motion.section
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.22 }}
        className="bg-app-elevated border-y border-white/10 py-12 sm:py-14 md:py-16"
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-5 md:px-8">
          <motion.div variants={fadeUp} className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Implementacion
            </p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Arranque ordenado en tres etapas
            </h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            className="mt-8 grid gap-4 md:grid-cols-3"
          >
            {rolloutSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.article
                  key={step.title}
                  variants={fadeUp}
                  className="rounded-3xl border border-white/15 bg-white/5 p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                      Etapa {index + 1}
                    </span>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/10 text-cyan-100">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {step.detail}
                  </p>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="mx-auto max-w-7xl px-3 py-12 sm:px-5 sm:py-14 md:px-8 md:py-16"
      >
        <motion.div
          variants={fadeUp}
          className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Confianza real
            </p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Equipos que ya venden con mas control
            </h2>
          </div>
          <span className="inline-flex min-h-10 items-center rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
            Casos verificados
          </span>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {testimonials.map(item => (
            <motion.article
              key={item.name}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              className="rounded-3xl border border-white/15 bg-white/5 p-5"
            >
              <p className="text-sm leading-relaxed text-slate-200">
                "{item.quote}"
              </p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-400">{item.role}</p>
                </div>
                <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {item.metric}
                </span>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="mx-auto max-w-6xl px-3 pb-12 sm:px-5 sm:pb-14 md:px-8 md:pb-16"
      >
        <div className="rounded-4xl relative overflow-hidden border border-cyan-300/25 bg-[linear-gradient(140deg,rgba(6,182,212,0.2),rgba(15,23,42,0.85),rgba(251,191,36,0.16))] p-6 shadow-[0_30px_95px_-60px_rgba(34,211,238,0.9)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full border border-cyan-200/30" />
          <div className="pointer-events-none absolute -bottom-20 left-24 h-44 w-44 rounded-full border border-amber-200/25" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Listo para acelerar
              </p>
              <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                Empieza a vender con mas control desde esta semana
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-100/90 sm:text-base">
                Te ayudamos a configurar el flujo comercial para que el equipo
                opere rapido, con datos claros y sin improvisaciones.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleDemoClick}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-cyan-200/40 bg-cyan-400/15 px-6 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/25"
              >
                Ver demo interactiva
                <ArrowUpRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/login")}
                className="min-h-11 rounded-full border-white/30 bg-white/10 px-6 text-sm font-semibold text-white hover:border-cyan-200"
              >
                Iniciar sesion
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      <Footer />
    </div>
  );
}
