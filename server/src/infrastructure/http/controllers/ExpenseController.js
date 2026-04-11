import expensePersistenceUseCase from "../../../application/use-cases/repository-gateways/ExpensePersistenceUseCase.js";

class ExpenseController {
  async create(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId && req.user.role !== "super_admin") {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      const expense = await expensePersistenceUseCase.create(
        businessId,
        req.body,
        req.user.id,
      );
      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId && req.user.role !== "super_admin") {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      const { startDate, endDate, type, category } = req.query;
      const expenses = await expensePersistenceUseCase.findByBusiness(businessId, {
        startDate,
        endDate,
        type,
        category,
      });

      const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      res.json({ success: true, data: { expenses, total } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createInventoryWithdrawal(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId && req.user.role !== "super_admin") {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      if (!["admin", "super_admin", "god"].includes(req.user.role)) {
        return res
          .status(403)
          .json({ message: "No autorizado para retirar inventario" });
      }

      const expense = await expensePersistenceUseCase.createInventoryWithdrawal(
        businessId,
        req.body,
        req.user.id,
      );

      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      const statusCode = error?.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Error al registrar retiro de inventario",
      });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const expense = await expensePersistenceUseCase.update(
        req.params.id,
        businessId,
        req.body,
      );
      if (!expense)
        return res
          .status(404)
          .json({ success: false, message: "Gasto no encontrado" });

      res.json({ success: true, data: expense });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const expense = await expensePersistenceUseCase.delete(req.params.id, businessId);
      if (!expense)
        return res
          .status(404)
          .json({ success: false, message: "Gasto no encontrado" });

      res.json({ success: true, message: "Gasto eliminado" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async cleanupOrphans(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const result =
        await expensePersistenceUseCase.cleanupOrphanProfitHistory(businessId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new ExpenseController();
