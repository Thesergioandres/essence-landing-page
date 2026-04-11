/**
 * PaymentMethod Repository - Data Access Layer
 * Handles payment method operations in Hexagonal Architecture
 */

import PaymentMethod from "../models/PaymentMethod.js";

class PaymentMethodRepository {
  /**
   * Find all payment methods for a business
   */
  async findByBusiness(businessId, includeInactive = false) {
    const query = { business: businessId };
    if (!includeInactive) {
      query.isActive = true;
    }

    const methods = await PaymentMethod.find(query)
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    // Auto-create defaults if empty
    if (methods.length === 0) {
      return await PaymentMethod.createDefaultMethods(businessId);
    }

    return methods;
  }

  /**
   * Find payment method by ID
   */
  async findById(id, businessId) {
    return await PaymentMethod.findOne({
      _id: id,
      business: businessId,
    });
  }

  /**
   * Create new payment method
   */
  async create(businessId, data, userId) {
    const {
      name,
      description,
      isCredit,
      requiresConfirmation,
      requiresProof,
      icon,
      color,
      displayOrder,
    } = data;

    // Check for duplicate name
    const existingByName = await PaymentMethod.findOne({
      business: businessId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingByName) {
      throw new Error("Ya existe un método de pago con ese nombre");
    }

    // Get max order for auto-increment
    const maxOrderDoc = await PaymentMethod.findOne({ business: businessId })
      .sort({ displayOrder: -1 })
      .select("displayOrder")
      .lean();

    const nextOrder = displayOrder ?? (maxOrderDoc?.displayOrder ?? 0) + 1;

    return await PaymentMethod.create({
      business: businessId,
      name,
      description,
      isCredit: isCredit ?? false,
      requiresConfirmation: requiresConfirmation ?? false,
      requiresProof: requiresProof ?? false,
      icon,
      color,
      displayOrder: nextOrder,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  /**
   * Update payment method
   */
  async update(id, businessId, data, userId) {
    const method = await this.findById(id, businessId);
    if (!method) {
      return null;
    }

    // Check for duplicate name if changing
    if (data.name && data.name !== method.name) {
      const existingByName = await PaymentMethod.findOne({
        business: businessId,
        name: { $regex: new RegExp(`^${data.name}$`, "i") },
        _id: { $ne: id },
      });

      if (existingByName) {
        throw new Error("Ya existe un método de pago con ese nombre");
      }
    }

    Object.assign(method, {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    return await method.save();
  }

  /**
   * Delete payment method
   */
  async delete(id, businessId) {
    const result = await PaymentMethod.deleteOne({
      _id: id,
      business: businessId,
    });

    return result.deletedCount > 0;
  }

  /**
   * Reorder payment methods
   */
  async reorder(businessId, orderArray) {
    const bulkOps = orderArray.map((item, index) => ({
      updateOne: {
        filter: { _id: item.id, business: businessId },
        update: { $set: { displayOrder: index + 1 } },
      },
    }));

    await PaymentMethod.bulkWrite(bulkOps);
  }

  /**
   * Initialize default methods
   */
  async initializeDefaults(businessId, userId) {
    return await PaymentMethod.createDefaultMethods(businessId, userId);
  }
}

export default new PaymentMethodRepository();
