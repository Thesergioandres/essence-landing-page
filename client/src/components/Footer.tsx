import { Mail, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { useSmartLoginEntry } from "../features/auth/hooks/useSmartLoginEntry";
import { useBrandLogo } from "../hooks/useBrandLogo";
import { Button } from "../shared/components/ui";

export default function Footer() {
  const { business } = useBusiness();
  const { enter, loading } = useSmartLoginEntry();
  const contactEmail = business?.contactEmail || "";
  const contactPhone =
    business?.contactWhatsapp || business?.contactPhone || "";
  const contactLocation = business?.contactLocation || "";
  const brandLogo = useBrandLogo();
  const phoneDigits = contactPhone.replace(/\D/g, "");

  return (
    <footer className="relative overflow-hidden border-t border-cyan-300/20 bg-[linear-gradient(160deg,rgba(8,11,20,0.96),rgba(9,15,26,0.94),rgba(8,11,20,0.97))]">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-cyan-400/12 absolute -left-36 top-[-100px] h-[340px] w-[340px] rounded-full blur-[110px]" />
        <div className="absolute -top-20 right-[-90px] h-[300px] w-[300px] rounded-full bg-amber-400/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 md:py-14 lg:px-8">
        <div className="mb-8 rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(34,211,238,0.14),rgba(15,23,42,0.72),rgba(251,191,36,0.12))] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Soporte y continuidad
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Tu operacion merece control todos los dias
              </h3>
              <p className="mt-2 text-sm text-slate-200/90">
                Activa tu cuenta y opera inventario, ventas y rentabilidad con
                una sola fuente de verdad.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void enter();
              }}
              disabled={loading}
              className="min-h-11 rounded-full border-cyan-200/45 bg-cyan-400/10 px-6 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20"
            >
              Iniciar sesion
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 md:grid-cols-3">
          <div className="text-center sm:text-left">
            <img
              src={brandLogo}
              alt="Essence ERP"
              className="mx-auto h-16 w-auto sm:mx-0 sm:h-20"
              loading="lazy"
            />
            <p className="mt-3 px-2 text-sm leading-relaxed text-slate-300 sm:mt-4 sm:px-0 sm:text-base">
              ERP modular para operar múltiples negocios con inventario,
              catálogos, comisiones y analítica en un solo panel.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {[
                "Inventario en vivo",
                "Comisiones claras",
                "Escalable por plan",
              ].map(item => (
                <span
                  key={item}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white sm:mb-4 sm:text-base">
              Enlaces
            </h3>
            <ul className="space-y-2.5 sm:space-y-3">
              <li>
                <a
                  href="/"
                  className="flex min-h-11 items-center justify-center rounded-lg px-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-100 sm:justify-start sm:text-base"
                >
                  Inicio
                </a>
              </li>
              <li>
                <a
                  href="/#modulos"
                  className="flex min-h-11 items-center justify-center rounded-lg px-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-100 sm:justify-start sm:text-base"
                >
                  Módulos
                </a>
              </li>
              <li>
                <a
                  href="/#pricing"
                  className="flex min-h-11 items-center justify-center rounded-lg px-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-100 sm:justify-start sm:text-base"
                >
                  Precios
                </a>
              </li>
              <li>
                <a
                  href="/manual"
                  className="flex min-h-11 items-center justify-center rounded-lg px-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-100 sm:justify-start sm:text-base"
                >
                  Manual de usuario
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    void enter();
                  }}
                  disabled={loading}
                  className="flex min-h-11 items-center justify-center rounded-lg px-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-100 sm:justify-start sm:text-base"
                >
                  Iniciar sesión
                </button>
              </li>
            </ul>
          </div>

          <div className="text-center sm:col-span-2 sm:text-left md:col-span-1">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white sm:mb-4 sm:text-base">
              Contacto
            </h3>
            <ul className="space-y-3 sm:space-y-3.5">
              <li className="flex items-center justify-center gap-2.5 text-sm text-slate-300 sm:justify-start sm:text-base">
                <Mail className="h-5 w-5 shrink-0 text-cyan-200" />
                {contactEmail ? (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="break-all transition hover:text-cyan-100"
                  >
                    {contactEmail}
                  </a>
                ) : (
                  <a
                    href="mailto:Serguito2003@gmail.com"
                    className="break-all transition hover:text-cyan-100"
                  >
                    Serguito2003@gmail.com
                  </a>
                )}
              </li>
              {contactLocation && (
                <li className="flex items-center justify-center gap-2.5 text-sm text-slate-300 sm:justify-start sm:text-base">
                  <MapPin className="h-5 w-5 shrink-0 text-cyan-200" />
                  <span className="wrap-break-word text-slate-300">
                    {contactLocation}
                  </span>
                </li>
              )}
              {contactPhone && (
                <li className="flex items-center justify-center gap-2.5 text-sm text-slate-300 sm:justify-start sm:text-base">
                  <MessageCircle className="h-5 w-5 shrink-0 text-emerald-300" />
                  <a
                    href={`https://wa.me/${phoneDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-emerald-300"
                  >
                    WhatsApp
                  </a>
                </li>
              )}

              <li className="flex items-center justify-center gap-2.5 text-sm text-slate-300 sm:justify-start sm:text-base">
                <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-200" />
                <span>Soporte y actualizaciones continuas</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-center sm:mt-10 sm:flex sm:items-center sm:justify-between sm:pt-8 sm:text-left">
          <p className="text-sm text-slate-400 sm:text-base">
            © {new Date().getFullYear()} Essence. Todos los derechos reservados.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500 sm:mt-0">
            Operacion comercial con control y claridad
          </p>
        </div>
      </div>
    </footer>
  );
}
