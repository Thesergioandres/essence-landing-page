import { useState } from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-700 bg-gray-900/95 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center"
            onClick={() => setMobileMenuOpen(false)}
          >
            <h1 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-xl font-bold text-transparent sm:text-2xl">
              ESSENCE
            </h1>
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
              to="/productos"
              className="text-sm text-gray-300 transition hover:text-purple-400 lg:text-base"
            >
              Productos
            </Link>
            <Link
              to="/admin/register-sale"
              className="rounded-lg border border-purple-500 px-3 py-2 text-xs font-medium text-purple-400 transition hover:bg-purple-500/10 lg:px-4 lg:text-sm"
            >
              Registrar Venta
            </Link>
            <Link
              to="/login/distributor"
              className="bg-linear-to-r rounded-lg border border-blue-500 from-blue-600 to-cyan-600 px-3 py-2 text-xs font-medium text-white transition hover:from-blue-700 hover:to-cyan-700 lg:px-4 lg:text-sm"
            >
              Distribuidor
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
              to="/productos"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-12 items-center rounded-lg px-3 py-3 text-base text-gray-300 transition hover:bg-purple-600/10 hover:text-purple-400 active:scale-[0.98]"
            >
              Productos
            </Link>
            <Link
              to="/admin/register-sale"
              onClick={() => setMobileMenuOpen(false)}
              className="mx-3 flex min-h-12 items-center justify-center rounded-lg border border-purple-500 px-4 py-3 text-center text-base font-medium text-purple-400 transition hover:bg-purple-500/10 active:scale-[0.98]"
            >
              Registrar Venta
            </Link>
            <Link
              to="/login/distributor"
              onClick={() => setMobileMenuOpen(false)}
              className="bg-linear-to-r mx-3 flex min-h-12 items-center justify-center rounded-lg from-blue-600 to-cyan-600 px-4 py-3 text-center text-base font-medium text-white transition hover:from-blue-700 hover:to-cyan-700 active:scale-[0.98]"
            >
              Distribuidor
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
