import Branch from "../../../../models/Branch.js";

class BranchRepository {
  async findByBusiness(businessId) {
    return Branch.find({ business: businessId }).sort({ createdAt: -1 }).lean();
  }

  async findById(branchId, businessId) {
    return Branch.findOne({ _id: branchId, business: businessId }).lean();
  }

  async findWarehouse(businessId) {
    return Branch.findOne({ business: businessId, isWarehouse: true });
  }

  async create(data) {
    const branch = await Branch.create(data);
    return branch.toObject();
  }

  async update(branchId, businessId, updates) {
    return Branch.findOneAndUpdate(
      { _id: branchId, business: businessId },
      updates,
      { new: true },
    ).lean();
  }

  async delete(branchId, businessId) {
    return Branch.findOneAndDelete({
      _id: branchId,
      business: businessId,
    }).lean();
  }

  async ensureWarehouse(businessId) {
    let branch = await this.findWarehouse(businessId);
    if (!branch) {
      branch = await Branch.findOne({ business: businessId, name: "Bodega" });
      if (branch && !branch.isWarehouse) {
        branch.isWarehouse = true;
        await branch.save();
      }
    }
    if (!branch) {
      branch = await this.create({
        business: businessId,
        name: "Bodega",
        isWarehouse: true,
        active: true,
      });
    }
    return branch;
  }
}

export default new BranchRepository();
