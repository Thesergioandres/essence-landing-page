import { useState } from "react";
import { Link } from "react-router-dom";
import { useBrandLogo } from "../hooks/useBrandLogo";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const brandLogo = useBrandLogo();

  return (
    <nav className="safe-top sticky top-0 z-50 border-b border-gray-700 bg-gray-900/95 backdrop-blur-lg">
      <div className="safe-x mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-[3.5rem] items-center justify-between sm:min-h-[5rem]">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src={brandLogo}
              alt="Essence ERP"
              className="sm:h-18 h-16 w-auto"
              loading="lazy"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden items-center gap-3 md:flex lg:gap-4">
            <Link
              to="/"
              className="text-sm text-gray-300 transition hover:text-purple-400 lg:text-base"
            >
              Inicio
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-purple-500 px-3 py-2 text-xs font-medium text-purple-100 transition hover:bg-purple-500/10 lg:px-4 lg:text-sm"
            >
              Iniciar sesión
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="-mr-2 p-2 text-gray-300 hover:text-purple-400 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${
            mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="space-y-1 pb-3 pt-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-12 items-center rounded-lg px-3 py-3 text-base text-gray-300 transition hover:bg-purple-600/10 hover:text-purple-400 active:scale-[0.98]"
            >
              Inicio
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="mx-3 flex min-h-12 items-center justify-center rounded-lg border border-purple-500 px-4 py-3 text-center text-base font-medium text-purple-100 transition hover:bg-purple-500/10 active:scale-[0.98]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
