import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { employeeRoleQuery } from "../../../utils/roleAliases.js";
import Branch from "../models/Branch.js";
import Business from "../models/Business.js";
import EmployeeStock from "../models/EmployeeStock.js";
import InventoryMovement from "../models/InventoryMovement.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import Promotion from "../models/Promotion.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";

const MANAGEMENT_ROLES = new Set(["admin", "super_admin", "god"]);
const COMMISSION_ELIGIBLE_ROLES = new Set(["employee", "operativo"]);

const normalizeRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return normalized === "superadmin" ? "super_admin" : normalized;
};

const isManagementRole = (role) => MANAGEMENT_ROLES.has(normalizeRole(role));

const isCommissionEligibleRole = (role) =>
  COMMISSION_ELIGIBLE_ROLES.has(normalizeRole(role));

const resolveIdValue = (value) => {
  if (value && typeof value === "object") {
    return resolveIdValue(value._id || value.id || value.$oid || "");
  }

  return String(value || "").trim();
};

const sanitizeAllowedBranchesInput = (allowedBranches) => {
  if (allowedBranches === undefined) {
    return null;
  }

  if (allowedBranches === null) {
    return [];
  }

  if (!Array.isArray(allowedBranches)) {
    const err = new Error("allowedBranches debe ser un arreglo de IDs");
    err.statusCode = 400;
    throw err;
  }

  const normalizedValues = allowedBranches
    .map((branchId) => resolveIdValue(branchId))
    .filter(Boolean);

  const hasInvalidBranchIds = normalizedValues.some(
    (branchId) => !mongoose.isValidObjectId(branchId),
  );

  if (hasInvalidBranchIds) {
    const err = new Error("allowedBranches contiene IDs inválidos");
    err.statusCode = 400;
    throw err;
  }

  const normalized = normalizedValues;

  return [...new Set(normalized)];
};

const normalizeAllowedBranchesForOutput = (allowedBranches) => {
  if (!Array.isArray(allowedBranches)) {
    return [];
  }

  return allowedBranches
    .map((branchId) => resolveIdValue(branchId))
    .filter(Boolean);
};

const ensureAllowedBranchesBelongToBusiness = async (
  businessId,
  allowedBranches,
) => {
  if (!Array.isArray(allowedBranches) || allowedBranches.length === 0) {
    return;
  }

  const branches = await Branch.find({
    business: businessId,
    _id: { $in: allowedBranches },
  })
    .select("_id")
    .lean();

  if (branches.length !== allowedBranches.length) {
    const err = new Error(
      "Una o mas sedes asignadas no existen en este negocio",
    );
    err.statusCode = 400;
    throw err;
  }
};

export class EmployeeRepository {
  async create(data, businessId) {
    const userExists = await User.findOne({ email: data.email });
    if (userExists) {
      const err = new Error("El email ya está registrado");
      err.statusCode = 400;
      throw err;
    }

    const allowedBranches = sanitizeAllowedBranchesInput(data.allowedBranches);
    await ensureAllowedBranchesBelongToBusiness(businessId, allowedBranches);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const employee = await User.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      phone: data.phone,
      address: data.address,
      role: "employee",
      status: "active",
      active: true,
    });

    await Membership.findOneAndUpdate(
      { user: employee._id, business: businessId },
      {
        role: "employee",
        status: "active",
        ...(Array.isArray(allowedBranches) ? { allowedBranches } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      _id: employee._id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      role: employee.role,
      active: employee.active,
      allowedBranches: normalizeAllowedBranchesForOutput(allowedBranches),
    };
  }

  async findByBusiness(businessId, filters = {}) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;

    const memberships = await Membership.find({
      business: businessId,
      role: employeeRoleQuery,
      status: "active",
    })
      .select("user allowedBranches")
      .lean();

    const membershipEmployeeIds = memberships
      .map((m) => m.user)
      .filter((id) => id && mongoose.isValidObjectId(id));

    const membershipByEmployeeId = new Map(
      memberships.map((membership) => [String(membership.user), membership]),
    );

    if (membershipEmployeeIds.length === 0) {
      return {
        employees: [],
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
      role: employeeRoleQuery,
      _id: { $in: membershipEmployeeIds },
    };

    if (filters.active !== undefined) {
      filter.active = filters.active === "true";
    }

    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
      User.find(filter)
        .select(
          "name email phone address role active assignedProducts baseCommissionPercentage fixedCommissionOnly isCommissionFixed customCommissionRate",
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const employeeIds = employees
      .map((d) => d._id)
      .filter((id) => id && mongoose.isValidObjectId(id));

    if (employeeIds.length === 0) {
      return {
        employees: [],
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
    const objectIds = employeeIds.map((id) => new mongoose.Types.ObjectId(id));

    const [stockAgg, salesAgg] = await Promise.all([
      EmployeeStock.aggregate([
        {
          $match: {
            business: businessObjectId,
            employee: { $in: objectIds },
          },
        },
        { $group: { _id: "$employee", totalStock: { $sum: "$quantity" } } },
      ]),
      Sale.aggregate([
        {
          $match: {
            business: businessObjectId,
            employee: { $in: objectIds },
            // 💰 CASH FLOW: Solo ventas confirmadas para profit
            paymentStatus: "confirmado",
          },
        },
        {
          $group: {
            _id: "$employee",
            totalSales: { $sum: 1 },
            totalProfit: { $sum: "$employeeProfit" },
          },
        },
      ]),
    ]);

    const stockByEmployee = new Map(
      stockAgg.map((s) => [String(s._id), Number(s.totalStock) || 0]),
    );
    const salesByEmployee = new Map(
      salesAgg.map((s) => [
        String(s._id),
        {
          totalSales: Number(s.totalSales) || 0,
          totalProfit: Number(s.totalProfit) || 0,
        },
      ]),
    );

    const employeesWithStats = employees.map((employee) => {
      const salesStats = salesByEmployee.get(String(employee._id)) || {
        totalSales: 0,
        totalProfit: 0,
      };

      return {
        ...employee,
        allowedBranches: normalizeAllowedBranchesForOutput(
          membershipByEmployeeId.get(String(employee._id))?.allowedBranches,
        ),
        stats: {
          totalStock: stockByEmployee.get(String(employee._id)) || 0,
          totalSales: salesStats.totalSales,
          totalProfit: salesStats.totalProfit,
          assignedProductsCount: employee.assignedProducts?.length || 0,
        },
      };
    });

    return {
      employees: employeesWithStats,
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
      role: employeeRoleQuery,
      status: "active",
    });

    if (!membership) {
      const err = new Error("Employee no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const employee = await User.findOne({ _id: id, role: employeeRoleQuery })
      .select("-password")
      .populate("assignedProducts", "name image purchasePrice employeePrice");

    if (!employee) {
      const err = new Error("Employee no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    console.log(
      `[EmployeeRepository] findById called for id: ${id}, business: ${businessObjectId}`,
    );

    const stock = await EmployeeStock.find({
      employee: employee._id,
      business: businessObjectId,
    }).populate("product", "name image");

    console.log(`[EmployeeRepository] Stock found: ${stock?.length}`);

    const activePromotions = await Promotion.find({
      business: businessObjectId,
      status: "active", // Fixed: 'active' boolean -> 'status' enum
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).lean();

    console.log(
      `[EmployeeRepository] Active promotions found: ${activePromotions?.length}`,
    );

    return {
      ...employee.toObject(),
      allowedBranches: normalizeAllowedBranchesForOutput(
        membership.allowedBranches,
      ),
      stock,
      activePromotions,
    };
  }

  async update(id, businessId, data) {
    const membership = await Membership.findOne({
      business: businessId,
      user: id,
      role: employeeRoleQuery,
      status: "active",
    });

    if (!membership) {
      const err = new Error("Employee no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.address !== undefined) updates.address = data.address;
    if (data.active !== undefined) updates.active = data.active;
    if (data.assignedProducts !== undefined) {
      updates.assignedProducts = data.assignedProducts;
    }

    if (data.allowedBranches !== undefined) {
      const allowedBranches = sanitizeAllowedBranchesInput(
        data.allowedBranches,
      );
      await ensureAllowedBranchesBelongToBusiness(businessId, allowedBranches);
      membership.allowedBranches = allowedBranches;
      await membership.save();
    }

    const employee = await User.findByIdAndUpdate(id, updates, {
      new: true,
    }).select("-password");

    if (!employee) {
      const err = new Error("Employee no encontrado");
      err.statusCode = 404;
      throw err;
    }

    return {
      ...employee.toObject(),
      allowedBranches: normalizeAllowedBranchesForOutput(
        membership.allowedBranches,
      ),
    };
  }

  async updateBaseCommissionPercentage(
    id,
    businessId,
    baseCommissionPercentage,
    options = {},
  ) {
    const targetUser = await User.findById(id).select("_id role");

    if (!targetUser) {
      const err = new Error("Employee no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const normalizedTargetRole = normalizeRole(targetUser.role);
    const normalizedHeaderRole = options?.targetRoleFromHeader
      ? normalizeRole(options.targetRoleFromHeader)
      : "";

    if (normalizedHeaderRole && normalizedHeaderRole !== normalizedTargetRole) {
      const err = new Error(
        "El rol del perfil cambió. Recarga la tabla antes de editar.",
      );
      err.statusCode = 409;
      throw err;
    }

    if (
      isManagementRole(normalizedTargetRole) ||
      !isCommissionEligibleRole(normalizedTargetRole)
    ) {
      const err = new Error(
        "Solo perfiles operativos pueden tener comisión base.",
      );
      err.statusCode = 403;
      throw err;
    }

    const membership = await Membership.findOne({
      business: businessId,
      user: id,
      role: employeeRoleQuery,
      status: "active",
    });

    if (!membership) {
      const err = new Error("Employee no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const normalizedRate = Number(baseCommissionPercentage);

    if (!Number.isFinite(normalizedRate)) {
      const err = new Error("baseCommissionPercentage debe ser numerico");
      err.statusCode = 400;
      throw err;
    }

    if (normalizedRate < 0 || normalizedRate > 95) {
      const err = new Error("baseCommissionPercentage debe estar entre 0 y 95");
      err.statusCode = 400;
      throw err;
    }

    const employee = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          baseCommissionPercentage: Math.max(0, Math.min(95, normalizedRate)),
        },
      },
      { new: true },
    ).select(
      "_id name email role active baseCommissionPercentage fixedCommissionOnly isCommissionFixed customCommissionRate",
    );

    if (!employee) {
      const err = new Error("Employee no encontrado");
      err.statusCode = 404;
      throw err;
    }

    return employee;
  }

  async toggleActive(id, businessId) {
    const membership = await Membership.findOne({
      business: businessId,
      user: id,
      role: employeeRoleQuery,
    });

    if (!membership) {
      const err = new Error("Employee no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const employee = await User.findOne({
      _id: id,
      role: employeeRoleQuery,
    });
    if (!employee) {
      const err = new Error("Employee no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const nextActive = employee.active !== false ? false : true;
    employee.active = nextActive;
    if (nextActive) {
      employee.status = "active";
    } else if (employee.status === "active") {
      employee.status = "suspended";
    }
    await employee.save();

    return {
      message: nextActive
        ? "Employee activado correctamente"
        : "Employee pausado correctamente",
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        address: employee.address,
        role: employee.role,
        active: employee.active,
        status: employee.status,
      },
    };
  }

  async delete(id, businessId, performedBy) {
    const session = await mongoose.startSession();

    try {
      const summary = await session.withTransaction(async () => {
        const membership = await Membership.findOne({
          business: businessId,
          user: id,
          role: employeeRoleQuery,
        }).session(session);

        if (!membership) {
          const err = new Error("Employee no encontrado en este negocio");
          err.statusCode = 404;
          throw err;
        }

        const employee = await User.findOne({
          _id: id,
          role: employeeRoleQuery,
        }).session(session);

        if (!employee) {
          const err = new Error("Employee no encontrado");
          err.statusCode = 404;
          throw err;
        }

        const employeeNameSnapshot =
          String(employee.name || "").trim() ||
          String(employee.email || "").trim() ||
          "Employee eliminado";

        const stockRows = await EmployeeStock.find({
          business: businessId,
          employee: id,
          $or: [{ quantity: { $gt: 0 } }, { inTransitQuantity: { $gt: 0 } }],
        }).session(session);

        let returnedUnits = 0;
        let returnedProducts = 0;

        for (const stockRow of stockRows) {
          const quantity = Number(stockRow.quantity || 0);
          const inTransitQuantity = Number(stockRow.inTransitQuantity || 0);
          const totalToReturn = quantity + inTransitQuantity;

          if (totalToReturn <= 0) continue;

          const updatedProduct = await Product.findOneAndUpdate(
            { _id: stockRow.product, business: businessId },
            { $inc: { warehouseStock: totalToReturn } },
            { new: true, session },
          );

          if (!updatedProduct) {
            const err = new Error(
              "Producto no encontrado para retorno de stock",
            );
            err.statusCode = 404;
            throw err;
          }

          await InventoryMovement.create(
            [
              {
                business: businessId,
                product: stockRow.product,
                quantity: totalToReturn,
                movementType: "INBOUND_RETURN",
                fromLocation: {
                  type: "employee",
                  id: id,
                  name: employeeNameSnapshot,
                },
                toLocation: {
                  type: "warehouse",
                  id: null,
                  name: "Bodega Central",
                },
                referenceModel: "User",
                referenceId: id,
                performedBy: performedBy || id,
                notes: "Retorno por eliminación de employee",
                metadata: {
                  reason: "employee_removal",
                  employeeId: String(id),
                  quantity,
                  inTransitQuantity,
                },
              },
            ],
            { session },
          );

          returnedUnits += totalToReturn;
          returnedProducts += 1;
        }

        const salesUpdateResult = await Sale.updateMany(
          { business: businessId, employee: id },
          {
            $set: {
              employeeNameSnapshot,
              employee: null,
            },
          },
          { session },
        );

        await EmployeeStock.deleteMany({
          business: businessId,
          employee: id,
        }).session(session);

        await Membership.deleteMany({ user: id }).session(session);

        const deleteUserResult = await User.deleteOne({
          _id: id,
          role: employeeRoleQuery,
        }).session(session);

        if (!deleteUserResult.deletedCount) {
          const err = new Error("No se pudo eliminar el employee");
          err.statusCode = 500;
          throw err;
        }

        return {
          message:
            "Employee eliminado correctamente. El inventario fue retornado a bodega.",
          employeeNameSnapshot,
          returnedUnits,
          returnedProducts,
          affectedSales:
            salesUpdateResult?.modifiedCount ||
            salesUpdateResult?.nModified ||
            0,
        };
      });

      return summary;
    } catch (error) {
      if (!error?.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  async assignProducts(employeeId, businessId, productIds) {
    const membership = await Membership.findOne({
      business: businessId,
      user: employeeId,
      role: employeeRoleQuery,
      status: "active",
    });

    if (!membership) {
      const err = new Error("Employee no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const validProducts = await Product.find({
      _id: { $in: productIds },
      business: businessId,
    }).select("_id");

    const validIds = validProducts.map((p) => p._id);

    const employee = await User.findByIdAndUpdate(
      employeeId,
      { assignedProducts: validIds },
      { new: true },
    ).select("name email assignedProducts");

    return employee;
  }

  async getProducts(employeeId, businessId, filters = {}) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {
      employee: employeeId,
      business: businessId,
      quantity: { $gt: 0 },
    };

    console.log(
      `[EmployeeRepository] getProducts. DistId: ${employeeId}, BusId: ${businessId}`,
    );
    console.log(`[EmployeeRepository] Query:`, JSON.stringify(query));

    if (filters.search) {
      // Need complex lookup to filter by product name, skip for now or do aggregate
    }

    // Use aggregate to filter by product name if needed in future
    // For now simple find
    const [stocks, total] = await Promise.all([
      EmployeeStock.find(query)
        .populate("product") // Populate full product to return same shape as expected
        .skip(skip)
        .limit(limit)
        .lean(),
      EmployeeStock.countDocuments(query),
    ]);

    console.log(
      `[EmployeeRepository] Found ${stocks.length} items for employee.`,
    );
    if (stocks.length > 0) {
      console.log(
        `[EmployeeRepository] Sample item:`,
        JSON.stringify(stocks[0]),
      );
    } else {
      console.log(
        `[EmployeeRepository] NO STOCK FOUND. Checking without quantity filter...`,
      );
      const allStock = await EmployeeStock.find({
        employee: employeeId,
        business: businessId,
      })
        .limit(1)
        .lean();
      console.log(
        `[EmployeeRepository] Unfiltered check result: ${allStock.length} items (First: ${JSON.stringify(allStock[0])})`,
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

  async getPublicCatalog(employeeId) {
    const membership = await Membership.findOne({
      user: employeeId,
      role: employeeRoleQuery,
      status: "active",
    })
      .select("business")
      .lean();

    if (!membership?.business) {
      const err = new Error("Employee no encontrado en este negocio");
      err.statusCode = 404;
      throw err;
    }

    const [employee, business] = await Promise.all([
      User.findOne({
        _id: employeeId,
        role: employeeRoleQuery,
      })
        .select("name email phone")
        .lean(),
      Business.findById(membership.business).select("name logoUrl").lean(),
    ]);

    if (!employee) {
      const err = new Error("Employee no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const stockEntries = await EmployeeStock.find({
      business: membership.business,
      employee: employeeId,
      quantity: { $gt: 0 },
    })
      .populate({
        path: "product",
        select: "name description clientPrice employeePrice image category",
        populate: { path: "category", select: "name slug" },
      })
      .lean();

    const products = stockEntries
      .filter((entry) => entry.product)
      .map((entry) => ({
        ...entry.product,
        employeeStock: entry.quantity,
        totalStock: entry.quantity,
      }));

    return {
      employee,
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
