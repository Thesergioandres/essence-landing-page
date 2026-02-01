import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import DistributorStock from "../../../../models/DistributorStock.js";
import Membership from "../../../../models/Membership.js";
import Product from "../../../../models/Product.js";
import Promotion from "../../../../models/Promotion.js";
import Sale from "../../../../models/Sale.js";
import User from "../../../../models/User.js";

export class DistributorRepository {
  async create(data, businessId) {
    const userExists = await User.findOne({ email: data.email });
    if (userExists) {
      const err = new Error("El email ya está registrado");
      err.statusCode = 400;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const distributor = await User.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      phone: data.phone,
      address: data.address,
      role: "distribuidor",
      status: "active",
      active: true,
    });

    await Membership.findOneAndUpdate(
      { user: distributor._id, business: businessId },
      { role: "distribuidor", status: "active" },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      _id: distributor._id,
      name: distributor.name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      role: distributor.role,
      active: distributor.active,
    };
  }

  async findByBusiness(businessId, filters = {}) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;

    const memberships = await Membership.find({
      business: businessId,
      role: "distribuidor",
      status: "active",
    }).select("user");

    const membershipDistributorIds = memberships.map((m) => m.user);

    if (membershipDistributorIds.length === 0) {
      return {
        distributors: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasMore: false,
        },
      };
    }

    const filter = {
      role: "distribuidor",
      _id: { $in: membershipDistributorIds },
    };

    if (filters.active !== undefined) {
      filter.active = filters.active === "true";
    }

    const skip = (page - 1) * limit;

    const [distributors, total] = await Promise.all([
      User.find(filter)
        .select("name email phone address role active assignedProducts")
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const distributorIds = distributors.map((d) => d._id);
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const objectIds = distributorIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const [stockAgg, salesAgg] = await Promise.all([
      DistributorStock.aggregate([
        {
          $match: {
            business: businessObjectId,
            distributor: { $in: objectIds },
          },
        },
        { $group: { _id: "$distributor", totalStock: { $sum: "$quantity" } } },
      ]),
      Sale.aggregate([
        {
          $match: {
            business: businessObjectId,
            distributor: { $in: objectIds },
          },
        },
        {
          $group: {
            _id: "$distributor",
            totalSales: { $sum: 1 },
            totalProfit: { $sum: "$distributorProfit" },
          },
        },
      ]),
    ]);

    const stockByDistributor = new Map(
      stockAgg.map((s) => [String(s._id), Number(s.totalStock) || 0]),
    );
    const salesByDistributor = new Map(
      salesAgg.map((s) => [
        String(s._id),
        {
          totalSales: Number(s.totalSales) || 0,
          totalProfit: Number(s.totalProfit) || 0,
        },
      ]),
    );

    const distributorsWithStats = distributors.map((distributor) => {
      const salesStats = salesByDistributor.get(String(distributor._id)) || {
        totalSales: 0,
        totalProfit: 0,
      };

      return {
        ...distributor,
        stats: {
          totalStock: stockByDistributor.get(String(distributor._id)) || 0,
          totalSales: salesStats.totalSales,
          totalProfit: salesStats.totalProfit,
          assignedProductsCount: distributor.assignedProducts?.length || 0,
        },
      };
    });

    return {
      distributors: distributorsWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const membership = await Membership.findOne({
      business: businessId,
      user: id,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      const err = new Error("Distribuidor no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const distributor = await User.findOne({ _id: id, role: "distribuidor" })
      .select("-password")
      .populate(
        "assignedProducts",
        "name image purchasePrice distributorPrice",
      );

    if (!distributor) {
      const err = new Error("Distribuidor no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const stock = await DistributorStock.find({
      distributor: distributor._id,
      business: businessObjectId,
    }).populate("product", "name image");

    const activePromotions = await Promotion.find({
      business: businessObjectId,
      active: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).lean();

    return {
      ...distributor.toObject(),
      stock,
      activePromotions,
    };
  }

  async update(id, businessId, data) {
    const membership = await Membership.findOne({
      business: businessId,
      user: id,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      const err = new Error("Distribuidor no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const updates = {};
    if (data.name) updates.name = data.name;
    if (data.phone) updates.phone = data.phone;
    if (data.address) updates.address = data.address;
    if (data.active !== undefined) updates.active = data.active;
    if (data.assignedProducts) updates.assignedProducts = data.assignedProducts;

    const distributor = await User.findByIdAndUpdate(id, updates, {
      new: true,
    }).select("-password");

    if (!distributor) {
      const err = new Error("Distribuidor no encontrado");
      err.statusCode = 404;
      throw err;
    }

    return distributor;
  }

  async delete(id, businessId) {
    const membership = await Membership.findOne({
      business: businessId,
      user: id,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      const err = new Error("Distribuidor no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    await User.findByIdAndUpdate(id, { active: false });
    await Membership.findOneAndUpdate(
      { user: id, business: businessId },
      { status: "inactive" },
    );

    return { message: "Distribuidor desactivado" };
  }

  async assignProducts(distributorId, businessId, productIds) {
    const membership = await Membership.findOne({
      business: businessId,
      user: distributorId,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      const err = new Error("Distribuidor no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const validProducts = await Product.find({
      _id: { $in: productIds },
      business: businessId,
    }).select("_id");

    const validIds = validProducts.map((p) => p._id);

    const distributor = await User.findByIdAndUpdate(
      distributorId,
      { assignedProducts: validIds },
      { new: true },
    ).select("name email assignedProducts");

    return distributor;
  }
}
