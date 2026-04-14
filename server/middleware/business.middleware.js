import Business from "../src/infrastructure/database/models/Business.js";
import Membership from "../src/infrastructure/database/models/Membership.js";
import User from "../src/infrastructure/database/models/User.js";
import {
  getBusinessUsage,
  resolveBusinessLimits,
} from "../src/infrastructure/services/planLimits.service.js";
import {
  isEmployeeRole,
  normalizeEmployeeRole,
} from "../src/utils/roleAliases.js";
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

    // Array para logs de debug
    const debugLogs = [];
    const addDebugLog = (msg) => {
      console.log(msg);
      debugLogs.push(msg.replace(/\[businessContext\]\s*/, ""));
    };

    addDebugLog(
      `[businessContext] Initial businessId from header/query: ${businessId}`,
    );
    addDebugLog(`[businessContext] User ID: ${req.user?._id || req.user?.id}`);
    addDebugLog(`[businessContext] User role: ${req.user?.role}`);

    // Fallback: Si no hay ID explícito, intentar resolver por el usuario logueado (Auto-Select Default Business)
    if (!businessId && req.user) {
      const defaultMembership = await Membership.findOne({
        user: req.user._id || req.user.id,
        status: "active",
      }).sort({ createdAt: 1 }); // Preferir el más antiguo/principal

      addDebugLog(
        `[businessContext] Auto-resolved membership: ${defaultMembership ? `Found (business: ${defaultMembership.business}, role: ${defaultMembership.role})` : "NOT FOUND"}`,
      );

      if (defaultMembership) {
        businessId = defaultMembership.business.toString();
        addDebugLog(
          `[businessContext] ℹ️ Auto-resolving business context to: ${businessId}`,
        );
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
      addDebugLog(`[businessContext] ❌ ERROR: No businessId found`);
      return res.status(400).json({
        message: "Falta el identificador de negocio (x-business-id)",
        debug: debugLogs,
      });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      addDebugLog(
        `[businessContext] ❌ Business NOT found for ID: ${businessId}`,
      );
      return res.status(404).json({
        message: "Negocio no encontrado",
        debug: debugLogs,
      });
    }

    addDebugLog(
      `[businessContext] ✅ Business found: ${business.name} (${business._id})`,
    );

    const isSuperAdmin = req.user?.role === "super_admin";
    const isGod = req.user?.role === "god";
    let membership = null;

    addDebugLog(
      `[businessContext] isSuperAdmin: ${isSuperAdmin}, isGod: ${isGod}`,
    );

    if (!isSuperAdmin && !isGod) {
      membership = await Membership.findOne({
        business: businessId,
        user: req.user?.id,
        status: "active",
      });

      addDebugLog(
        `[businessContext] Membership lookup result: ${membership ? `Found (role: ${membership.role}, status: ${membership.status})` : "NOT FOUND"}`,
      );

      if (!membership) {
        const isOwner =
          business.createdBy?.toString() === req.user?.id?.toString();
        addDebugLog(`[businessContext] Is business owner: ${isOwner}`);

        // Permitir al creador del negocio actuar como admin aunque no exista membership explícita
        if (isOwner) {
          membership = new Membership({
            user: req.user?.id,
            business: businessId,
            role: "admin",
            status: "active",
          });
          addDebugLog(
            `[businessContext] Created virtual admin membership for owner`,
          );
        } else {
          addDebugLog(
            `[businessContext] ❌ ERROR: User has no membership and is not owner`,
          );
          logAuthError({
            message: "No tienes acceso a este negocio",
            module: "businessContext",
            requestId: req.reqId,
            userId: req.user?.id,
            businessId,
          });
          return res.status(403).json({
            message: "No tienes acceso a este negocio",
            debug: debugLogs,
          });
        }
      }
    }

    // Si el creador (super admin) perdió acceso, bloquear a los employees del negocio
    if (isEmployeeRole(membership?.role) && !isGod) {
      addDebugLog(`[businessContext] Checking employee's owner status...`);

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

      addDebugLog(`[businessContext] Owner inactive: ${ownerInactive}`);

      if (ownerInactive) {
        addDebugLog(
          `[businessContext] ❌ ERROR: Owner is inactive, blocking employee`,
        );
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
          debug: debugLogs,
        });
      }
    }

    addDebugLog(`[businessContext] ✅ SUCCESS: Business context resolved`);
    req.business = business;
    req.businessId = businessId;
    req.membership = membership;

    // Inyectar el Cortacorriente (Subscripción) automáticamente
    return checkSubscription(req, res, next);
  } catch (error) {
    console.log(`[businessContext] ❌ EXCEPTION:`, error.message);
    logAuthError({
      message: "Error resolviendo negocio",
      module: "businessContext",
      requestId: req.reqId,
      userId: req.user?.id,
      stack: error.stack,
    });
    res.status(500).json({
      message: "Error resolviendo negocio",
      error: error.message,
      debug: error.stack,
    });
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
    const effectiveRole = isGod
      ? "super_admin"
      : normalizeEmployeeRole(membershipRole || userRole);

    const normalizedAllowedRoles = roles.map((role) =>
      normalizeEmployeeRole(role),
    );

    if (normalizedAllowedRoles.includes(effectiveRole)) {
      return next();
    }

    return res.status(403).json({ message: "Acceso denegado" });
  };
};

// Permisos granulares por módulo/acción con soporte de sede
export const requirePermission = ({ module, action, branchResolver } = {}) => {
  return (req, res, next) => {
    const debugLogs = [];
    const addDebugLog = (msg) => {
      console.log(msg);
      debugLogs.push(msg.replace(/\[requirePermission\]\s*/, ""));
    };

    addDebugLog(
      `[requirePermission] Checking permission for module: ${module}, action: ${action}`,
    );
    addDebugLog(`[requirePermission] req.user exists: ${!!req.user}`);
    addDebugLog(`[requirePermission] req.user.role: ${req.user?.role}`);
    addDebugLog(`[requirePermission] req.user._id: ${req.user?._id}`);
    addDebugLog(
      `[requirePermission] req.membership exists: ${!!req.membership}`,
    );
    addDebugLog(
      `[requirePermission] req.membership.role: ${req.membership?.role}`,
    );

    const isSuperAdmin = req.user?.role === "super_admin";
    const isGod = req.user?.role === "god";

    addDebugLog(
      `[requirePermission] isSuperAdmin: ${isSuperAdmin}, isGod: ${isGod}`,
    );

    // Super admin y god pueden pasar, pero si hay branchScope configurado lo respetamos
    if (isSuperAdmin || isGod) {
      addDebugLog(`[requirePermission] ✅ Allowing super_admin/god`);
      return next();
    }

    // Si no hay membership, usar el rol del usuario como fallback (útil para tests)
    const membership =
      req.membership ||
      (req.user
        ? { role: req.user.role, permissions: {}, allowedBranches: [] }
        : null);

    addDebugLog(
      `[requirePermission] Effective membership role: ${membership?.role}`,
    );

    if (!membership) {
      addDebugLog(`[requirePermission] ❌ No membership found`);
      logAuthError({
        message: "Acceso denegado (sin membership)",
        module: "requirePermission",
        requestId: req.reqId,
        userId: req.user?.id,
        businessId: req.businessId,
      });
      return res.status(403).json({
        message: "Acceso denegado",
        debug: debugLogs,
      });
    }

    const effective = buildEffectivePermissions(membership);
    const allowed = isActionAllowed(effective, module, action);

    addDebugLog(`[requirePermission] Permission allowed: ${allowed}`);
    addDebugLog(
      `[requirePermission] Effective permissions: ${JSON.stringify(effective)}`,
    );

    if (!allowed) {
      addDebugLog(
        `[requirePermission] ❌ Permission denied for ${module}.${action}`,
      );
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
        debug: debugLogs,
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
  return async (req, res, next) => {
    const debugLogs = [];
    const addDebugLog = (msg) => {
      console.log(msg);
      debugLogs.push(msg.replace(/\[requireFeature\]\s*/, ""));
    };

    addDebugLog(`[requireFeature] Checking feature: ${featureKey}`);
    addDebugLog(`[requireFeature] req.business exists: ${!!req.business}`);
    addDebugLog(`[requireFeature] req.businessId: ${req.businessId}`);
    addDebugLog(`[requireFeature] User role: ${req.user?.role}`);

    if (process.env.NODE_ENV === "test" && !req.business) return next();
    const isSuperAdmin = req.user?.role === "super_admin";
    const isGod = req.user?.role === "god";

    addDebugLog(
      `[requireFeature] isSuperAdmin: ${isSuperAdmin}, isGod: ${isGod}`,
    );

    if (!req.business && (isSuperAdmin || isGod)) {
      addDebugLog(
        `[requireFeature] ✅ Allowing super_admin/god without business`,
      );
      return next();
    }

    if (isSuperAdmin || isGod) {
      addDebugLog(`[requireFeature] ✅ Allowing super_admin/god`);
      return next();
    }

    const normalizedFeatureKey =
      featureKey === "businessAssistant" ? "assistant" : featureKey;

    if (normalizedFeatureKey === "assistant") {
      const resolvedLimits = await resolveBusinessLimits(
        req.business || req.businessId,
      );
      const isAssistantEnabledByPlan =
        resolvedLimits?.planConfig?.features?.businessAssistant === true;

      addDebugLog(
        `[requireFeature] Assistant enabled by plan: ${isAssistantEnabledByPlan}`,
      );

      if (!isAssistantEnabledByPlan) {
        addDebugLog(
          `[requireFeature] ❌ Assistant blocked: current plan has no access`,
        );
        return res.status(403).json({
          message: "Business Assistant no está disponible para el plan actual",
          code: "FEATURE_RESTRICTED_BY_PLAN",
          feature: "assistant",
        });
      }

      addDebugLog(`[requireFeature] ✅ Assistant allowed by plan`);
      return next();
    }

    const isEnabled = req.business?.config?.features?.[normalizedFeatureKey];
    addDebugLog(
      `[requireFeature] Feature '${normalizedFeatureKey}' enabled: ${isEnabled}`,
    );

    // Si no está definido, asumir habilitado para no bloquear rutas por config incompleta
    if (isEnabled !== false) {
      addDebugLog(
        `[requireFeature] ✅ Feature not explicitly disabled, allowing`,
      );
      return next();
    }

    addDebugLog(`[requireFeature] ❌ Feature disabled for this business`);
    logAuthError({
      message: "Funcionalidad desactivada para este negocio",
      module: "requireFeature",
      requestId: req.reqId,
      userId: req.user?.id,
      businessId: req.businessId,
      extra: { featureKey },
    });
    return res.status(403).json({
      message: "Funcionalidad desactivada para este negocio",
      debug: debugLogs,
    });
  };
};

export const checkPlanLimits = (resourceKey) => {
  return async (req, res, next) => {
    try {
      const isGod = req.user?.role === "god";
      if (isGod) {
        return next();
      }

      const businessId = req.businessId || req.business?._id?.toString();
      if (!businessId) {
        return res.status(400).json({
          success: false,
          message: "Falta contexto de negocio para validar límites",
        });
      }

      if (!["branches", "employees"].includes(resourceKey)) {
        return res.status(500).json({
          success: false,
          message: "Recurso de límite inválido",
        });
      }

      const [{ limits, plan }, usage] = await Promise.all([
        resolveBusinessLimits(req.business || businessId),
        getBusinessUsage(businessId),
      ]);

      const currentUsage = usage[resourceKey] || 0;
      const currentLimit = limits[resourceKey];

      if (!currentLimit || currentUsage < currentLimit) {
        return next();
      }

      return res.status(403).json({
        success: false,
        code: "PLAN_LIMIT_REACHED",
        resource: resourceKey,
        message:
          resourceKey === "branches"
            ? "Has alcanzado el límite de sedes de tu plan"
            : "Has alcanzado el límite de employees de tu plan",
        plan,
        limits,
        usage,
        upgradeSuggestion: plan === "starter" ? "pro" : "enterprise",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error validando límites del plan",
        error: error.message,
      });
    }
  };
};

// Cortacorriente (Middleare de Suscripción)
export async function checkSubscription(req, res, next) {
  try {
    const isGod = req.user?.role === "god";
    if (isGod) {
      return next();
    }

    const businessId = req.businessId || req.business?._id?.toString();
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Falta contexto de negocio para validar la suscripción",
      });
    }

    const business =
      req.business || (await Business.findById(businessId).lean());
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Negocio no encontrado",
      });
    }

    // Resolver dueño (por lo general el creator o el admin más antiguo)
    const primaryAdminMembership = await Membership.findOne({
      business: businessId,
      role: "admin",
      status: "active",
    })
      .sort({ createdAt: 1 })
      .lean();

    const ownerUserId = primaryAdminMembership?.user || business.createdBy;
    if (!ownerUserId) {
      return res.status(403).json({
        success: false,
        message: "No se pudo resolver el creador o dueño del negocio",
      });
    }

    const owner = await User.findById(ownerUserId).select(
      "status active subscriptionExpiresAt",
    );

    if (!owner) {
      return res.status(403).json({
        success: false,
        message: "El propietario del negocio ya no existe en el sistema",
      });
    }

    const ownerExpired =
      owner.subscriptionExpiresAt &&
      new Date(owner.subscriptionExpiresAt).getTime() < Date.now();

    const isSuspendedOrExpired = ["suspended", "expired"].includes(
      owner.status,
    );

    if (ownerExpired || isSuspendedOrExpired || !owner.active) {
      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_INACTIVE",
        message: "Suscripción del negocio inactiva o expirada.",
        subscriptionExpiresAt: owner.subscriptionExpiresAt || null,
        status: owner.status,
      });
    }

    // Todo bien
    next();
  } catch (error) {
    console.error("[checkSubscription] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error verificando suscripción",
      error: error.message,
    });
  }
}
