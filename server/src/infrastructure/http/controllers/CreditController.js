import creditPersistenceUseCase from "../../../application/use-cases/repository-gateways/CreditPersistenceUseCase.js";

class CreditController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const credit = await creditPersistenceUseCase.create(
        businessId,
        req.body,
        req.user.id,
      );
      res.status(201).json({ success: true, data: credit });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const {
        status,
        customerId,
        branchId,
        overdue,
        page = 1,
        limit = 50,
      } = req.query;
      const result = await creditPersistenceUseCase.findByBusiness(
        businessId,
        { status, customerId, branchId, overdue },
        page,
        limit,
        req.user.id,
        req.user.role,
      );

      res.json({
        success: true,
        data: result.credits,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.total,
          pages: result.pages,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const credit = await creditPersistenceUseCase.findById(req.params.id, businessId);
      if (!credit)
        return res
          .status(404)
          .json({ success: false, message: "Crédito no encontrado" });

      const payments = await creditPersistenceUseCase.findPayments(credit._id);

      let profitInfo = null;
      if (credit.sale) {
        const sale = credit.sale;
        const quantity = sale.quantity || 1;
        const unitPrice = sale.salePrice || 0;
        const totalSaleAmount = unitPrice * quantity;
        const unitCost = sale.averageCostAtSale || sale.purchasePrice || 0;
        const totalCost = unitCost * quantity;
        const adminProfit = sale.adminProfit || 0;
        const employeeProfit = sale.employeeProfit || 0;
        const totalProfit = sale.totalProfit || adminProfit + employeeProfit;
        const isEmployeeSale = !!sale.employee;
        const profitMarginPercentage =
          totalSaleAmount > 0 ? (totalProfit / totalSaleAmount) * 100 : 0;
        const employeeProfitPercentage =
          totalProfit > 0 ? (employeeProfit / totalProfit) * 100 : 0;

        profitInfo = {
          // Información básica del crédito
          originalAmount: credit.originalAmount,
          paidAmount: credit.paidAmount,
          remainingAmount: credit.remainingAmount,
          isPaidCompletely: credit.status === "paid",
          // Información de la venta asociada
          saleId: sale._id?.toString(),
          productName: sale.productName || sale.product?.name || "Producto",
          quantity,
          unitPrice,
          totalSaleAmount,
          // Costos
          unitCost,
          totalCost,
          // Ganancias
          adminProfit,
          employeeProfit,
          totalProfit,
          employeeProfitPercentage,
          profitMarginPercentage,
          // Información del employee
          isEmployeeSale,
          employeeName: sale.employee?.name || null,
          employeeEmail: sale.employee?.email || null,
          // Estado de realización de la ganancia
          profitRealized: credit.status === "paid",
          realizedProfit: credit.status === "paid" ? totalProfit : 0,
          pendingProfit: credit.status !== "paid" ? totalProfit : 0,
        };
      }

      res.json({ success: true, data: { credit, payments, profitInfo } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async registerPayment(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const { amount, notes } = req.body;
      const result = await creditPersistenceUseCase.registerPayment(
        req.params.id,
        amount,
        notes,
        req.user.id,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getMetrics(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const metrics = await creditPersistenceUseCase.getMetrics(businessId);
      res.json({ success: true, data: metrics });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new CreditController();
