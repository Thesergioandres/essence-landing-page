import { DistributorPersistenceUseCase } from "../../../application/use-cases/repository-gateways/DistributorPersistenceUseCase.js";

const repository = new DistributorPersistenceUseCase();

export class DistributorController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const distributor = await repository.create(req.body, businessId);
      res.status(201).json({ success: true, data: distributor });
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
        data: result.distributors,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const distributor = await repository.findById(req.params.id, businessId);
      res.json({ success: true, data: distributor });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId;
      const distributor = await repository.update(
        req.params.id,
        businessId,
        req.body,
      );
      res.json({ success: true, data: distributor });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      const result = await repository.delete(
        req.params.id,
        businessId,
        req.user?.id || req.user?._id,
      );
      res.json({ success: true, data: result, message: result.message });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async toggleActive(req, res) {
    try {
      const businessId = req.businessId;
      const result = await repository.toggleActive(req.params.id, businessId);
      res.json({ success: true, data: result, message: result.message });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async assignProducts(req, res) {
    try {
      const businessId = req.businessId;
      const { productIds } = req.body;

      if (!Array.isArray(productIds)) {
        return res
          .status(400)
          .json({ success: false, message: "productIds debe ser un array" });
      }

      const distributor = await repository.assignProducts(
        req.params.id,
        businessId,
        productIds,
      );
      res.json({ success: true, data: distributor });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getProducts(req, res) {
    try {
      const businessId = req.businessId;
      // Determine distributor ID: if param exists use it (admin view), otherwise use logged in user (distributor view)
      const distributorId = req.params.id || req.user.id;

      const result = await repository.getProducts(
        distributorId,
        businessId,
        req.query,
      );

      // V2 API: devolver objeto completo con products, pagination, total
      res.json({
        success: true,
        data: {
          products: result.products,
          pagination: result.pagination,
          total: result.total,
        },
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getPublicCatalog(req, res) {
    try {
      const { id } = req.params;
      const result = await repository.getPublicCatalog(id);
      res.json({
        success: true,
        products: result.products,
        distributor: result.distributor,
        business: result.business || null,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
