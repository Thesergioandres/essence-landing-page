import StockRepository from "../../database/repositories/StockRepository.js";

class StockController {
  async assignToDistributor(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const { distributorId, productId, quantity } = req.body;
      const result = await StockRepository.assignToDistributor(
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
      const result = await StockRepository.withdrawFromDistributor(
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
      if (!isAdmin && currentUserId !== distributorId) {
        return res.status(403).json({ message: "Sin permisos" });
      }

      const stock = await StockRepository.getDistributorStock(
        businessId,
        distributorId,
      );
      res.json({ success: true, data: stock });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getBranchStock(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const stock = await StockRepository.getBranchStock(
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

      const alerts = await StockRepository.getAlerts(businessId);
      res.json({ success: true, data: alerts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new StockController();
