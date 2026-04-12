import { m } from "framer-motion";
import type { StorefrontTemplateProps } from "../../types/publicStorefront.types";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

export default function ModernTemplate({
  storefront,
}: StorefrontTemplateProps) {
  const { business, products } = storefront;
  const socialEntries = Object.entries(business.socialNetworks || {});

  return (
    <div className="bg-linear-to-br min-h-screen from-slate-950 via-slate-900 to-cyan-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <m.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="bg-linear-to-r relative overflow-hidden rounded-3xl border border-white/10 from-slate-900/80 via-slate-800/70 to-cyan-700/40 p-8 shadow-2xl shadow-cyan-900/30 backdrop-blur-xl"
        >
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/90">
                Escaparate Digital
              </p>
              <h1 className="mt-2 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                {business.name}
              </h1>
              {business.description && (
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">
                  {business.description}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                {business.contact?.whatsapp && (
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-400/15 px-3 py-1 text-emerald-100">
                    WhatsApp: {business.contact.whatsapp}
                  </span>
                )}
                {business.contact?.phone && (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-slate-100">
                    Telefono: {business.contact.phone}
                  </span>
                )}
                {business.contact?.location && (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-slate-100">
                    {business.contact.location}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
                {business.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                    {business.name?.charAt(0) || "E"}
                  </div>
                )}
              </div>

              {socialEntries.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2">
                  {socialEntries.slice(0, 4).map(([network, value]) => (
                    <span
                      key={network}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-100"
                    >
                      {network}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </m.section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Productos destacados
            </h2>
            <p className="text-sm text-slate-300">
              {products.length} disponibles
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product, index) => (
              <m.article
                key={product.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/60 hover:bg-white/10"
              >
                <div className="aspect-4/3 overflow-hidden bg-slate-900/80">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl text-slate-500">
                      *
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white">
                    {product.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 min-h-[60px] text-sm leading-relaxed text-slate-300">
                    {product.description ||
                      "Producto premium para tu vitrina digital."}
                  </p>
                  <p className="mt-4 text-2xl font-black text-cyan-200">
                    {formatCurrency(product.price)}
                  </p>
                </div>
              </m.article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
