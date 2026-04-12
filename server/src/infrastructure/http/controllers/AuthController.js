import { LoginUseCase } from "../../../application/use-cases/LoginUseCase.js";
import { RegisterUserUseCase } from "../../../application/use-cases/RegisterUserUseCase.js";
import { UserPersistenceUseCase } from "../../../application/use-cases/repository-gateways/UserPersistenceUseCase.js";
import Membership from "../../database/models/Membership.js";
import User from "../../database/models/User.js";
import { jwtTokenService } from "../../services/jwtToken.service.js";
import { VALID_BUSINESS_PLANS } from "../../services/planLimits.service.js";

const userRepository = new UserPersistenceUseCase();

/**
 * Get current user profile
 */
export const getProfile = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }

    const user = await userRepository.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("âŒ CRITICAL ERROR in getProfile:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Login Controller (Hexagonal)
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const useCase = new LoginUseCase();
    const result = await useCase.execute(email, password);

    res.json(result);
  } catch (error) {
    if (error.message === "Invalid credentials") {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Register Controller (Hexagonal)
 */
export const register = async (req, res, next) => {
  try {
    const useCase = new RegisterUserUseCase();
    const businessId = req.headers["x-business-id"] || req.body.businessId;

    const result = await useCase.execute({
      ...req.body,
      businessId,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.message === "User already exists") {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token requerido" });
    }

    let decoded;
    try {
      decoded = jwtTokenService.verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ message: "Refresh token invÃ¡lido" });
    }

    const userId = decoded?.id || decoded?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Refresh token invÃ¡lido" });
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const memberships = Array.isArray(user.memberships) ? user.memberships : [];
    const firstMembershipBusiness = memberships[0]?.business;
    const membershipBusinessId =
      typeof firstMembershipBusiness === "string"
        ? firstMembershipBusiness
        : firstMembershipBusiness?._id || null;

    const businessId = decoded?.businessId || membershipBusinessId || null;

    const token = jwtTokenService.generateAccessToken(
      user._id,
      user.role,
      businessId,
    );
    const nextRefreshToken = jwtTokenService.generateRefreshToken(
      user._id,
      user.role,
      businessId,
    );

    return res.json({
      token,
      refreshToken: nextRefreshToken,
      refreshExpiresAt: jwtTokenService.getTokenExpirationIso(nextRefreshToken),
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Logout endpoint (stateless token model)
 */
export const logout = async (_req, res) => {
  return res.json({ success: true, message: "SesiÃ³n cerrada" });
};

/**
 * Save selected plan after registration
 */
export const selectPlan = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { plan } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }

    if (!VALID_BUSINESS_PLANS.includes(plan)) {
      return res.status(400).json({ success: false, message: "Plan invÃ¡lido" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    user.selectedPlan = plan;
    user.selectedPlanAt = new Date();
    await user.save();

    return res.json({
      success: true,
      data: {
        selectedPlan: user.selectedPlan,
        selectedPlanAt: user.selectedPlanAt,
      },
      message: "Plan guardado correctamente",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const impersonateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const requesterId = req.user?.id || req.user?.userId;
    const businessId = req.businessId;

    if (!requesterId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }

    if (!businessId) {
      return res
        .status(400)
        .json({ success: false, message: "Falta x-business-id" });
    }

    const employeeMembership = await Membership.findOne({
      user: employeeId,
      business: businessId,
      role: "employee",
      status: "active",
    })
      .populate("business", "_id name")
      .lean();

    if (!employeeMembership) {
      return res.status(404).json({
        success: false,
        message: "Empleado no encontrado en este negocio",
      });
    }

    const employee = await User.findById(employeeId)
      .select("-password")
      .lean();

    if (!employee || employee.role !== "employee") {
      return res.status(404).json({
        success: false,
        message: "Usuario destino invÃ¡lido para suplantaciÃ³n",
      });
    }

    const memberships = await Membership.find({
      user: employee._id,
      status: "active",
    })
      .populate(
        "business",
        "name description config status logoUrl logoPublicId",
      )
      .lean();

    const token = jwtTokenService.generateAccessToken(
      employee._id,
      employee.role,
      businessId,
    );

    console.warn("[Essence Debug]", 
      `[IMPERSONATION] Admin ${requesterId} estÃ¡ suplantando al empleado ${employee._id} en negocio ${businessId}`,
    );

    return res.json({
      success: true,
      message: "SuplantaciÃ³n iniciada",
      token,
      user: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        status: employee.status,
        active: employee.active,
        subscriptionExpiresAt: employee.subscriptionExpiresAt,
        memberships,
      },
    });
  } catch (error) {
    console.error("âŒ ERROR impersonating employee:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const revertImpersonation = async (req, res) => {
  try {
    const adminOriginalToken =
      req.body?.adminOriginalToken || req.headers["x-admin-original-token"];

    if (!adminOriginalToken) {
      return res.status(400).json({
        success: false,
        message: "Falta admin_original_token para revertir",
      });
    }

    const decoded = jwtTokenService.verifyAccessToken(adminOriginalToken);
    const adminId = decoded?.id || decoded?.userId;
    const businessId = decoded?.businessId || req.businessId || null;

    if (!adminId) {
      return res
        .status(401)
        .json({ success: false, message: "Token original invÃ¡lido" });
    }

    const adminUser = await User.findById(adminId).select("-password").lean();

    if (!adminUser) {
      return res
        .status(404)
        .json({ success: false, message: "Admin original no encontrado" });
    }

    if (!["admin", "super_admin", "god"].includes(adminUser.role)) {
      return res.status(403).json({
        success: false,
        message: "El token original no pertenece a un administrador",
      });
    }

    const memberships = await Membership.find({
      user: adminUser._id,
      status: "active",
    })
      .populate(
        "business",
        "name description config status logoUrl logoPublicId",
      )
      .lean();

    const restoredToken = jwtTokenService.generateAccessToken(
      adminUser._id,
      adminUser.role,
      businessId,
    );

    return res.json({
      success: true,
      message: "SesiÃ³n de administrador restaurada",
      token: restoredToken,
      user: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status,
        active: adminUser.active,
        subscriptionExpiresAt: adminUser.subscriptionExpiresAt,
        memberships,
      },
    });
  } catch (error) {
    console.error("âŒ ERROR reverting impersonation:", error);
    return res.status(401).json({
      success: false,
      message: "No se pudo restaurar la sesiÃ³n original",
    });
  }
};

