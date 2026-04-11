import { motion } from "framer-motion";
import type { StorefrontTemplateProps } from "../../types/publicStorefront.types";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

export default function MinimalTemplate({
  storefront,
}: StorefrontTemplateProps) {
  const { business, products } = storefront;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="border-b border-zinc-200 pb-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Tienda publica
          </p>
          <h1 className="mt-3 text-5xl font-black leading-none text-zinc-950 sm:text-6xl">
            {business.name}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-600">
            {business.description ||
              "Presentacion minimalista para exhibir tu catalogo con claridad y elegancia."}
          </p>

          <div className="mt-6 flex flex-wrap gap-5 text-sm text-zinc-600">
            {business.contact?.phone && (
              <span>Telefono: {business.contact.phone}</span>
            )}
            {business.contact?.email && (
              <span>Email: {business.contact.email}</span>
            )}
            {business.contact?.location && (
              <span>Ubicacion: {business.contact.location}</span>
            )}
          </div>
        </motion.header>

        <section className="mt-12 space-y-6">
          {products.map((product, index) => (
            <motion.article
              key={product.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              className="grid gap-4 border-b border-zinc-200 pb-6 md:grid-cols-[180px,1fr,180px] md:items-center"
            >
              <div className="h-40 overflow-hidden rounded-2xl bg-zinc-200 shadow-lg">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover transition-all duration-300 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl text-zinc-500">
                    *
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-zinc-950">
                  {product.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                  {product.description ||
                    "Producto disponible en este escaparate."}
                </p>
              </div>

              <div className="text-left md:text-right">
                <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                  Precio publico
                </p>
                <p className="mt-1 text-3xl font-black text-zinc-950">
                  {formatCurrency(product.price)}
                </p>
              </div>
            </motion.article>
          ))}
        </section>
      </div>
    </div>
  );
}
