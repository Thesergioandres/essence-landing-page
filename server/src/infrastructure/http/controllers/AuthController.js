import jwt from "jsonwebtoken";
import Membership from "../../../../models/Membership.js";
import User from "../../../../models/User.js";
import { LoginUseCase } from "../../../application/use-cases/LoginUseCase.js";
import { RegisterUserUseCase } from "../../../application/use-cases/RegisterUserUseCase.js";
import { AuthService } from "../../../domain/services/AuthService.js";

/**
 * Get current user profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("❌ CRITICAL ERROR in getProfile:", error);
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
 * Note: Assuming public registration or protected by admin logic depending on route
 */
export const register = async (req, res, next) => {
  try {
    const useCase = new RegisterUserUseCase();
    // businessId might come from headers if SaaS or body if simple logic
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

export const impersonateDistributor = async (req, res) => {
  try {
    const { distributorId } = req.params;
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

    const distributorMembership = await Membership.findOne({
      user: distributorId,
      business: businessId,
      role: "distribuidor",
      status: "active",
    })
      .populate("business", "_id name")
      .lean();

    if (!distributorMembership) {
      return res.status(404).json({
        success: false,
        message: "Distribuidor no encontrado en este negocio",
      });
    }

    const distributor = await User.findById(distributorId)
      .select("-password")
      .lean();

    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(404).json({
        success: false,
        message: "Usuario destino inválido para suplantación",
      });
    }

    const memberships = await Membership.find({
      user: distributor._id,
      status: "active",
    })
      .populate(
        "business",
        "name description config status logoUrl logoPublicId",
      )
      .lean();

    const token = AuthService.generateToken(
      distributor._id,
      distributor.role,
      businessId,
    );

    console.log(
      `[IMPERSONATION] Admin ${requesterId} está suplantando al distribuidor ${distributor._id} en negocio ${businessId}`,
    );

    return res.json({
      success: true,
      message: "Suplantación iniciada",
      token,
      user: {
        _id: distributor._id,
        name: distributor.name,
        email: distributor.email,
        role: distributor.role,
        status: distributor.status,
        active: distributor.active,
        subscriptionExpiresAt: distributor.subscriptionExpiresAt,
        memberships,
      },
    });
  } catch (error) {
    console.error("❌ ERROR impersonating distributor:", error);
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

    const decoded = jwt.verify(adminOriginalToken, process.env.JWT_SECRET);
    const adminId = decoded?.id || decoded?.userId;
    const businessId = decoded?.businessId || req.businessId || null;

    if (!adminId) {
      return res
        .status(401)
        .json({ success: false, message: "Token original inválido" });
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

    const restoredToken = AuthService.generateToken(
      adminUser._id,
      adminUser.role,
      businessId,
    );

    return res.json({
      success: true,
      message: "Sesión de administrador restaurada",
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
    console.error("❌ ERROR reverting impersonation:", error);
    return res.status(401).json({
      success: false,
      message: "No se pudo restaurar la sesión original",
    });
  }
};
