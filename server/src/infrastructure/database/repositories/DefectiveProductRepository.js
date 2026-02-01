import DefectiveProduct from "../../../../models/DefectiveProduct.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import Product from "../../../../models/Product.js";

export class DefectiveProductRepository {
  async reportFromAdmin(data, businessId, userId) {
    const product = await Product.findOne({
      _id: data.productId,
      business: businessId,
    });

    if (!product) {
      const err = new Error("Producto no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (product.warehouseStock < data.quantity) {
      const err = new Error(
        `Stock insuficiente en bodega. Disponible: ${product.warehouseStock}`,
      );
      err.statusCode = 400;
      throw err;
    }

    const lossAmount = data.hasWarranty
      ? 0
      : (product.purchasePrice || 0) * data.quantity;

    const defectiveReport = await DefectiveProduct.create({
      distributor: null,
      product: data.productId,
      business: businessId,
      quantity: data.quantity,
      reason: data.reason,
      images: data.images || [],
      hasWarranty: data.hasWarranty,
      warrantyStatus: data.hasWarranty ? "pending" : "not_applicable",
      lossAmount,
      stockOrigin: "warehouse",
      status: "confirmado",
      confirmedAt: Date.now(),
      confirmedBy: userId,
      adminNotes: data.hasWarranty
        ? "Reporte con garantía - pendiente reposición de stock"
        : "Reporte sin garantía - pérdida registrada",
    });

    product.warehouseStock -= data.quantity;
    await product.save();

    return defectiveReport;
  }

  async reportFromDistributor(data, businessId, distributorId) {
    const product = await Product.findOne({
      _id: data.productId,
      business: businessId,
    });

    if (!product) {
      const err = new Error("Producto no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: data.productId,
      business: businessId,
    });

    if (!distributorStock || distributorStock.quantity < data.quantity) {
      const err = new Error("Stock insuficiente del distribuidor");
      err.statusCode = 400;
      throw err;
    }

    const lossAmount = data.hasWarranty
      ? 0
      : (product.distributorPrice || 0) * data.quantity;

    const defectiveReport = await DefectiveProduct.create({
      distributor: distributorId,
      product: data.productId,
      business: businessId,
      quantity: data.quantity,
      reason: data.reason,
      images: data.images || [],
      hasWarranty: data.hasWarranty,
      warrantyStatus: data.hasWarranty ? "pending" : "not_applicable",
      lossAmount,
      stockOrigin: "distributor",
      status: "pendiente",
    });

    return defectiveReport;
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.distributor) {
      query.distributor = filters.distributor;
    }

    if (filters.stockOrigin) {
      query.stockOrigin = filters.stockOrigin;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      DefectiveProduct.find(query)
        .populate("product", "name image")
        .populate("distributor", "name email")
        .populate("confirmedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DefectiveProduct.countDocuments(query),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    })
      .populate("product", "name image purchasePrice distributorPrice")
      .populate("distributor", "name email")
      .populate("confirmedBy", "name email")
      .lean();

    return report;
  }

  async confirmReport(id, businessId, userId, data) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    });

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (report.status !== "pendiente") {
      const err = new Error("El reporte ya fue procesado");
      err.statusCode = 400;
      throw err;
    }

    report.status = "confirmado";
    report.confirmedAt = Date.now();
    report.confirmedBy = userId;
    report.adminNotes = data.adminNotes;

    if (report.stockOrigin === "distributor") {
      const distributorStock = await DistributorStock.findOne({
        distributor: report.distributor,
        product: report.product,
        business: businessId,
      });

      if (distributorStock) {
        distributorStock.quantity -= report.quantity;
        await distributorStock.save();
      }
    }

    await report.save();
    return report;
  }

  async rejectReport(id, businessId, userId, data) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    });

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (report.status !== "pendiente") {
      const err = new Error("El reporte ya fue procesado");
      err.statusCode = 400;
      throw err;
    }

    report.status = "rechazado";
    report.confirmedAt = Date.now();
    report.confirmedBy = userId;
    report.adminNotes = data.adminNotes;

    await report.save();
    return report;
  }
}
