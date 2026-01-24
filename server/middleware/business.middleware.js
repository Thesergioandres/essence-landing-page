import Business from "../models/Business.js";
import Membership from "../models/Membership.js";
import User from "../models/User.js";
import { logAuthError } from "../utils/logger.js";
import {
  buildEffectivePermissions,
  isActionAllowed,
} from "../utils/permissions.js";

// Resuelve el contexto de negocio a partir del header/query y valida membership
export const businessContext = async (req, res, next) => {
  try {
    const isTest = process.env.NODE_ENV === "test";
    let businessId = req.headers["x-business-id"] || req.query.businessId;

    // Fallback: Si no hay ID explícito, intentar resolver por el usuario logueado (Auto-Select Default Business)
    if (!businessId && req.user) {
      const defaultMembership = await Membership.findOne({
        user: req.user._id || req.user.id,
        status: "active",
      }).sort({ createdAt: 1 }); // Preferir el más antiguo/principal

      if (defaultMembership) {
        businessId = defaultMembership.business.toString();
        // console.log(`ℹ️ Auto-resolving business context to: ${businessId}`);
      }
    }

    if (isTest && !businessId) {
      req.business = null;
      req.businessId = null;
      req.membership = null;
      return next();
    }
    // Incluso super_admin debe indicar el negocio explícitamente (o resolverse automáticamente arriba)
    if (!businessId) {
      return res
        .status(400)
        .json({ message: "Falta el identificador de negocio (x-business-id)" });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Negocio no encontrado" });
    }

    const isSuperAdmin = req.user?.role === "super_admin";
    const isGod = req.user?.role === "god";
    let membership = null;
    if (!isSuperAdmin && !isGod) {
      membership = await Membership.findOne({
        business: businessId,
        user: req.user?.id,
        status: "active",
      });

      if (!membership) {
        const isOwner =
          business.createdBy?.toString() === req.user?.id?.toString();
        // Permitir al creador del negocio actuar como admin aunque no exista membership explícita
        if (isOwner) {
          membership = new Membership({
            user: req.user?.id,
            business: businessId,
            role: "admin",
            status: "active",
          });
        } else {
          logAuthError({
            message: "No tienes acceso a este negocio",
            module: "businessContext",
            requestId: req.reqId,
            userId: req.user?.id,
            businessId,
          });
          return res
            .status(403)
            .json({ message: "No tienes acceso a este negocio" });
        }
      }
    }

    // Si el creador (super admin) perdió acceso, bloquear a los distribuidores del negocio
    if (membership?.role === "distribuidor" && !isGod) {
      // Resolver owner/admin principal: membership admin más antiguo o creador
      const primaryAdminMembership = await Membership.findOne({
        business: businessId,
        role: "admin",
        status: "active",
      })
        .sort({ createdAt: 1 })
        .lean();

      const ownerUserId = primaryAdminMembership?.user || business.createdBy;
      const owner = await User.findById(ownerUserId).select(
        "role status active subscriptionExpiresAt",
      );

      const ownerExpired =
        owner?.subscriptionExpiresAt &&
        new Date(owner.subscriptionExpiresAt).getTime() < Date.now();

      const ownerInactive =
        !owner || !owner.active || owner.status !== "active" || ownerExpired;

      if (ownerInactive) {
        logAuthError({
          message: "Acceso deshabilitado: owner_inactive",
          module: "businessContext",
          requestId: req.reqId,
          userId: req.user?.id,
          businessId,
          extra: { code: "owner_inactive" },
        });
        return res.status(403).json({
          message:
            "Acceso deshabilitado: el administrador del negocio no tiene acceso activo",
          code: "owner_inactive",
          subscriptionExpiresAt: owner?.subscriptionExpiresAt || null,
        });
      }
    }

    req.business = business;
    req.businessId = businessId;
    req.membership = membership;
    next();
  } catch (error) {
    logAuthError({
      message: "Error resolviendo negocio",
      module: "businessContext",
      requestId: req.reqId,
      userId: req.user?.id,
      stack: error.stack,
    });
    res
      .status(500)
      .json({ message: "Error resolviendo negocio", error: error.message });
  }
};

// Verifica roles considerando super admin y rol por membership
export const requireRole = (roles = [], options = {}) => {
  return (req, res, next) => {
    const isSuperAdmin = req.user?.role === "super_admin";
    const isGod = req.user?.role === "god";
    if (options.scope === "system") {
      return isSuperAdmin
        ? next()
        : res.status(403).json({ message: "Solo super administradores" });
    }

    if ((isSuperAdmin || isGod) && roles.includes("super_admin")) {
      return next();
    }

    const membershipRole = req.membership?.role;
    const userRole = req.user?.role;
    const effectiveRole = isGod ? "super_admin" : membershipRole || userRole;

    if (roles.includes(effectiveRole)) {
      return next();
    }

    return res.status(403).json({ message: "Acceso denegado" });
  };
};

// Permisos granulares por módulo/acción con soporte de sede
export const requirePermission = ({ module, action, branchResolver } = {}) => {
  return (req, res, next) => {
    const isSuperAdmin = req.user?.role === "super_admin";
    const isGod = req.user?.role === "god";

    // Super admin y god pueden pasar, pero si hay branchScope configurado lo respetamos
    if (isSuperAdmin || isGod) {
      return next();
    }

    // Si no hay membership, usar el rol del usuario como fallback (útil para tests)
    const membership =
      req.membership ||
      (req.user
        ? { role: req.user.role, permissions: {}, allowedBranches: [] }
        : null);

    if (!membership) {
      logAuthError({
        message: "Acceso denegado (sin membership)",
        module: "requirePermission",
        requestId: req.reqId,
        userId: req.user?.id,
        businessId: req.businessId,
      });
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const effective = buildEffectivePermissions(membership);
    const allowed = isActionAllowed(effective, module, action);

    if (!allowed) {
      logAuthError({
        message: "Permiso denegado",
        module: "requirePermission",
        requestId: req.reqId,
        userId: req.user?.id,
        businessId: req.businessId,
        extra: { module, action },
      });
      return res.status(403).json({
        message: "Permiso denegado",
        module,
        action,
      });
    }

    // Validar sede si el membership está restringido
    const branchId =
      branchResolver?.(req) ||
      req.params?.branchId ||
      req.body?.branchId ||
      req.body?.branch;

    if (
      branchId &&
      Array.isArray(membership.allowedBranches) &&
      membership.allowedBranches.length > 0
    ) {
      const hasAccess = membership.allowedBranches.some(
        (b) => b?.toString() === branchId?.toString(),
      );

      if (!hasAccess) {
        logAuthError({
          message: "No tienes acceso a esta sede",
          module: "requirePermission",
          requestId: req.reqId,
          userId: req.user?.id,
          businessId: req.businessId,
          extra: { module, action, branchId },
        });
        return res.status(403).json({
          message: "No tienes acceso a esta sede",
          module,
          action,
        });
      }
    }

    next();
  };
};

// Verifica que la feature esté activa para el negocio seleccionado
export const requireFeature = (featureKey) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === "test" && !req.business) return next();
    const isSuperAdmin = req.user?.role === "super_admin";
    const isGod = req.user?.role === "god";
    if (!req.business && (isSuperAdmin || isGod)) return next();

    if (isSuperAdmin || isGod) return next();

    const isEnabled = req.business?.config?.features?.[featureKey];
    // Si no está definido, asumir habilitado para no bloquear rutas por config incompleta
    if (isEnabled !== false) return next();

    logAuthError({
      message: "Funcionalidad desactivada para este negocio",
      module: "requireFeature",
      requestId: req.reqId,
      userId: req.user?.id,
      businessId: req.businessId,
      extra: { featureKey },
    });
    return res
      .status(403)
      .json({ message: "Funcionalidad desactivada para este negocio" });
  };
};
