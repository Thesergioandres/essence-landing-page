import { BusinessAssistantRepository } from "../../database/repositories/BusinessAssistantRepository.js";

const repository = new BusinessAssistantRepository();

export class BusinessAssistantController {
  async getConfig(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const config = await repository.getOrCreateConfig(businessId);
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateConfig(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const config = await repository.updateConfig(businessId, req.body);
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async generateRecommendations(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const { horizonDays, recentDays, startDate, endDate } = req.query;

      const result = await repository.generateRecommendations(businessId, {
        horizonDays: horizonDays ? parseInt(horizonDays) : undefined,
        recentDays: recentDays ? parseInt(recentDays) : undefined,
        startDate,
        endDate,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async askAssistant(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const { question } = req.body;
      if (!question) {
        return res
          .status(400)
          .json({ success: false, message: "Falta la pregunta" });
      }

      const response = await repository.askAssistant(businessId, question);
      res.json({ success: true, data: { answer: response } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
