import CreditRepository from "../../database/repositories/CreditRepository.js";

class CreditController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const credit = await CreditRepository.create(
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
      const result = await CreditRepository.findByBusiness(
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

      const credit = await CreditRepository.findById(req.params.id, businessId);
      if (!credit)
        return res
          .status(404)
          .json({ success: false, message: "Crédito no encontrado" });

      const payments = await CreditRepository.findPayments(credit._id);

      let profitInfo = null;
      if (credit.sale) {
        const sale = credit.sale;
        const totalSaleAmount = (sale.salePrice || 0) * (sale.quantity || 1);
        const totalCost =
          (sale.averageCostAtSale || sale.purchasePrice || 0) *
          (sale.quantity || 1);
        profitInfo = {
          originalAmount: credit.originalAmount,
          paidAmount: credit.paidAmount,
          remainingAmount: credit.remainingAmount,
          totalProfit: sale.totalProfit || 0,
          profitRealized: credit.status === "paid",
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
      const result = await CreditRepository.registerPayment(
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

      const metrics = await CreditRepository.getMetrics(businessId);
      res.json({ success: true, data: metrics });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new CreditController();
