import { DefectiveProductRepository } from "../../database/repositories/DefectiveProductRepository.js";

const repository = new DefectiveProductRepository();

export class DefectiveProductController {
  async reportAdmin(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const report = await repository.reportFromAdmin(
        req.body,
        businessId,
        req.user._id,
      );
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async reportDistributor(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const report = await repository.reportFromDistributor(
        req.body,
        businessId,
        req.user._id,
      );
      res.status(201).json({ success: true, data: report });
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
        data: result.reports,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const report = await repository.findById(req.params.id, businessId);

      if (!report) {
        return res
          .status(404)
          .json({ success: false, message: "Reporte no encontrado" });
      }

      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async confirm(req, res) {
    try {
      const businessId = req.businessId;
      const report = await repository.confirmReport(
        req.params.id,
        businessId,
        req.user._id,
        req.body,
      );
      res.json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async reject(req, res) {
    try {
      const businessId = req.businessId;
      const report = await repository.rejectReport(
        req.params.id,
        businessId,
        req.user._id,
        req.body,
      );
      res.json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
