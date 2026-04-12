import type { ReactNode } from "react";

interface OperativoModuleShellProps {
  title: string;
  description: string;
  allow: boolean;
  children: ReactNode;
}

export default function OperativoModuleShell({
  title,
  description,
  allow,
  children,
}: OperativoModuleShellProps) {
  if (!allow) {
    return (
      <section className="space-y-3">
        <header className="rounded-xl border border-blue-500/20 bg-gray-900/70 p-4 sm:p-5">
          <h1 className="text-lg font-semibold text-white sm:text-xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-300">{description}</p>
        </header>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          No tienes permisos para acceder a este módulo operativo en el negocio
          seleccionado.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-blue-500/20 bg-gray-900/70 p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-white sm:text-xl">{title}</h1>
        <p className="mt-1 text-sm text-gray-300">{description}</p>
      </header>
      {children}
    </section>
  );
}
