import type { ReactNode } from "react";
import { NavLink, type NavLinkProps } from "react-router-dom";
import { useBusiness } from "../context/BusinessContext";
import type { BusinessFeatures } from "../types";

interface FeatureNavLinkProps extends Omit<NavLinkProps, "className"> {
  feature?: keyof BusinessFeatures;
  children: ReactNode;
  className: (isActive: boolean) => string;
}

/**
 * NavLink que solo se muestra si el feature está habilitado.
 * Si no se especifica feature, siempre se muestra.
 */
export default function FeatureNavLink({
  feature,
  children,
  className,
  ...props
}: FeatureNavLinkProps) {
  const { features } = useBusiness();

  // Si no hay feature requerido, siempre mostrar
  if (!feature) {
    return (
      <NavLink className={({ isActive }) => className(isActive)} {...props}>
        {children}
      </NavLink>
    );
  }

  // Verificar si el feature está habilitado (default: true)
  const isEnabled = features[feature] !== false;

  if (!isEnabled) {
    return null;
  }

  return (
    <NavLink className={({ isActive }) => className(isActive)} {...props}>
      {children}
    </NavLink>
  );
}
