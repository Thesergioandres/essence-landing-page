import ProfitHistory from "../../../../models/ProfitHistory.js";
import SpecialSale from "../../../../models/SpecialSale.js";

export class SpecialSaleRepository {
  async create(data, businessId, userId) {
    const totalRevenue = data.quantity * data.specialPrice;
    const totalCost = data.quantity * data.cost;
    const netProfit = totalRevenue - totalCost;

    const specialSale = await SpecialSale.create({
      business: businessId,
      product: {
        name: data.product.name,
        category: data.product.category,
        image: data.product.image,
      },
      quantity: data.quantity,
      specialPrice: data.specialPrice,
      cost: data.cost,
      totalRevenue,
      totalCost,
      netProfit,
      distribution: data.distribution || [],
      observations: data.observations,
      eventName: data.eventName,
      saleDate: data.saleDate || new Date(),
      createdBy: userId,
      status: "confirmed",
    });

    if (netProfit > 0 && Array.isArray(data.distribution)) {
      for (const dist of data.distribution) {
        if (dist.user && dist.amount > 0) {
          await ProfitHistory.create({
            business: businessId,
            user: dist.user,
            amount: dist.amount,
            source: "special_sale",
            sourceId: specialSale._id,
            description: `Ganancia por venta especial: ${data.product.name}`,
            date: data.saleDate || new Date(),
          });
        }
      }
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
