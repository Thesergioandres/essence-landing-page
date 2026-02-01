import { AuditRepository } from "../../database/repositories/AuditRepository.js";

const repository = new AuditRepository();

export class AuditController {
  async getLogs(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const isSuperAdmin = req.user?.role === "super_admin";
      const result = await repository.findLogs(
        businessId,
        isSuperAdmin,
        req.query,
      );

      res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getLogById(req, res) {
    try {
      const businessId = req.businessId;
      const log = await repository.findById(req.params.id, businessId);

      if (!log) {
        return res
          .status(404)
          .json({ success: false, message: "Log no encontrado" });
      }

      res.json({ success: true, data: log });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getStats(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const stats = await repository.getStats(businessId, req.query);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
