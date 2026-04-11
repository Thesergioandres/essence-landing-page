/**
 * Segment Repository - Data Access Layer
 * Handles customer segment operations in Hexagonal Architecture
 */

import AuditLog from "../models/AuditLog.js";
import Segment from "../models/Segment.js";

class SegmentRepository {
  /**
   * Create audit log entry
   */
  async createAuditLog(
    businessId,
    userId,
    userDetails,
    entity,
    action,
    oldValues = null,
  ) {
    try {
      await AuditLog.create({
        business: businessId,
        user: userId,
        userEmail: userDetails?.email,
        userName: userDetails?.name,
        userRole: userDetails?.role,
        action,
        module: "clients",
        description: `${action} ${entity.name}`,
        entityType: "Segment",
        entityId: entity._id,
        entityName: entity.name,
        oldValues,
        newValues: entity,
      });
    } catch (error) {
      console.error("Audit log segment error:", error?.message);
    }
  }

  /**
   * Create segment
   */
  async create(businessId, data, user) {
    const { name, key, description, color, icon } = data;

    if (!name) {
      throw new Error("El nombre es obligatorio");
    }

    if (!key) {
      throw new Error("La clave es obligatoria");
    }

    const segment = await Segment.create({
      name: name.trim(),
      key: key.trim().toLowerCase(),
      description,
      color,
      icon,
      business: businessId,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await this.createAuditLog(
      businessId,
      user._id,
      user,
      segment,
      "segment_created",
    );

    return segment;
  }

  /**
   * Find all segments for business
   */
  async findByBusiness(businessId) {
    return await Segment.find({ business: businessId }).sort({
      createdAt: -1,
    });
  }

  /**
   * Find segment by ID
   */
  async findById(id, businessId) {
    return await Segment.findOne({
      _id: id,
      business: businessId,
    });
  }

  /**
   * Update segment
   */
  async update(id, businessId, data, user) {
    const segment = await this.findById(id, businessId);

    if (!segment) {
      return null;
    }

    const oldValues = segment.toObject();

    Object.assign(segment, {
      ...data,
      updatedBy: user._id,
      updatedAt: new Date(),
    });

    await segment.save();

    await this.createAuditLog(
      businessId,
      user._id,
      user,
      segment,
      "segment_updated",
      oldValues,
    );

    return segment;
  }

  /**
   * Delete segment
   */
  async delete(id, businessId, user) {
    const segment = await this.findById(id, businessId);

    if (!segment) {
      return false;
    }

    await Segment.deleteOne({ _id: id, business: businessId });

    await this.createAuditLog(
      businessId,
      user._id,
      user,
      segment,
      "segment_deleted",
    );

    return true;
  }
}

export default new SegmentRepository();
