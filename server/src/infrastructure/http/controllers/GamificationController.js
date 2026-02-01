import { GamificationRepository } from "../../database/repositories/GamificationRepository.js";

const repository = new GamificationRepository();

export class GamificationController {
  async getAdjustedCommission(req, res) {
    try {
      const { distributorId } = req.params;
      const businessId = req.businessId;

      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const allowedDistributors =
        await repository.getBusinessDistributorIds(businessId);
      if (
        allowedDistributors.length &&
        !allowedDistributors.some((id) => id.toString() === distributorId)
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Distribuidor fuera del negocio" });
      }

      const info = await repository.getAdjustedCommission(
        distributorId,
        businessId,
      );
      res.json({ success: true, data: info });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async checkAndEvaluatePeriod(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.checkAndEvaluatePeriod(businessId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getConfig(req, res) {
    try {
      const config = await repository.getConfig();
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateConfig(req, res) {
    try {
      const config = await repository.updateConfig(req.body);
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getRanking(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const { period = "current" } = req.query;
      const result = await repository.getRanking(businessId, period);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getDistributorStats(req, res) {
    try {
      const { distributorId } = req.params;
      const stats = await repository.getDistributorStats(distributorId);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
