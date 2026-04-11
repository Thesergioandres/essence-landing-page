import stockPersistenceUseCase from "../../../application/use-cases/repository-gateways/StockPersistenceUseCase.js";

class StockController {
  async assignToDistributor(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const { distributorId, productId, quantity } = req.body;
      const result = await stockPersistenceUseCase.assignToDistributor(
        businessId,
        distributorId,
        productId,
        quantity,
      );

      const populated = await result.distStock.populate([
        { path: "distributor", select: "name email" },
        { path: "product", select: "name" },
      ]);

      res.json({
        success: true,
        data: {
          distributorStock: populated,
          warehouseStock: result.product.warehouseStock,
        },
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async withdrawFromDistributor(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const { distributorId, productId, quantity } = req.body;
      const result = await stockPersistenceUseCase.withdrawFromDistributor(
        businessId,
        distributorId,
        productId,
        quantity,
      );

      const populated = await result.stockUpdate.populate([
        { path: "distributor", select: "name email" },
        { path: "product", select: "name" },
      ]);

      res.json({
        success: true,
        data: {
          distributorStock: populated,
          warehouseStock: result.product.warehouseStock,
        },
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async transferBetweenDistributors(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const fromDistributorId =
        req.user?._id || req.user?.id || req.user?.userId;
      const { toDistributorId, productId, quantity } = req.body;

      if (!fromDistributorId || !toDistributorId || !productId || !quantity) {
        return res.status(400).json({ message: "Datos incompletos" });
      }

      const result = await stockPersistenceUseCase.transferBetweenDistributors(
        businessId,
        fromDistributorId,
        toDistributorId,
        productId,
        Number(quantity),
      );

      res.json({
        success: true,
        message: "Transferencia realizada correctamente",
        transfer: {
          from: {
            distributorId: fromDistributorId,
            remainingStock: result.fromStock.quantity,
          },
          to: {
            distributorId: toDistributorId,
            newStock: result.toStock.quantity,
          },
          product: { id: productId },
          quantity: Number(quantity),
        },
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async transferToBranch(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const fromDistributorId =
        req.user?._id || req.user?.id || req.user?.userId;
      const { toBranchId, productId, quantity } = req.body;

      if (!fromDistributorId || !toBranchId || !productId || !quantity) {
        return res.status(400).json({ message: "Datos incompletos" });
      }

      await stockPersistenceUseCase.transferToBranchFromDistributor(
        businessId,
        fromDistributorId,
        toBranchId,
        productId,
        Number(quantity),
      );

      res.json({
        success: true,
        message: "Transferencia a sede realizada correctamente",
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getDistributorStock(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      let { distributorId } = req.params;
      if (distributorId === "me")
        distributorId = req.user.userId || req.user.id;

      const isAdmin = ["admin", "god", "super_admin"].includes(req.user.role);
      const currentUserId = req.user.userId || req.user.id;
      const membershipRole = req.membership?.role;
      const canManageInventoryByMembership =
        membershipRole === "admin" ||
        req.membership?.permissions?.inventory?.update === true ||
        req.membership?.permissions?.inventory?.create === true;

      if (
        !isAdmin &&
        currentUserId !== distributorId &&
        !canManageInventoryByMembership
      ) {
        return res.status(403).json({ message: "Sin permisos" });
      }

      const stock = await stockPersistenceUseCase.getDistributorStock(
        businessId,
        distributorId,
      );
      res.json({ success: true, data: stock });
    } catch (error) {
      console.error("❌ Error in getDistributorStock:", error);
      console.error("Stack:", error.stack);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getBranchStock(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const stock = await stockPersistenceUseCase.getBranchStock(
        businessId,
        req.params.branchId,
      );
      res.json({ success: true, data: stock });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAlerts(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const alerts = await stockPersistenceUseCase.getAlerts(businessId);
      res.json({ success: true, data: alerts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getMyAllowedBranches(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const isDistributor = req.user?.role === "distribuidor";

      const allowedBranches = Array.isArray(req.membership?.allowedBranches)
        ? req.membership.allowedBranches
        : [];

      if (isDistributor && allowedBranches.length === 0) {
        return res.json({ success: true, branches: [] });
      }

      const branches = await stockPersistenceUseCase.getAllowedBranches(
        businessId,
        allowedBranches,
      );

      res.json({ success: true, branches });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getGlobalStock(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      // Usar el método dedicado para inventario global (Agregado)
      const stock = await stockPersistenceUseCase.getGlobalInventory(businessId);
      res.json({ success: true, inventory: stock });
    } catch (error) {
      console.error("Error in getGlobalStock:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async reconcileStock(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const { productId } = req.body;
      if (!productId)
        return res.status(400).json({ message: "productId requerido" });

      const result = await stockPersistenceUseCase.reconcileStock(
        businessId,
        productId,
      );
      res.json({
        success: true,
        message: "Stock reconciliado correctamente",
        data: result,
      });
    } catch (error) {
      console.error("Error in reconcileStock:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async syncProductStock(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const { productId } = req.body;
      if (!productId)
        return res.status(400).json({ message: "productId requerido" });

      const result = await stockPersistenceUseCase.syncProductStock(
        businessId,
        productId,
      );

      res.json({
        success: true,
        message: "Total del sistema sincronizado correctamente",
        data: result,
      });
    } catch (error) {
      console.error("Error in syncProductStock:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getTransferHistory(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const result = await stockPersistenceUseCase.getTransferHistory(
        businessId,
        req.query,
      );

      res.json({
        success: true,
        transfers: result.transfers,
        pagination: result.pagination,
        stats: result.stats,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new StockController();
