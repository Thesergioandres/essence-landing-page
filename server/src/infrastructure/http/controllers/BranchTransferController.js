import { BranchTransferRepository } from "../../database/repositories/BranchTransferRepository.js";

const repository = new BranchTransferRepository();

export class BranchTransferController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const transfer = await repository.create(
        req.body,
        businessId,
        req.user._id,
      );
      res.status(201).json({ success: true, data: transfer });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.findByBusiness(businessId, req.query);
      res.json({
        success: true,
        data: result.transfers,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const transfer = await repository.findById(req.params.id, businessId);

      if (!transfer) {
        return res
          .status(404)
          .json({ success: false, message: "Transferencia no encontrada" });
      }

      res.json({ success: true, data: transfer });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
