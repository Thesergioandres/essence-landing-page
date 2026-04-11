import Provider from "../models/Provider.js";

export class ProviderRepository {
  async create(data) {
    const provider = await Provider.create(data);
    return provider;
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { contact: { $regex: filters.search, $options: "i" } },
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [providers, total] = await Promise.all([
      Provider.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Provider.countDocuments(query),
    ]);

    return {
      providers,
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
    return provider;
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

    return provider;
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
