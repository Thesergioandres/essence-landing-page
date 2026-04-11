import { PromotionPersistenceUseCase } from "../../../application/use-cases/repository-gateways/PromotionPersistenceUseCase.js";

const repository = new PromotionPersistenceUseCase();

export class PromotionController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const promotion = await repository.create(req.body, businessId);
      res.status(201).json({ success: true, data: promotion });
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
        data: result.promotions,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const promotion = await repository.findById(req.params.id, businessId);

      if (!promotion) {
        return res
          .status(404)
          .json({ success: false, message: "Promoción no encontrada" });
      }

      res.json({ success: true, data: promotion });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId;
      const promotion = await repository.update(
        req.params.id,
        businessId,
        req.body,
      );
      res.json({ success: true, data: promotion });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      await repository.delete(req.params.id, businessId);
      res.json({ success: true, message: "Promoción eliminada" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getActive(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const promotions = await repository.findActive(businessId);
      res.json({ success: true, data: promotions });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async evaluate(req, res) {
    try {
      const businessId = req.businessId;
      const promotion = await repository.findById(req.params.id, businessId);

      if (!promotion) {
        return res
          .status(404)
          .json({ success: false, message: "Promoción no encontrada" });
      }

      const result = repository.evaluatePromotion(promotion, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async toggleStatus(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const promotion = await repository.findById(req.params.id, businessId);
      if (!promotion) {
        return res
          .status(404)
          .json({ success: false, message: "Promoción no encontrada" });
      }

      const nextStatus = promotion.status === "active" ? "paused" : "active";
      const updated = await repository.update(req.params.id, businessId, {
        status: nextStatus,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
