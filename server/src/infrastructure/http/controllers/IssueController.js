import { IssueRepository } from "../../database/repositories/IssueRepository.js";

const repository = new IssueRepository();

export class IssueController {
  async create(req, res) {
    try {
      const { message } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "El mensaje es obligatorio" });
      }

      const report = await repository.create(
        req.body,
        req.user.id,
        req.user.role,
      );
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const result = await repository.findAll(req.query);
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
      const report = await repository.findById(req.params.id);

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

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const report = await repository.updateStatus(req.params.id, status);
      res.json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
