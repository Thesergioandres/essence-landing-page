export default function Footer() {
  return (
    <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 md:py-12">
        <div className="grid gap-8 sm:gap-10 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {/* Brand */}
          <div className="text-center sm:text-left">
            <h2 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl sm:text-2xl md:text-3xl font-bold text-transparent">
              ESSENCE
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-400 leading-relaxed px-2 sm:px-0">
              Tu tienda de confianza para vapes, líquidos y accesorios de
              calidad.
            </p>
          </div>

          {/* Links */}
          <div className="text-center sm:text-left">
            <h3 className="mb-3 sm:mb-4 text-sm sm:text-base font-semibold uppercase text-white tracking-wider">
              Enlaces
            </h3>
            <ul className="space-y-2.5 sm:space-y-3">
              <li>
                <a
                  href="/"
                  className="flex items-center justify-center sm:justify-start text-sm sm:text-base text-gray-400 transition hover:text-purple-400 active:scale-95 min-h-11"
                >
                  Inicio
                </a>
              </li>
              <li>
                <a
                  href="/productos"
                  className="flex items-center justify-center sm:justify-start text-sm sm:text-base text-gray-400 transition hover:text-purple-400 active:scale-95 min-h-11"
                >
                  Productos
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="text-center sm:text-left sm:col-span-2 md:col-span-1">
            <h3 className="mb-3 sm:mb-4 text-sm sm:text-base font-semibold uppercase text-white tracking-wider">
              Contacto
            </h3>
            <ul className="space-y-3 sm:space-y-3.5">
              <li className="flex items-center justify-center sm:justify-start gap-2.5 text-sm sm:text-base text-gray-400">
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="break-all">serguito2003@gmail.com</span>
              </li>
              <li className="flex items-center justify-center sm:justify-start gap-2.5 text-sm sm:text-base text-gray-400">
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 sm:mt-10 border-t border-gray-700 pt-6 sm:pt-8 text-center">
          <p className="text-sm sm:text-base text-gray-500">
            © {new Date().getFullYear()} Essence. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
