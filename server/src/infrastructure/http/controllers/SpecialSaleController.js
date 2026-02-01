import { SpecialSaleRepository } from "../../database/repositories/SpecialSaleRepository.js";

const repository = new SpecialSaleRepository();

export class SpecialSaleController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const { product, quantity, specialPrice, cost } = req.body;

      if (!product || !product.name) {
        return res
          .status(400)
          .json({
            success: false,
            message: "El nombre del producto es requerido",
          });
      }

      if (!quantity || quantity < 1) {
        return res
          .status(400)
          .json({ success: false, message: "La cantidad debe ser al menos 1" });
      }

      if (specialPrice === undefined || specialPrice < 0) {
        return res
          .status(400)
          .json({ success: false, message: "El precio especial es requerido" });
      }

      if (cost === undefined || cost < 0) {
        return res
          .status(400)
          .json({ success: false, message: "El costo es requerido" });
      }

      const sale = await repository.create(req.body, businessId, req.user.id);
      res.status(201).json({ success: true, data: sale });
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
        data: result.sales,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const sale = await repository.findById(req.params.id, businessId);

      if (!sale) {
        return res
          .status(404)
          .json({ success: false, message: "Venta especial no encontrada" });
      }

      res.json({ success: true, data: sale });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId;
      const sale = await repository.update(req.params.id, businessId, req.body);
      res.json({ success: true, data: sale });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      await repository.delete(req.params.id, businessId);
      res.json({ success: true, message: "Venta especial eliminada" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
