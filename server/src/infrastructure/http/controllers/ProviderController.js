import { ProviderPersistenceUseCase } from "../../../application/use-cases/repository-gateways/ProviderPersistenceUseCase.js";

const repository = new ProviderPersistenceUseCase();

export class ProviderController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const provider = await repository.create({
        ...req.body,
        business: businessId,
      });
      res.status(201).json({ success: true, data: provider });
    } catch (error) {
      const status = error.code === 11000 ? 409 : 500;
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
        data: result.providers,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const provider = await repository.findById(req.params.id, businessId);

      if (!provider) {
        return res
          .status(404)
          .json({ success: false, message: "Proveedor no encontrado" });
      }

      res.json({ success: true, data: provider });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId;
      const provider = await repository.update(
        req.params.id,
        businessId,
        req.body,
      );
      res.json({ success: true, data: provider });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      await repository.delete(req.params.id, businessId);
      res.json({ success: true, message: "Proveedor eliminado" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
