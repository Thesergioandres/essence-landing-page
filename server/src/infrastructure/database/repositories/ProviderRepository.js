import mongoose from "mongoose";
import InventoryEntry from "../models/InventoryEntry.js";
import Provider from "../models/Provider.js";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeProviderOutput = (provider = {}, metrics = null) => ({
  ...provider,
  phone: provider.phone || provider.contactPhone || "",
  email: provider.email || provider.contactEmail || "",
  isActive: provider.isActive ?? provider.active ?? true,
  totalOrders: Number(metrics?.totalOrders ?? provider.totalOrders ?? 0) || 0,
  totalSpent: roundMoney(metrics?.totalSpent ?? provider.totalSpent ?? 0),
  lastOrderAt: metrics?.lastOrderAt || provider.lastOrderAt || null,
});

const buildProviderMetricsMap = async (businessId, providerIds = []) => {
  const businessObjectId = mongoose.isValidObjectId(businessId)
    ? new mongoose.Types.ObjectId(businessId)
    : null;

  if (!businessObjectId) {
    return new Map();
  }

  const uniqueProviderIds = [
    ...new Set(
      providerIds
        .map((id) => String(id))
        .filter((id) => mongoose.isValidObjectId(id)),
    ),
  ];

  if (!uniqueProviderIds.length) {
    return new Map();
  }

  const providerObjectIds = uniqueProviderIds.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const metrics = await InventoryEntry.aggregate([
    {
      $match: {
        business: businessObjectId,
        provider: { $in: providerObjectIds },
        deleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$provider",
        orderKeys: {
          $addToSet: {
            $ifNull: ["$purchaseGroupId", { $ifNull: ["$requestId", "$_id"] }],
          },
        },
        totalSpent: { $sum: { $ifNull: ["$totalCost", 0] } },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
    {
      $project: {
        totalOrders: { $size: "$orderKeys" },
        totalSpent: 1,
        lastOrderAt: 1,
      },
    },
  ]);

  return new Map(
    metrics.map((item) => [
      String(item._id),
      {
        totalOrders: Number(item.totalOrders) || 0,
        totalSpent: roundMoney(item.totalSpent),
        lastOrderAt: item.lastOrderAt || null,
      },
    ]),
  );
};

export class ProviderRepository {
  async create(data) {
    const provider = await Provider.create(data);
    return normalizeProviderOutput(provider.toObject());
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { contactName: { $regex: filters.search, $options: "i" } },
        { contactPhone: { $regex: filters.search, $options: "i" } },
        { contactEmail: { $regex: filters.search, $options: "i" } },
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [providers, total] = await Promise.all([
      Provider.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Provider.countDocuments(query),
    ]);

    const metricsByProvider = await buildProviderMetricsMap(
      businessId,
      providers.map((provider) => provider._id),
    );

    const normalizedProviders = providers.map((provider) =>
      normalizeProviderOutput(
        provider,
        metricsByProvider.get(String(provider._id)),
      ),
    );

    return {
      providers: normalizedProviders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const provider = await Provider.findOne({
      _id: id,
      business: businessId,
    }).lean();

    if (!provider) {
      return null;
    }

    const metricsByProvider = await buildProviderMetricsMap(businessId, [id]);
    return normalizeProviderOutput(provider, metricsByProvider.get(String(id)));
  }

  async update(id, businessId, data) {
    const provider = await Provider.findOneAndUpdate(
      { _id: id, business: businessId },
      data,
      { new: true },
    ).lean();

    if (!provider) {
      const err = new Error("Proveedor no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const metricsByProvider = await buildProviderMetricsMap(businessId, [id]);
    return normalizeProviderOutput(provider, metricsByProvider.get(String(id)));
  }

  async delete(id, businessId) {
    const provider = await Provider.findOneAndDelete({
      _id: id,
      business: businessId,
    });

    if (!provider) {
      const err = new Error("Proveedor no encontrado");
      err.statusCode = 404;
      throw err;
    }

    return provider;
  }
}
