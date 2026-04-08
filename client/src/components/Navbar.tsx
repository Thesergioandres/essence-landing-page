import { AnimatePresence, m as motion } from "framer-motion";
import { BookOpen, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSmartLoginEntry } from "../features/auth/hooks/useSmartLoginEntry";
import { useBrandLogo } from "../hooks/useBrandLogo";
import { Button } from "../shared/components/ui";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const brandLogo = useBrandLogo();
  const navigate = useNavigate();
  const { enter, loading } = useSmartLoginEntry();

  const navLinks = [
    { href: "/", label: "Inicio" },
    { href: "/#modulos", label: "Modulos" },
    { href: "/#pricing", label: "Precios" },
  ];

  return (
    <nav className="safe-top sticky top-0 z-50 border-b border-cyan-300/20 bg-[linear-gradient(120deg,rgba(8,11,20,0.95),rgba(10,16,28,0.9),rgba(8,12,21,0.95))] shadow-[0_16px_50px_-38px_rgba(34,211,238,0.7)] backdrop-blur-xl">
      <div className="safe-x mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 sm:min-h-20">
          <Link
            to="/"
            className="flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 transition hover:border-cyan-300/40 hover:bg-white/10"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src={brandLogo}
              alt="Essence ERP"
              className="h-12 w-auto sm:h-14"
              loading="lazy"
            />
          </Link>

          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 lg:flex">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-cyan-100"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex lg:gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/manual")}
              className="rounded-full border-cyan-300/50 bg-cyan-400/10 px-4 text-xs text-cyan-100 hover:bg-cyan-400/20 lg:text-sm"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Manual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void enter();
              }}
              disabled={loading}
              className="rounded-full border-white/25 bg-white/5 px-4 text-xs text-slate-100 hover:border-cyan-300 hover:bg-white/10 lg:text-sm"
            >
              Iniciar sesión
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 28,
                mass: 0.55,
              }}
              className="overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] md:hidden"
            >
              <div className="space-y-1.5 p-3">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-cyan-100"
                  >
                    {link.label}
                  </a>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/manual");
                  }}
                  className="w-full justify-center rounded-xl border-cyan-300/50 bg-cyan-400/10 text-sm text-cyan-100 hover:bg-cyan-400/20"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Manual de usuario
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void enter();
                  }}
                  disabled={loading}
                  className="w-full justify-center rounded-xl border-white/25 bg-white/5 text-sm text-slate-100 hover:border-cyan-300 hover:bg-white/10"
                >
                  Iniciar sesión
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
