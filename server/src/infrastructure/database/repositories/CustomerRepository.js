import AuditLog from "../models/AuditLog.js";
import Customer from "../models/Customer.js";

const normalizeEmail = (email) =>
  typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : undefined;

const normalizePhone = (phone) =>
  typeof phone === "string"
    ? phone
        .replace(/[^0-9+]/g, "")
        .replace(/^(00)/, "+")
        .trim()
    : undefined;

export class CustomerRepository {
  async create(data, userId, userInfo) {
    const {
      business,
      name,
      email,
      phone,
      address,
      segment,
      creditLimit,
      documentNumber,
      documentType,
    } = data;

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    await this._assertUniqueContact({
      businessId: business,
      email: normalizedEmail,
      phone: normalizedPhone,
    });

    const customer = await Customer.create({
      business,
      name,
      email: normalizedEmail,
      phone: normalizedPhone,
      address,
      segment,
      creditLimit: creditLimit || 0,
      documentNumber,
      documentType,
      totalDebt: 0,
      totalPurchased: 0,
    });

    await this._recordAudit(customer, "customer_created", userInfo);
    return customer;
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.segment) {
      query.segment = filters.segment;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
        { phone: { $regex: filters.search, $options: "i" } },
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .populate("segment", "name color")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const customer = await Customer.findOne({ _id: id, business: businessId })
      .populate("segment", "name color")
      .lean();
    return customer;
  }

  async update(id, businessId, data, userId, userInfo) {
    const oldCustomer = await Customer.findOne({
      _id: id,
      business: businessId,
    });
    if (!oldCustomer) {
      const err = new Error("Cliente no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const normalizedEmail = normalizeEmail(data.email);
    const normalizedPhone = normalizePhone(data.phone);

    await this._assertUniqueContact({
      businessId,
      email: normalizedEmail,
      phone: normalizedPhone,
      excludeId: id,
    });

    const updates = { ...data };
    if (normalizedEmail) updates.email = normalizedEmail;
    if (normalizedPhone) updates.phone = normalizedPhone;

    const updated = await Customer.findByIdAndUpdate(id, updates, { new: true })
      .populate("segment", "name color")
      .lean();

    await this._recordAudit(updated, "customer_updated", userInfo, oldCustomer);
    return updated;
  }

  async delete(id, businessId, userInfo) {
    const customer = await Customer.findOneAndDelete({
      _id: id,
      business: businessId,
    });
    if (!customer) {
      const err = new Error("Cliente no encontrado");
      err.statusCode = 404;
      throw err;
    }

    await this._recordAudit(customer, "customer_deleted", userInfo);
    return customer;
  }

  async _assertUniqueContact({ businessId, email, phone, excludeId }) {
    const or = [];
    if (email) or.push({ email });
    if (phone) or.push({ phone });
    if (!or.length) return;

    const conflict = await Customer.findOne({
      business: businessId,
      $or: or,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("_id email phone");

    if (conflict) {
      const isEmail = email && conflict.email === email;
      const isPhone = phone && conflict.phone === phone;
      const message = isEmail
        ? "El email ya está registrado"
        : isPhone
          ? "El teléfono ya está registrado"
          : "Contacto duplicado";
      const err = new Error(message);
      err.statusCode = 409;
      throw err;
    }
  }

  async _recordAudit(entity, action, userInfo, oldValues) {
    try {
      await AuditLog.create({
        business: entity.business,
        user: userInfo?._id,
        userEmail: userInfo?.email,
        userName: userInfo?.name,
        userRole: userInfo?.role,
        action,
        module: "clients",
        description: `${action} ${entity.name}`,
        entityType: "Customer",
        entityId: entity._id,
        entityName: entity.name,
        oldValues: oldValues || undefined,
        newValues: entity,
      });
    } catch (error) {
      console.error("audit log customer error", error?.message);
    }
  }
}
