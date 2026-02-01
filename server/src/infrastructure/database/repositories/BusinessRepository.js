import Business from "../../../../models/Business.js";
import Membership from "../../../../models/Membership.js";

export class BusinessRepository {
  async create(data, creatorId) {
    const exists = await Business.findOne({ name: data.name });
    if (exists) {
      const err = new Error("Ya existe un negocio con ese nombre");
      err.statusCode = 400;
      throw err;
    }

    const business = await Business.create({
      name: data.name,
      description: data.description,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      contactWhatsapp: data.contactWhatsapp,
      contactLocation: data.contactLocation,
      config: { features: { ...(data.features || {}) } },
      createdBy: creatorId,
    });

    await Membership.create({
      user: creatorId,
      business: business._id,
      role: "admin",
      status: "active",
    });

    return business;
  }

  async findAll() {
    const businesses = await Business.find().sort({ createdAt: -1 }).lean();
    return businesses;
  }

  async findById(id) {
    const business = await Business.findById(id).lean();
    return business;
  }

  async findWithMembers(id) {
    const business = await Business.findById(id).lean();
    const members = await Membership.find({ business: id })
      .populate("user", "name email role active")
      .lean();
    return { business, members };
  }

  async update(id, data) {
    const business = await Business.findById(id);
    if (!business) {
      const err = new Error("Negocio no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (data.name !== undefined) business.name = data.name;
    if (data.description !== undefined) business.description = data.description;
    if (data.contactEmail !== undefined)
      business.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined)
      business.contactPhone = data.contactPhone;
    if (data.contactWhatsapp !== undefined)
      business.contactWhatsapp = data.contactWhatsapp;
    if (data.contactLocation !== undefined)
      business.contactLocation = data.contactLocation;
    if (data.logoUrl !== undefined) business.logoUrl = data.logoUrl;
    if (data.logoPublicId !== undefined)
      business.logoPublicId = data.logoPublicId;

    await business.save();
    return business;
  }

  async updateFeatures(id, features) {
    const business = await Business.findById(id);
    if (!business) {
      const err = new Error("Negocio no encontrado");
      err.statusCode = 404;
      throw err;
    }

    business.config.features = {
      ...(business.config?.features?.toObject?.() ||
        business.config?.features ||
        {}),
      ...features,
    };
    await business.save();
    return business;
  }

  async addMember(businessId, data) {
    const membership = await Membership.findOneAndUpdate(
      { user: data.userId, business: businessId },
      {
        role: data.role,
        status: "active",
        ...(data.permissions ? { permissions: data.permissions } : {}),
        ...(Array.isArray(data.allowedBranches)
          ? { allowedBranches: data.allowedBranches }
          : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return membership;
  }

  async updateMember(businessId, membershipId, data) {
    const membership = await Membership.findOneAndUpdate(
      { _id: membershipId, business: businessId },
      {
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.permissions ? { permissions: data.permissions } : {}),
        ...(Array.isArray(data.allowedBranches)
          ? { allowedBranches: data.allowedBranches }
          : {}),
      },
      { new: true },
    ).populate("user", "name email role active");

    if (!membership) {
      const err = new Error("Miembro no encontrado");
      err.statusCode = 404;
      throw err;
    }

    return membership;
  }

  async removeMember(businessId, membershipId) {
    const membership = await Membership.findOneAndDelete({
      _id: membershipId,
      business: businessId,
    });

    if (!membership) {
      const err = new Error("Miembro no encontrado");
      err.statusCode = 404;
      throw err;
    }

    return membership;
  }

  async getMembers(businessId) {
    const members = await Membership.find({ business: businessId })
      .populate("user", "name email role active")
      .lean();
    return members;
  }
}
