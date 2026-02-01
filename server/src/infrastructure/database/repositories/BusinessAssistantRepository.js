import mongoose from "mongoose";
import BusinessAssistantConfig from "../../../../models/BusinessAssistantConfig.js";
import Category from "../../../../models/Category.js";
import Product from "../../../../models/Product.js";
import Sale from "../../../../models/Sale.js";
import { aiService } from "../../../../services/ai.service.js";

export class BusinessAssistantRepository {
  async getOrCreateConfig(businessId) {
    let config = businessId
      ? await BusinessAssistantConfig.findOne({ business: businessId })
      : await BusinessAssistantConfig.findOne({
          $or: [{ business: { $exists: false } }, { business: null }],
        });

    if (!config && businessId) {
      const fallback = await BusinessAssistantConfig.findOne({
        $or: [{ business: { $exists: false } }, { business: null }],
      });

      if (fallback) {
        const payload = fallback.toObject();
        delete payload._id;
        delete payload.createdAt;
        delete payload.updatedAt;
        delete payload.__v;
        config = await BusinessAssistantConfig.create({
          ...payload,
          business: businessId,
        });
      }
    }

    if (!config) {
      config = await BusinessAssistantConfig.create({ business: businessId });
    }

    return config;
  }

  async generateRecommendations(businessId, params = {}) {
    if (!businessId) {
      throw new Error("Falta el negocio para generar recomendaciones");
    }

    const businessObjectId = new mongoose.Types.ObjectId(String(businessId));
    const config = await this.getOrCreateConfig(businessId);

    const horizonDays = params.horizonDays || config.horizonDaysDefault || 90;
    const recentDays = params.recentDays || config.recentDaysDefault || 30;

    const now = new Date();
    const horizonDate = new Date(
      now.getTime() - horizonDays * 24 * 60 * 60 * 1000,
    );
    const recentDate = new Date(
      now.getTime() - recentDays * 24 * 60 * 60 * 1000,
    );

    const [products, sales, categories] = await Promise.all([
      Product.find({ business: businessObjectId }).lean(),
      Sale.find({
        business: businessObjectId,
        saleDate: { $gte: horizonDate },
        paymentStatus: "confirmado",
      }).lean(),
      Category.find({ business: businessObjectId }).lean(),
    ]);

    const recommendations = [];

    for (const product of products) {
      const productSales = sales.filter(
        (s) => s.product.toString() === product._id.toString(),
      );
      const recentSales = productSales.filter((s) => s.saleDate >= recentDate);

      if (product.stock < 10 && recentSales.length > 0) {
        recommendations.push({
          type: "inventory",
          priority: "high",
          productId: product._id,
          productName: product.name,
          action: "buy_more_inventory",
          reason: `Stock bajo (${product.stock} unidades) con ventas recientes`,
          suggestedQuantity: Math.max(20, recentSales.length * 2),
        });
      }

      if (product.stock > 50 && recentSales.length === 0) {
        recommendations.push({
          type: "inventory",
          priority: "medium",
          productId: product._id,
          productName: product.name,
          action: "pause_purchases",
          reason: `Stock alto (${product.stock} unidades) sin ventas recientes`,
        });
      }

      const avgSalePrice =
        productSales.length > 0
          ? productSales.reduce((sum, s) => sum + s.salePrice, 0) /
            productSales.length
          : 0;

      if (avgSalePrice > 0 && product.salePrice < avgSalePrice * 0.9) {
        recommendations.push({
          type: "pricing",
          priority: "low",
          productId: product._id,
          productName: product.name,
          action: "adjust_price",
          reason: "Precio actual por debajo del promedio histórico",
          currentPrice: product.salePrice,
          suggestedPrice: Math.round(avgSalePrice * 0.95),
        });
      }
    }

    return {
      recommendations,
      metadata: {
        generatedAt: now,
        horizonDays,
        recentDays,
        productsAnalyzed: products.length,
        salesAnalyzed: sales.length,
      },
    };
  }

  async updateConfig(businessId, data) {
    let config = await BusinessAssistantConfig.findOne({
      business: businessId,
    });

    if (!config) {
      config = await BusinessAssistantConfig.create({
        ...data,
        business: businessId,
      });
    } else {
      Object.assign(config, data);
      await config.save();
    }

    return config;
  }

  async askAssistant(businessId, question) {
    if (!aiService || !aiService.generateAssistantResponse) {
      throw new Error("AI Service no disponible");
    }

    const businessObjectId = new mongoose.Types.ObjectId(String(businessId));

    const [products, sales] = await Promise.all([
      Product.find({ business: businessObjectId }).limit(50).lean(),
      Sale.find({ business: businessObjectId })
        .sort({ saleDate: -1 })
        .limit(100)
        .lean(),
    ]);

    const context = {
      totalProducts: products.length,
      totalSales: sales.length,
      topProducts: products
        .slice(0, 5)
        .map((p) => ({ name: p.name, stock: p.stock })),
    };

    const response = await aiService.generateAssistantResponse(
      question,
      context,
    );
    return response;
  }
}
