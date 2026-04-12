import { GamificationPersistenceUseCase } from "../../../application/use-cases/repository-gateways/GamificationPersistenceUseCase.js";

const repository = new GamificationPersistenceUseCase();

export class GamificationController {
  async getAdjustedCommission(req, res) {
    try {
      const { employeeId } = req.params;
      const businessId = req.businessId;

      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const allowedEmployees =
        await repository.getBusinessEmployeeIds(businessId);
      if (
        allowedEmployees.length &&
        !allowedEmployees.some((id) => id.toString() === employeeId)
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Empleado fuera del negocio" });
      }

      const info = await repository.getAdjustedCommission(
        employeeId,
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

  async getEmployeeStats(req, res) {
    try {
      const { employeeId } = req.params;
      const { recalculate } = req.query;
      const businessId = req.businessId;

      if (recalculate === "true" && businessId) {
        await repository.recalculatePoints(businessId, employeeId);
      }
      const stats = await repository.getEmployeeStats(employeeId);
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

      const employeeId = req.body?.employeeId || null;
      const result = await repository.recalculatePoints(
        businessId,
        employeeId,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
