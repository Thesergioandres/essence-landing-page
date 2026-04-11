import { GamificationPersistenceUseCase } from "../../../application/use-cases/repository-gateways/GamificationPersistenceUseCase.js";

const repository = new GamificationPersistenceUseCase();

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

      const result = await repository.getRanking(businessId, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getDistributorStats(req, res) {
    try {
      const { distributorId } = req.params;
      const { recalculate } = req.query;
      const businessId = req.businessId;

      if (recalculate === "true" && businessId) {
        await repository.recalculatePoints(businessId, distributorId);
      }
      const stats = await repository.getDistributorStats(distributorId);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getWinners(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.getWinners(businessId, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async markBonusPaid(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const winner = await repository.markBonusPaid(businessId, req.params.id);

      if (!winner) {
        return res
          .status(404)
          .json({ success: false, message: "Ganador no encontrado" });
      }

      res.json({ success: true, data: winner });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async recalculatePoints(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const distributorId = req.body?.distributorId || null;
      const result = await repository.recalculatePoints(
        businessId,
        distributorId,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
