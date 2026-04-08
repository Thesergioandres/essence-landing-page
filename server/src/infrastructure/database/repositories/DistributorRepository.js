import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Business from "../../../../models/Business.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import Membership from "../../../../models/Membership.js";
import Promotion from "../../../../models/Promotion.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";

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

    const membershipDistributorIds = memberships
      .map((m) => m.user)
      .filter((id) => id && mongoose.isValidObjectId(id));

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

    const distributorIds = distributors
      .map((d) => d._id)
      .filter((id) => id && mongoose.isValidObjectId(id));

    if (distributorIds.length === 0) {
      return {
        distributors: [],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: false,
        },
      };
    }

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
            // 💰 CASH FLOW: Solo ventas confirmadas para profit
            paymentStatus: "confirmado",
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

    console.log(
      `[DistributorRepository] findById called for id: ${id}, business: ${businessObjectId}`,
    );

    const stock = await DistributorStock.find({
      distributor: distributor._id,
      business: businessObjectId,
    }).populate("product", "name image");

    console.log(`[DistributorRepository] Stock found: ${stock?.length}`);

    const activePromotions = await Promotion.find({
      business: businessObjectId,
      status: "active", // Fixed: 'active' boolean -> 'status' enum
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).lean();

    console.log(
      `[DistributorRepository] Active promotions found: ${activePromotions?.length}`,
    );

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

  async getProducts(distributorId, businessId, filters = {}) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {
      distributor: distributorId,
      business: businessId,
      quantity: { $gt: 0 },
    };

    console.log(
      `[DistributorRepository] getProducts. DistId: ${distributorId}, BusId: ${businessId}`,
    );
    console.log(`[DistributorRepository] Query:`, JSON.stringify(query));

    if (filters.search) {
      // Need complex lookup to filter by product name, skip for now or do aggregate
    }

    // Use aggregate to filter by product name if needed in future
    // For now simple find
    const [stocks, total] = await Promise.all([
      DistributorStock.find(query)
        .populate("product") // Populate full product to return same shape as expected
        .skip(skip)
        .limit(limit)
        .lean(),
      DistributorStock.countDocuments(query),
    ]);

    console.log(
      `[DistributorRepository] Found ${stocks.length} items for distributor.`,
    );
    if (stocks.length > 0) {
      console.log(
        `[DistributorRepository] Sample item:`,
        JSON.stringify(stocks[0]),
      );
    } else {
      console.log(
        `[DistributorRepository] NO STOCK FOUND. Checking without quantity filter...`,
      );
      const allStock = await DistributorStock.find({
        distributor: distributorId,
        business: businessId,
      })
        .limit(1)
        .lean();
      console.log(
        `[DistributorRepository] Unfiltered check result: ${allStock.length} items (First: ${JSON.stringify(allStock[0])})`,
      );
    }

    // Format matches what FE expects?
    // FE expects: { products: [ { product: {...}, quantity: 5 } ] }
    // Stock returns: { product: {...}, quantity: 5, ... }
    // It matches well enough.

    return {
      products: stocks,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPublicCatalog(distributorId) {
    const membership = await Membership.findOne({
      user: distributorId,
      role: "distribuidor",
      status: "active",
    })
      .select("business")
      .lean();

    if (!membership?.business) {
      const err = new Error("Distribuidor no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const [distributor, business] = await Promise.all([
      User.findOne({
        _id: distributorId,
        role: "distribuidor",
      })
        .select("name email phone")
        .lean(),
      Business.findById(membership.business).select("name logoUrl").lean(),
    ]);

    if (!distributor) {
      const err = new Error("Distribuidor no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const stockEntries = await DistributorStock.find({
      business: membership.business,
      distributor: distributorId,
      quantity: { $gt: 0 },
    })
      .populate({
        path: "product",
        select: "name description clientPrice distributorPrice image category",
        populate: { path: "category", select: "name slug" },
      })
      .lean();

    const products = stockEntries
      .filter((entry) => entry.product)
      .map((entry) => ({
        ...entry.product,
        distributorStock: entry.quantity,
        totalStock: entry.quantity,
      }));

    return {
      distributor,
      products,
      business: business
        ? {
            _id: business._id,
            name: business.name,
            logoUrl: business.logoUrl || null,
          }
        : null,
    };
  }
}
