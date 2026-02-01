import ExpenseRepository from "../../database/repositories/ExpenseRepository.js";

class ExpenseController {
  async create(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId && req.user.role !== "super_admin") {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      const expense = await ExpenseRepository.create(
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
      const expenses = await ExpenseRepository.findByBusiness(businessId, {
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

  async update(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const expense = await ExpenseRepository.update(
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

      const expense = await ExpenseRepository.delete(req.params.id, businessId);
      if (!expense)
        return res
          .status(404)
          .json({ success: false, message: "Gasto no encontrado" });

      res.json({ success: true, message: "Gasto eliminado" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new ExpenseController();
