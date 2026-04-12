import jwt from "jsonwebtoken";
import User from "../src/infrastructure/database/models/User.js";
import { checkBusinessOwnerAccess } from "../src/infrastructure/services/authBusinessAccess.service.js";
import {
  isEmployeeRole,
  normalizeEmployeeRole,
} from "../src/utils/roleAliases.js";
import { logAuthError } from "../utils/logger.js";

// Proteger rutas - verificar JWT
export const protect = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Obtener token del header
      const token = req.headers.authorization.split(" ")[1];

      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      console.warn("[Essence Debug]", "ðŸ”‘ Token decodificado:", decoded);

      // Obtener usuario del token (soportar tanto 'id' como 'userId')
      const userId = decoded.id || decoded.userId;

      if (!userId) {
        logAuthError({
          message: "Token invÃ¡lido: falta ID de usuario",
          module: "auth",
          requestId: req.reqId,
        });
        return res
          .status(401)
          .json({ message: "Token invÃ¡lido: falta ID de usuario" });
      }

      const user = await User.findById(userId).select("-password");

      if (!user) {
        logAuthError({
          message: "Usuario no encontrado",
          module: "auth",
          requestId: req.reqId,
          userId,
        });
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      // Agregar informaciÃ³n del usuario a req.user
      req.user = {
        userId: user._id.toString(),
        id: user._id.toString(),
        _id: user._id, // mantener compatibilidad con controladores que esperan _id
        role: normalizeEmployeeRole(user.role),
        name: user.name,
        email: user.email,
        active: user.active,
        status: user.status,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        modularPermissions: user.modularPermissions || {},
        HIDE_FINANCIAL_DATA: user.HIDE_FINANCIAL_DATA === true,
        hideFinancialData: user.hideFinancialData === true,
      };

      // En entorno de pruebas no bloquear por estado/expiraciÃ³n
      if (process.env.NODE_ENV === "test") {
        req.user.status = "active";
        return next();
      }

      // Si es rol god, siempre permitir
      if (user.role !== "god") {
        // ExpiraciÃ³n automÃ¡tica
        if (
          user.subscriptionExpiresAt &&
          new Date(user.subscriptionExpiresAt).getTime() < Date.now() &&
          user.status === "active"
        ) {
          user.status = "expired";
          await user.save();
          req.user.status = "expired";
        }

        // Permitir usuarios pending solo para rutas pÃºblicas y account-hold
        if (user.status === "pending") {
          // Usuarios pending solo tienen acceso limitado - deben ir a account-hold
          req.user.status = "pending";
          // Continuar con la autenticaciÃ³n - el ProtectedRoute manejarÃ¡ el redirect
        } else if (user.status !== "active") {
          logAuthError({
            message: "Acceso restringido por estado de cuenta",
            module: "auth",
            requestId: req.reqId,
            userId: user._id?.toString(),
            extra: { code: user.status },
          });
          return res.status(403).json({
            message: "Acceso restringido por estado de cuenta",
            code: user.status,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
          });
        }

        // Para empleados, verificar tambiÃ©n el estado del owner del negocio
        if (isEmployeeRole(user.role)) {
          const ownerCheck = await checkBusinessOwnerAccess(user._id);
          if (!ownerCheck.hasAccess) {
            logAuthError({
              message: "Acceso restringido: el negocio no estÃ¡ activo",
              module: "auth",
              requestId: req.reqId,
              userId: user._id?.toString(),
              extra: {
                code: ownerCheck.reason,
                ownerStatus: ownerCheck.ownerStatus,
              },
            });
            return res.status(403).json({
              message: "El negocio al que perteneces no estÃ¡ activo",
              code: ownerCheck.reason,
              ownerExpiresAt: ownerCheck.ownerExpiresAt,
            });
          }
        }
      }

      console.warn("[Essence Debug]", 
        "âœ… Usuario autenticado:",
        req.user.name,
        `(${req.user.role})`,
      );

      next();
    } catch (error) {
      logAuthError({
        message: "Token invÃ¡lido",
        module: "auth",
        requestId: req.reqId,
        stack: error.stack,
      });
      res.status(401).json({ message: "No autorizado, token invÃ¡lido" });
    }
  } else {
    logAuthError({
      message: "No se proporcionÃ³ token",
      module: "auth",
      requestId: req.reqId,
    });
    res.status(401).json({ message: "No autorizado, sin token" });
  }
};

/**
 * Middleware de protecciÃ³n que permite usuarios con status "pending".
 * Ãštil para endpoints como /profile donde el frontend necesita
 * sincronizar el estado actualizado del usuario.
 */
export const protectAllowPending = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded.userId;

      if (!userId) {
        return res
          .status(401)
          .json({ message: "Token invÃ¡lido: falta ID de usuario" });
      }

      const user = await User.findById(userId).select("-password");

      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      // Agregar informaciÃ³n del usuario a req.user (sin bloquear por status)
      req.user = {
        userId: user._id.toString(),
        id: user._id.toString(),
        _id: user._id,
        role: normalizeEmployeeRole(user.role),
        name: user.name,
        email: user.email,
        active: user.active,
        status: user.status,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        modularPermissions: user.modularPermissions || {},
        HIDE_FINANCIAL_DATA: user.HIDE_FINANCIAL_DATA === true,
        hideFinancialData: user.hideFinancialData === true,
      };

      // Si es god, siempre activo
      if (user.role === "god") {
        req.user.status = "active";
      }

      next();
    } catch (error) {
      logAuthError({
        message: "Token invÃ¡lido (protectAllowPending)",
        module: "auth",
        requestId: req.reqId,
        stack: error.stack,
      });
      res.status(401).json({ message: "No autorizado, token invÃ¡lido" });
    }
  } else {
    res.status(401).json({ message: "No autorizado, sin token" });
  }
};

// Verificar si es admin
export const admin = (req, res, next) => {
  const hasAdminUserRole =
    req.user &&
    (req.user.role === "admin" ||
      req.user.role === "super_admin" ||
      req.user.role === "god");

  const hasAdminMembership =
    req.membership &&
    (req.membership.role === "admin" || req.membership.role === "super_admin");

  if (hasAdminUserRole || hasAdminMembership) {
    next();
  } else {
    logAuthError({
      message: "Acceso denegado. Solo administradores",
      module: "auth",
      requestId: req.reqId,
      userId: req.user?.id,
    });
    res.status(403).json({ message: "Acceso denegado. Solo administradores" });
  }
};

export const god = (req, res, next) => {
  if (req.user && req.user.role === "god") {
    next();
  } else {
    logAuthError({
      message: "Acceso denegado. Solo rol god",
      module: "auth",
      requestId: req.reqId,
      userId: req.user?.id,
    });
    res.status(403).json({ message: "Acceso denegado. Solo rol god" });
  }
};

// Verificar si es empleado
export const employee = (req, res, next) => {
  if (
    req.user &&
    (isEmployeeRole(req.user.role) ||
      req.user.role === "admin" ||
      req.user.role === "super_admin" ||
      req.user.role === "god")
  ) {
    next();
  } else {
    logAuthError({
      message: "Acceso denegado. Solo empleados",
      module: "auth",
      requestId: req.reqId,
      userId: req.user?.id,
    });
    res.status(403).json({ message: "Acceso denegado. Solo empleados" });
  }
};

// Verificar si es admin o empleado
export const adminOrEmployee = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "admin" ||
      isEmployeeRole(req.user.role) ||
      req.user.role === "super_admin" ||
      req.user.role === "god")
  ) {
    next();
  } else {
    logAuthError({
      message: "Acceso denegado",
      module: "auth",
      requestId: req.reqId,
      userId: req.user?.id,
    });
    res.status(403).json({ message: "Acceso denegado" });
  }
};

