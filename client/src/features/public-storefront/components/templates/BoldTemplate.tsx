import { motion } from "framer-motion";
import type { StorefrontTemplateProps } from "../../types/publicStorefront.types";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

export default function BoldTemplate({ storefront }: StorefrontTemplateProps) {
  const { business, products } = storefront;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-black via-zinc-900 to-zinc-950 p-8 shadow-2xl shadow-amber-500/20"
        >
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
            Bold Storefront
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase leading-none text-amber-200 sm:text-6xl">
            {business.name}
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-zinc-200 sm:text-base">
            {business.description ||
              "Plantilla de alto contraste para marcas que quieren presencia agresiva y memorabilidad inmediata."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/20 bg-white/5 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                Whatsapp
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {business.contact?.whatsapp || "No disponible"}
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/5 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                Telefono
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {business.contact?.phone || "No disponible"}
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/5 p-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                Email
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {business.contact?.email || "No disponible"}
              </p>
            </div>
          </div>
        </motion.section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase text-white">
              Catalogo
            </h2>
            <span className="rounded-full border border-amber-300/50 bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">
              {products.length} items
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product, index) => (
              <motion.article
                key={product.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
                className="group overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-950 transition-all duration-300 hover:border-amber-300/70 hover:shadow-xl hover:shadow-amber-500/20"
              >
                <div className="aspect-[16/11] overflow-hidden bg-zinc-900">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-all duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl text-zinc-600">
                      *
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-5">
                  <h3 className="text-xl font-black uppercase leading-tight text-white">
                    {product.name}
                  </h3>
                  <p className="line-clamp-3 min-h-[58px] text-sm leading-relaxed text-zinc-300">
                    {product.description ||
                      "Producto premium para venta directa."}
                  </p>
                  <p className="text-3xl font-black text-amber-200">
                    {formatCurrency(product.price)}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
