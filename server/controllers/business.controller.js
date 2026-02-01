import AuditLog from "../models/AuditLog.js";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import BranchTransfer from "../models/BranchTransfer.js";
import Business from "../models/Business.js";
import BusinessAssistantConfig from "../models/BusinessAssistantConfig.js";
import Category from "../models/Category.js";
import Credit from "../models/Credit.js";
import CreditPayment from "../models/CreditPayment.js";
import Customer from "../models/Customer.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import DistributorStats from "../models/DistributorStats.js";
import DistributorStock from "../models/DistributorStock.js";
import Expense from "../models/Expense.js";
import GamificationConfig from "../models/GamificationConfig.js";
import InventoryEntry from "../models/InventoryEntry.js";
import IssueReport from "../models/IssueReport.js";
import Membership from "../models/Membership.js";
import Notification from "../models/Notification.js";
import PeriodWinner from "../models/PeriodWinner.js";
import Product from "../models/Product.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Promotion from "../models/Promotion.js";
import Provider from "../models/Provider.js";
import Sale from "../models/Sale.js";
import Segment from "../models/Segment.js";
import SpecialSale from "../models/SpecialSale.js";
import Stock from "../models/Stock.js";
import StockTransfer from "../models/StockTransfer.js";
import { logApiError, logApiInfo } from "../utils/logger.js";

export const createBusiness = async (req, res) => {
  try {
    const {
      name,
      description,
      features,
      contactEmail,
      contactPhone,
      contactWhatsapp,
      contactLocation,
    } = req.body;

    const exists = await Business.findOne({ name });
    if (exists) {
      return res
        .status(400)
        .json({ message: "Ya existe un negocio con ese nombre" });
    }

    const business = await Business.create({
      name,
      description,
      contactEmail,
      contactPhone,
      contactWhatsapp,
      contactLocation,
      config: { features: { ...(features || {}) } },
      createdBy: req.user.id,
    });

    // Asignar al creador como admin del negocio
    await Membership.create({
      user: req.user.id,
      business: business._id,
      role: "admin",
      status: "active",
    });

    res.status(201).json({ business });
  } catch (error) {
    console.error("createBusiness error", error);
    res
      .status(500)
      .json({ message: "Error creando negocio", error: error.message });
  }
};

export const listBusinesses = async (_req, res) => {
  try {
    const businesses = await Business.find().sort({ createdAt: -1 }).lean();
    res.json({ businesses });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error listando negocios", error: error.message });
  }
};

export const getBusinessDetail = async (req, res) => {
  try {
    const business = req.business;
    const members = await Membership.find({ business: business._id })
      .populate("user", "name email role active")
      .lean();

    res.json({ business, members });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error obteniendo negocio", error: error.message });
  }
};

export const updateBusiness = async (req, res) => {
  try {
    const business = req.business;
    const {
      name,
      description,
      contactEmail,
      contactPhone,
      contactWhatsapp,
      contactLocation,
      logoUrl,
      logoPublicId,
    } = req.body;

    if (name) business.name = name;
    if (description !== undefined) business.description = description;
    if (contactEmail !== undefined) business.contactEmail = contactEmail;
    if (contactPhone !== undefined) business.contactPhone = contactPhone;
    if (contactWhatsapp !== undefined)
      business.contactWhatsapp = contactWhatsapp;
    if (contactLocation !== undefined)
      business.contactLocation = contactLocation;
    if (logoUrl !== undefined) business.logoUrl = logoUrl;
    if (logoPublicId !== undefined) business.logoPublicId = logoPublicId;

    await business.save();

    res.json({ business });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error actualizando negocio", error: error.message });
  }
};

export const updateBusinessFeatures = async (req, res) => {
  try {
    const { features } = req.body;
    if (!features || typeof features !== "object") {
      return res.status(400).json({ message: "features es requerido" });
    }

    const business = req.business;
    business.config.features = {
      ...(business.config?.features?.toObject?.() ||
        business.config?.features ||
        {}),
      ...features,
    };
    await business.save();

    res.json({ business });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error actualizando features", error: error.message });
  }
};

export const addMember = async (req, res) => {
  try {
    const { userId, role, permissions, allowedBranches } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ message: "userId y role son requeridos" });
    }

    const membership = await Membership.findOneAndUpdate(
      { user: userId, business: req.businessId },
      {
        role,
        status: "active",
        ...(permissions ? { permissions } : {}),
        ...(Array.isArray(allowedBranches) ? { allowedBranches } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.status(201).json({ membership });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creando miembro", error: error.message });
  }
};

export const updateMember = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { role, status, permissions, allowedBranches } = req.body;

    const membership = await Membership.findOneAndUpdate(
      { _id: membershipId, business: req.businessId },
      {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(permissions ? { permissions } : {}),
        ...(Array.isArray(allowedBranches)
          ? { allowedBranches: allowedBranches.filter((id) => id) }
          : {}),
      },
      { new: true },
    );

    if (!membership) {
      return res.status(404).json({ message: "Membresía no encontrada" });
    }

    res.json({ membership });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error actualizando miembro", error: error.message });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const membership = await Membership.findOneAndDelete({
      _id: membershipId,
      business: req.businessId,
    });

    if (!membership) {
      return res.status(404).json({ message: "Membresía no encontrada" });
    }

    res.json({ message: "Membresía eliminada" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error eliminando miembro", error: error.message });
  }
};

export const deleteBusiness = async (req, res) => {
  const requestId = req.reqId;
  const userId = req.user?.id;

  try {
    const { businessId } = req.params;

    const business = await Business.findById(businessId);
    if (!business) {
      return res
        .status(404)
        .json({ message: "Negocio no encontrado", requestId });
    }

    logApiInfo({
      message: "delete_business_cascade_started",
      module: "business",
      requestId,
      userId,
      businessId,
    });

    // CASCADA COMPLETA: Eliminar todas las entidades relacionadas
    const deleteResults = await Promise.all([
      // Ventas y finanzas
      Sale.deleteMany({ business: businessId }),
      SpecialSale.deleteMany({ business: businessId }),
      ProfitHistory.deleteMany({ business: businessId }),
      Expense.deleteMany({ business: businessId }),

      // Productos e inventario
      Product.deleteMany({ business: businessId }),
      Category.deleteMany({ business: businessId }),
      Stock.deleteMany({ business: businessId }),
      StockTransfer.deleteMany({ business: businessId }),
      DistributorStock.deleteMany({ business: businessId }),
      InventoryEntry.deleteMany({ business: businessId }),
      DefectiveProduct.deleteMany({ business: businessId }),

      // Sedes y transferencias
      Branch.deleteMany({ business: businessId }),
      BranchStock.deleteMany({ business: businessId }),
      BranchTransfer.deleteMany({ business: businessId }),

      // Clientes y créditos
      Customer.deleteMany({ business: businessId }),
      Credit.deleteMany({ business: businessId }),
      CreditPayment.deleteMany({ business: businessId }),
      Segment.deleteMany({ business: businessId }),

      // Proveedores y promociones
      Provider.deleteMany({ business: businessId }),
      Promotion.deleteMany({ business: businessId }),

      // Distribuidores y gamificación
      DistributorStats.deleteMany({ business: businessId }),
      PeriodWinner.deleteMany({ business: businessId }),
      GamificationConfig.deleteMany({ business: businessId }),

      // Notificaciones e incidencias
      Notification.deleteMany({ business: businessId }),
      IssueReport.deleteMany({ business: businessId }),

      // Configuración y auditoría
      BusinessAssistantConfig.deleteMany({ business: businessId }),
      AuditLog.deleteMany({ business: businessId }),

      // Memberships del negocio
      Membership.deleteMany({ business: businessId }),
    ]);

    // Finalmente eliminar el negocio
    await business.deleteOne();

    logApiInfo({
      message: "delete_business_cascade_complete",
      module: "business",
      requestId,
      userId,
      businessId,
      extra: {
        businessName: business.name,
        collectionsAffected: deleteResults.length,
      },
    });

    res.json({
      success: true,
      message: "Negocio y todos sus datos eliminados",
      businessId,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "delete_business_error",
      module: "business",
      requestId,
      userId,
      businessId: req.params.businessId,
      stack: error.stack,
    });
    res
      .status(500)
      .json({ message: "Error eliminando negocio", error: error.message });
  }
};

export const listMembers = async (req, res) => {
  try {
    const members = await Membership.find({ business: req.businessId })
      .populate("user", "name email role active")
      .lean();
    res.json({ members });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error listando miembros", error: error.message });
  }
};

export const getMyMemberships = async (req, res) => {
  try {
    // 👁️ OMNISCIENCE: God sees all businesses as if they were their own
    if (req.user?.role === "god") {
      const businesses = await Business.find()
        .select(
          "name description config status contactEmail contactPhone contactWhatsapp contactLocation metadata logoUrl logoPublicId",
        )
        .sort({ createdAt: -1 })
        .lean();

      const memberships = businesses.map((b) => ({
        _id: `god_${b._id}`,
        business: b,
        user: req.user.id,
        role: "god",
        status: "active",
      }));

      return res.json({ memberships });
    }

    const memberships = await Membership.find({
      user: req.user.id,
      status: "active",
    })
      .populate(
        "business",
        "name description config status contactEmail contactPhone contactWhatsapp contactLocation metadata logoUrl logoPublicId",
      )
      .lean();
    res.json({ memberships });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error obteniendo membresías", error: error.message });
  }
};
