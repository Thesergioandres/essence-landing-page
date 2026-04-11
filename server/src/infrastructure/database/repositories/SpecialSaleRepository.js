import Membership from "../models/Membership.js";
import ProfitHistory from "../models/ProfitHistory.js";
import SpecialSale from "../models/SpecialSale.js";

export class SpecialSaleRepository {
  async create(data, businessId, userId) {
    const totalRevenue = data.quantity * data.specialPrice;
    const totalCost = data.quantity * data.cost;
    const totalProfit = totalRevenue - totalCost;
    const distribution = Array.isArray(data.distribution)
      ? data.distribution
      : [];
    const distributionSum = distribution.reduce(
      (sum, dist) => sum + (Number(dist.amount) || 0),
      0,
    );
    const remainingProfit = Math.max(totalProfit - distributionSum, 0);

    const specialSale = await SpecialSale.create({
      business: businessId,
      product: {
        name: data.product.name,
        productId: data.product.productId,
        category: data.product.category,
        image: data.product.image,
      },
      quantity: data.quantity,
      specialPrice: data.specialPrice,
      cost: data.cost,
      totalProfit,
      distribution,
      observations: data.observations,
      eventName: data.eventName,
      saleDate: data.saleDate || new Date(),
      createdBy: userId,
      status: "active",
    });

    const adminMembership = await Membership.findOne({
      business: businessId,
      role: "admin",
      status: "active",
    })
      .select("user")
      .lean();

    if (totalProfit > 0 && distribution.length > 0) {
      for (const dist of distribution) {
        const distUserId = dist.distributorId || dist.user || dist.userId;
        const distAmount = Number(dist.amount) || 0;
        if (distUserId && distAmount > 0) {
          await ProfitHistory.create({
            business: businessId,
            user: distUserId,
            type: "venta_especial",
            amount: distAmount,
            specialSale: specialSale._id,
            product: data.product.productId || undefined,
            description: data.eventName
              ? `Comisión venta especial (${data.eventName})`
              : `Comisión venta especial: ${data.product.name}`,
            date: data.saleDate || new Date(),
            metadata: {
              eventName: data.eventName,
              quantity: data.quantity,
              specialPrice: data.specialPrice,
              cost: data.cost,
              commission: distAmount,
              percentage: dist.percentage,
              specialSaleId: specialSale._id,
            },
          });
        }
      }
    }

    if (remainingProfit > 0 && adminMembership?.user) {
      await ProfitHistory.create({
        business: businessId,
        user: adminMembership.user,
        type: "venta_especial",
        amount: remainingProfit,
        specialSale: specialSale._id,
        product: data.product.productId || undefined,
        description: data.eventName
          ? `Ganancia venta especial (${data.eventName})`
          : `Ganancia venta especial: ${data.product.name}`,
        date: data.saleDate || new Date(),
        metadata: {
          eventName: data.eventName,
          quantity: data.quantity,
          specialPrice: data.specialPrice,
          cost: data.cost,
          specialSaleId: specialSale._id,
        },
      });
    }

    return specialSale;
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.eventName) {
      query.eventName = { $regex: filters.eventName, $options: "i" };
    }

    if (filters.startDate || filters.endDate) {
      query.saleDate = {};
      if (filters.startDate) {
        query.saleDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.saleDate.$lte = new Date(filters.endDate);
      }
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      SpecialSale.find(query)
        .populate("createdBy", "name email")
        .sort({ saleDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SpecialSale.countDocuments(query),
    ]);

    return {
      sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const sale = await SpecialSale.findOne({ _id: id, business: businessId })
      .populate("createdBy", "name email")
      .lean();

    return sale;
  }

  async update(id, businessId, data) {
    const sale = await SpecialSale.findOne({ _id: id, business: businessId });

    if (!sale) {
      const err = new Error("Venta especial no encontrada");
      err.statusCode = 404;
      throw err;
    }

    if (data.observations !== undefined) {
      sale.observations = data.observations;
    }

    if (data.status) {
      sale.status = data.status;
    }

    await sale.save();
    return sale;
  }

  async delete(id, businessId) {
    const sale = await SpecialSale.findOneAndDelete({
      _id: id,
      business: businessId,
    });

    if (!sale) {
      const err = new Error("Venta especial no encontrada");
      err.statusCode = 404;
      throw err;
    }

    await ProfitHistory.deleteMany({ sourceId: id, source: "special_sale" });

    return sale;
  }
}
