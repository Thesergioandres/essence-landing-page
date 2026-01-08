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
import User from "../models/User.js";
import { logApiError, logApiInfo } from "../utils/logger.js";

const addDuration = (baseDate, { days = 0, months = 0, years = 0 }) => {
  const date = new Date(baseDate || Date.now());
  if (years) date.setFullYear(date.getFullYear() + Number(years));
  if (months) date.setMonth(date.getMonth() + Number(months));
  if (days) date.setDate(date.getDate() + Number(days));
  return date;
};

export const listUsers = async (_req, res) => {
  const users = await User.find({}).select("-password").sort({ createdAt: -1 });
  res.json({ success: true, data: users });
};

export const findUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const activateUser = async (req, res) => {
  const { id } = req.params;
  const { days = 30, months = 0, years = 0 } = req.body || {};
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  user.status = "active";
  user.active = true;
  user.subscriptionExpiresAt = addDuration(Date.now(), { days, months, years });
  user.pausedRemainingMs = 0;
  await user.save();
  res.json({ success: true, user });
};

export const suspendUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
  user.status = "suspended";
  user.active = false;
  await user.save();
  res.json({ success: true, user });
};

export const deleteUser = async (req, res) => {
  const requestId = req.reqId || `delete-user-${Date.now()}`;
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ message: "Usuario no encontrado", requestId });

    // Prevenir que un god se elimine a sí mismo
    if (req.user?.id === id) {
      return res
        .status(400)
        .json({ message: "No puedes eliminarte a ti mismo", requestId });
    }

    logApiInfo({
      message: "god_delete_user_started",
      module: "userAccess",
      requestId,
      userId: req.user?.id,
      extra: { targetUserId: id, targetEmail: user.email },
    });

    // Negocios creados por el usuario (solo super admins / creadores)
    const businessIds = await Business.find({ createdBy: user._id }).distinct(
      "_id"
    );

    // Borrar datos atados a esos negocios (cascada completa)
    if (businessIds.length) {
      const deleteResults = await Promise.all([
        // Ventas y finanzas
        Sale.deleteMany({ business: { $in: businessIds } }),
        SpecialSale.deleteMany({ business: { $in: businessIds } }),
        ProfitHistory.deleteMany({ business: { $in: businessIds } }),
        Expense.deleteMany({ business: { $in: businessIds } }),

        // Productos e inventario
        Product.deleteMany({ business: { $in: businessIds } }),
        Category.deleteMany({ business: { $in: businessIds } }),
        Stock.deleteMany({ business: { $in: businessIds } }),
        StockTransfer.deleteMany({ business: { $in: businessIds } }),
        DistributorStock.deleteMany({ business: { $in: businessIds } }),
        InventoryEntry.deleteMany({ business: { $in: businessIds } }),
        DefectiveProduct.deleteMany({ business: { $in: businessIds } }),

        // Sedes y transferencias
        Branch.deleteMany({ business: { $in: businessIds } }),
        BranchStock.deleteMany({ business: { $in: businessIds } }),
        BranchTransfer.deleteMany({ business: { $in: businessIds } }),

        // Clientes y créditos
        Customer.deleteMany({ business: { $in: businessIds } }),
        Credit.deleteMany({ business: { $in: businessIds } }),
        CreditPayment.deleteMany({ business: { $in: businessIds } }),
        Segment.deleteMany({ business: { $in: businessIds } }),

        // Proveedores y promociones
        Provider.deleteMany({ business: { $in: businessIds } }),
        Promotion.deleteMany({ business: { $in: businessIds } }),

        // Distribuidores y gamificación
        DistributorStats.deleteMany({ business: { $in: businessIds } }),
        PeriodWinner.deleteMany({ business: { $in: businessIds } }),
        GamificationConfig.deleteMany({ business: { $in: businessIds } }),

        // Notificaciones e incidencias
        Notification.deleteMany({ business: { $in: businessIds } }),
        IssueReport.deleteMany({ business: { $in: businessIds } }),

        // Configuración y auditoría
        BusinessAssistantConfig.deleteMany({ business: { $in: businessIds } }),
        AuditLog.deleteMany({ business: { $in: businessIds } }),

        // Memberships del negocio
        Membership.deleteMany({ business: { $in: businessIds } }),
      ]);

      // Borrar los negocios
      await Business.deleteMany({ _id: { $in: businessIds } });

      logApiInfo({
        message: "god_delete_user_cascade_complete",
        module: "userAccess",
        requestId,
        extra: {
          businessesDeleted: businessIds.length,
          collectionsAffected: deleteResults.length,
        },
      });
    }

    // Limpiar memberships del usuario en otros negocios
    await Membership.deleteMany({ user: user._id });

    // Eliminar el usuario
    await user.deleteOne();

    logApiInfo({
      message: "god_delete_user_success",
      module: "userAccess",
      requestId,
      extra: { deletedUserId: id, deletedBusinesses: businessIds.length },
    });

    res.json({
      success: true,
      deletedBusinesses: businessIds.length,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "god_delete_user_error",
      module: "userAccess",
      requestId,
      stack: error.stack,
    });
    res.status(500).json({
      message: "Error eliminando usuario",
      error: error.message,
      requestId,
    });
  }
};

export const extendSubscription = async (req, res) => {
  const { id } = req.params;
  const { days = 0, months = 0, years = 0 } = req.body || {};
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const base =
    user.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt) > new Date()
      ? user.subscriptionExpiresAt
      : Date.now();
  user.subscriptionExpiresAt = addDuration(base, { days, months, years });
  user.status = "active";
  user.active = true;
  await user.save();
  res.json({ success: true, user });
};

export const pauseSubscription = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  if (user.status !== "active") {
    return res
      .status(400)
      .json({ message: "Solo se puede pausar desde estado active" });
  }
  if (!user.subscriptionExpiresAt) {
    return res
      .status(400)
      .json({ message: "El usuario no tiene suscripción activa" });
  }

  const remaining = new Date(user.subscriptionExpiresAt).getTime() - Date.now();
  user.pausedRemainingMs = Math.max(0, remaining);
  user.subscriptionExpiresAt = null;
  user.status = "paused";
  user.active = false;
  await user.save();
  res.json({ success: true, user });
};

export const resumeSubscription = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  if (user.status !== "paused") {
    return res
      .status(400)
      .json({ message: "Solo se puede reanudar desde estado paused" });
  }

  const remaining = user.pausedRemainingMs || 0;
  const expiresAt = new Date(Date.now() + remaining);
  user.subscriptionExpiresAt = expiresAt;
  user.pausedRemainingMs = 0;
  user.status = "active";
  user.active = true;
  await user.save();
  res.json({ success: true, user });
};
