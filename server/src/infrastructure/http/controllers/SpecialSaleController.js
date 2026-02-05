import mongoose from "mongoose";
import SpecialSale from "../../../../models/SpecialSale.js";
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
        return res.status(400).json({
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

  // Stats endpoints - return empty/zero values to prevent 404 errors
  async getStatsOverview(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const { startDate, endDate } = req.query;
      const stats = await SpecialSale.getStatistics(
        startDate,
        endDate,
        businessId,
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getStatsDistribution(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const { startDate, endDate } = req.query;
      const distribution = await SpecialSale.getDistributionByPerson(
        startDate,
        endDate,
        businessId,
      );

      res.json({
        success: true,
        data: distribution,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getStatsTopProducts(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const { startDate, endDate, limit = 10 } = req.query;
      const match = {
        status: "active",
        business: new mongoose.Types.ObjectId(businessId),
      };

      if (startDate || endDate) {
        match.saleDate = {};
        if (startDate) match.saleDate.$gte = new Date(startDate);
        if (endDate) match.saleDate.$lte = new Date(endDate);
      }

      const topProducts = await SpecialSale.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$product.name",
            totalQuantity: { $sum: "$quantity" },
            totalSales: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            totalProfit: { $sum: "$totalProfit" },
            salesCount: { $sum: 1 },
            averagePrice: { $avg: "$specialPrice" },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: Number(limit) || 10 },
      ]);

      res.json({
        success: true,
        data: topProducts,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
