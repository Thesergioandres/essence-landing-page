/**
 * DeliveryMethod Repository - Data Access Layer
 * Handles delivery method operations in Hexagonal Architecture
 */

import DeliveryMethod from "../models/DeliveryMethod.js";

class DeliveryMethodRepository {
  /**
   * Find all delivery methods for a business
   */
  async findByBusiness(businessId, includeInactive = false) {
    const query = { business: businessId };
    if (!includeInactive) {
      query.isActive = true;
    }

    const methods = await DeliveryMethod.find(query)
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    // Auto-create defaults if empty
    if (methods.length === 0) {
      return await DeliveryMethod.createDefaultMethods(businessId);
    }

    return methods;
  }

  /**
   * Find delivery method by ID
   */
  async findById(id, businessId) {
    return await DeliveryMethod.findOne({
      _id: id,
      business: businessId,
    });
  }

  /**
   * Create new delivery method
   */
  async create(businessId, data, userId) {
    const {
      name,
      description,
      defaultCost,
      hasVariableCost,
      requiresAddress,
      estimatedTime,
      icon,
      color,
      displayOrder,
    } = data;

    // Check for duplicate name
    const existingByName = await DeliveryMethod.findOne({
      business: businessId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingByName) {
      throw new Error("Ya existe un método de entrega con ese nombre");
    }

    // Get max order for auto-increment
    const maxOrderDoc = await DeliveryMethod.findOne({ business: businessId })
      .sort({ displayOrder: -1 })
      .select("displayOrder")
      .lean();

    const nextOrder = displayOrder ?? (maxOrderDoc?.displayOrder ?? 0) + 1;

    return await DeliveryMethod.create({
      business: businessId,
      name,
      description,
      defaultCost: defaultCost ?? 0,
      hasVariableCost: hasVariableCost ?? false,
      requiresAddress: requiresAddress ?? true,
      estimatedTime,
      icon,
      color,
      displayOrder: nextOrder,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  /**
   * Update delivery method
   */
  async update(id, businessId, data, userId) {
    const method = await this.findById(id, businessId);
    if (!method) {
      return null;
    }

    // Check for duplicate name if changing
    if (data.name && data.name !== method.name) {
      const existingByName = await DeliveryMethod.findOne({
        business: businessId,
        name: { $regex: new RegExp(`^${data.name}$`, "i") },
        _id: { $ne: id },
      });

      if (existingByName) {
        throw new Error("Ya existe un método de entrega con ese nombre");
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
   * Delete delivery method
   */
  async delete(id, businessId) {
    const result = await DeliveryMethod.deleteOne({
      _id: id,
      business: businessId,
    });

    return result.deletedCount > 0;
  }

  /**
   * Reorder delivery methods
   */
  async reorder(businessId, orderArray) {
    const bulkOps = orderArray.map((item, index) => ({
      updateOne: {
        filter: { _id: item.id, business: businessId },
        update: { $set: { displayOrder: index + 1 } },
      },
    }));

    await DeliveryMethod.bulkWrite(bulkOps);
  }

  /**
   * Initialize default methods
   */
  async initializeDefaults(businessId, userId) {
    return await DeliveryMethod.createDefaultMethods(businessId, userId);
  }
}

export default new DeliveryMethodRepository();
