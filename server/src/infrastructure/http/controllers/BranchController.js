import BranchRepository from "../../database/repositories/BranchRepository.js";

class BranchController {
  async getAll(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      await BranchRepository.ensureWarehouse(businessId);
      const branches = await BranchRepository.findByBusiness(businessId);
      res.json({ success: true, data: branches });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const branch = await BranchRepository.findById(req.params.id, businessId);
      if (!branch)
        return res
          .status(404)
          .json({ success: false, message: "Sede no encontrada" });

      res.json({ success: true, data: branch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const {
        name,
        address,
        contactName,
        contactPhone,
        contactEmail,
        timezone,
        config,
      } = req.body;
      if (!name?.trim())
        return res.status(400).json({ message: "El nombre es obligatorio" });

      const branch = await BranchRepository.create({
        business: businessId,
        name: name.trim(),
        address,
        contactName,
        contactPhone,
        contactEmail,
        timezone: timezone || "America/Bogota",
        config: config || {},
      });

      res.status(201).json({ success: true, data: branch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const updates = {};
      const {
        name,
        address,
        contactName,
        contactPhone,
        contactEmail,
        timezone,
        config,
        active,
      } = req.body;
      if (name !== undefined) updates.name = name;
      if (address !== undefined) updates.address = address;
      if (contactName !== undefined) updates.contactName = contactName;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail;
      if (timezone !== undefined) updates.timezone = timezone;
      if (config !== undefined) updates.config = config;
      if (active !== undefined) updates.active = active;

      const branch = await BranchRepository.update(
        req.params.id,
        businessId,
        updates,
      );
      if (!branch)
        return res
          .status(404)
          .json({ success: false, message: "Sede no encontrada" });

      res.json({ success: true, data: branch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const branch = await BranchRepository.delete(req.params.id, businessId);
      if (!branch)
        return res
          .status(404)
          .json({ success: false, message: "Sede no encontrada" });

      res.json({ success: true, message: "Sede eliminada" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new BranchController();
