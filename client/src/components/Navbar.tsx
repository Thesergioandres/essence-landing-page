import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-700 bg-gray-900/80 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent">
              ESSENCE
            </h1>
          </Link>

          {/* Navigation Links */}
          <div className="hidden items-center gap-8 md:flex">
            <Link
              to="/"
              className="text-gray-300 transition hover:text-purple-400"
            >
              Inicio
            </Link>
            <Link
              to="/productos"
              className="text-gray-300 transition hover:text-purple-400"
            >
              Productos
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-purple-500 px-4 py-2 text-sm font-medium text-purple-400 transition hover:bg-purple-500/10"
            >
              Admin
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="text-gray-300 hover:text-purple-400 md:hidden">
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
          </button>
        </div>
      </div>
    </nav>
  );
}
