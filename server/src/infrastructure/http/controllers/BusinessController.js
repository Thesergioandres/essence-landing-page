import { BusinessPersistenceUseCase } from "../../../application/use-cases/repository-gateways/BusinessPersistenceUseCase.js";
import Membership from "../../database/models/Membership.js";
import User from "../../database/models/User.js";

const repository = new BusinessPersistenceUseCase();
const ALLOWED_MEMBER_ROLES = new Set(["admin", "employee", "viewer"]);
const ROLES_AUTORIZADOS_COMISION_FIJA = new Set([
  "admin",
  "super_admin",
  "god",
]);
const ALLOWED_PERMISSION_MODULES = new Set([
  "products",
  "inventory",
  "sales",
  "promotions",
  "providers",
  "clients",
  "expenses",
  "analytics",
  "config",
  "transfers",
  "financial",
]);
const CANONICAL_PERMISSION_ACTIONS = new Set([
  "read",
  "create",
  "update",
  "delete",
  "view_costs",
]);

const normalizePermissionAction = (actionKey) => {
  const normalized = String(actionKey || "").trim();
  if (!normalized) return "";

  if (normalized === "view") return "read";
  if (normalized === "edit") return "update";
  if (normalized === "viewCosts") return "view_costs";

  return normalized;
};

const sanitizePermissions = (permissions) => {
  if (
    !permissions ||
    typeof permissions !== "object" ||
    Array.isArray(permissions)
  ) {
    return {};
  }

  const sanitized = {};

  for (const [moduleKey, modulePermissions] of Object.entries(permissions)) {
    if (!ALLOWED_PERMISSION_MODULES.has(moduleKey)) continue;
    if (!modulePermissions || typeof modulePermissions !== "object") continue;

    const moduleSanitized = {};
    for (const [actionKey, value] of Object.entries(modulePermissions)) {
      const normalizedAction = normalizePermissionAction(actionKey);
      if (!CANONICAL_PERMISSION_ACTIONS.has(normalizedAction)) continue;
      moduleSanitized[normalizedAction] = value === true;
    }

    sanitized[moduleKey] = moduleSanitized;
  }

  return sanitized;
};

export class BusinessController {
  async create(req, res) {
    try {
      const business = await repository.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: business });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const businesses = await repository.findAll();
      res.json({ success: true, data: businesses });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const result = await repository.findWithMembers(req.params.id);
      if (!result.business) {
        return res
          .status(404)
          .json({ success: false, message: "Negocio no encontrado" });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async checkSlugAvailability(req, res) {
    try {
      const slugCandidate = String(req.query?.slug || "");
      const result = await repository.checkSlugAvailability(
        slugCandidate,
        req.business?._id || req.params.id,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const business = await repository.update(req.business._id, req.body);
      res.json({ success: true, data: business });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async updateFeatures(req, res) {
    try {
      const { features } = req.body;
      if (!features || typeof features !== "object") {
        return res
          .status(400)
          .json({ success: false, message: "features es requerido" });
      }

      const business = await repository.updateFeatures(
        req.business._id,
        features,
      );
      res.json({ success: true, data: business });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async addMember(req, res) {
    try {
      const { userId, role, permissions, allowedBranches } = req.body;
      if (!userId || !role) {
        return res
          .status(400)
          .json({ success: false, message: "userId y role son requeridos" });
      }

      if (!ALLOWED_MEMBER_ROLES.has(role)) {
        return res.status(400).json({
          success: false,
          message: "Rol invÃ¡lido para miembro del equipo",
        });
      }

      const targetUser = await User.findById(userId).select("_id").lean();
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      const sanitizedPermissions = sanitizePermissions(permissions);

      const membership = await repository.addMember(req.businessId, {
        userId,
        role,
        permissions: sanitizedPermissions,
        allowedBranches,
      });

      if (Object.keys(sanitizedPermissions).length > 0) {
        await User.findByIdAndUpdate(userId, {
          $set: { modularPermissions: sanitizedPermissions },
        });
      }

      res.status(201).json({ success: true, data: membership });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async findUserByEmail(req, res) {
    try {
      const rawEmail = decodeURIComponent(req.params.email || "").trim();
      const normalizedEmail = rawEmail.toLowerCase();

      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return res.status(400).json({
          success: false,
          message: "Email invÃ¡lido",
        });
      }

      const user = await User.findOne({ email: normalizedEmail })
        .select("_id name email role active status")
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      const existingMembership = await Membership.findOne({
        business: req.businessId,
        user: user._id,
        status: "active",
      })
        .select("_id role")
        .lean();

      return res.json({
        success: true,
        data: {
          user,
          alreadyMember: Boolean(existingMembership),
          membership: existingMembership || null,
        },
      });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async updateMember(req, res) {
    try {
      const existingMembership = await Membership.findOne({
        _id: req.params.membershipId,
        business: req.businessId,
      })
        .select("_id role status user")
        .lean();

      if (!existingMembership) {
        return res.status(404).json({
          success: false,
          message: "Miembro no encontrado",
        });
      }

      const requestedRole = req.body?.role;
      if (requestedRole && !ALLOWED_MEMBER_ROLES.has(requestedRole)) {
        return res.status(400).json({
          success: false,
          message: "Rol invÃ¡lido para miembro del equipo",
        });
      }

      const puedeConfigurarComisionFija = ROLES_AUTORIZADOS_COMISION_FIJA.has(
        req.user?.role,
      );

      if (req.body?.commissionSettings && !puedeConfigurarComisionFija) {
        return res.status(403).json({
          success: false,
          message:
            "Solo admin, super_admin o god pueden modificar comisiÃ³n fija blindada",
        });
      }

      if (requestedRole && requestedRole !== existingMembership.role) {
        if (
          String(existingMembership.user) === String(req.user?.id) &&
          existingMembership.role === "admin" &&
          requestedRole !== "admin"
        ) {
          return res.status(400).json({
            success: false,
            message: "No puedes bajar tu propio rol de administrador",
          });
        }

        if (
          existingMembership.role === "admin" &&
          existingMembership.status === "active" &&
          requestedRole !== "admin"
        ) {
          const remainingAdmins = await Membership.countDocuments({
            business: req.businessId,
            role: "admin",
            status: "active",
            _id: { $ne: existingMembership._id },
          });

          if (remainingAdmins < 1) {
            return res.status(400).json({
              success: false,
              message: "Debe permanecer al menos un administrador activo",
            });
          }
        }
      }

      const updatePayload = {
        ...req.body,
        ...(req.body?.permissions
          ? { permissions: sanitizePermissions(req.body.permissions) }
          : {}),
      };

      console.warn("[Essence Debug]", 
        `[BusinessController] updateMember calling for business: ${req.businessId}, member: ${req.params.membershipId}`,
      );
      console.warn("[Essence Debug]", 
        `[BusinessController] Payload:`,
        JSON.stringify(updatePayload),
      );

      const membership = await repository.updateMember(
        req.businessId,
        req.params.membershipId,
        updatePayload,
      );

      if (updatePayload?.commissionSettings && puedeConfigurarComisionFija) {
        const targetUserId =
          typeof membership?.user === "object"
            ? membership.user?._id
            : membership?.user;

        if (targetUserId) {
          const rawRate = Number(
            updatePayload.commissionSettings.customCommissionRate,
          );
          const fixedEnabled = Boolean(
            updatePayload.commissionSettings.fixedCommissionOnly,
          );
          const customCommissionRate = Number.isFinite(rawRate)
            ? Math.max(0, Math.min(95, rawRate))
            : null;

          await User.findByIdAndUpdate(targetUserId, {
            $set: {
              fixedCommissionOnly: fixedEnabled,
              isCommissionFixed: fixedEnabled,
              customCommissionRate: fixedEnabled ? customCommissionRate : null,
            },
          });
        }
      }

      if (updatePayload?.permissions && existingMembership?.user) {
        await User.findByIdAndUpdate(existingMembership.user, {
          $set: { modularPermissions: updatePayload.permissions },
        });
      }

      const refreshedMembership = await Membership.findOne({
        _id: req.params.membershipId,
        business: req.businessId,
      }).populate(
        "user",
        "name email role active fixedCommissionOnly isCommissionFixed customCommissionRate",
      );

      res.json({ success: true, data: refreshedMembership || membership });
    } catch (error) {
      console.error(`[BusinessController] Error updating member:`, error);
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async removeMember(req, res) {
    try {
      const membership = await Membership.findOne({
        _id: req.params.membershipId,
        business: req.businessId,
      })
        .select("_id role status user")
        .lean();

      if (!membership) {
        return res.status(404).json({
          success: false,
          message: "Miembro no encontrado",
        });
      }

      if (String(membership.user) === String(req.user?.id)) {
        return res.status(400).json({
          success: false,
          message: "No puedes eliminar tu propio acceso",
        });
      }

      if (membership.role === "admin" && membership.status === "active") {
        const remainingAdmins = await Membership.countDocuments({
          business: req.businessId,
          role: "admin",
          status: "active",
          _id: { $ne: membership._id },
        });

        if (remainingAdmins < 1) {
          return res.status(400).json({
            success: false,
            message: "Debe permanecer al menos un administrador activo",
          });
        }
      }

      await repository.removeMember(req.businessId, req.params.membershipId);
      res.json({ success: true, message: "Miembro eliminado" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getMembers(req, res) {
    try {
      const members = await repository.getMembers(req.businessId);
      res.json({ success: true, data: members });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getMyMemberships(req, res) {
    try {
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ success: false, message: "No autorizado" });
      }

      const memberships = await repository.getUserMemberships(req.user.id);
      res.json({ success: true, data: { memberships } });
    } catch (error) {
      console.error("âŒ CRITICAL ERROR in getMyMemberships:", error);
      console.error("User ID:", req.user?._id);
      console.error("Stack:", error.stack);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

