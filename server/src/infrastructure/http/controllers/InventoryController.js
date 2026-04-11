import inventoryPersistenceUseCase from "../../../application/use-cases/repository-gateways/InventoryPersistenceUseCase.js";

class InventoryController {
  async createEntry(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const result = await inventoryPersistenceUseCase.createEntry(
        businessId,
        req.body,
        req.user.id,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async listEntries(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const { page, limit, ...filters } = req.query;
      const result = await inventoryPersistenceUseCase.listEntries(
        businessId,
        filters,
        page,
        limit,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateEntry(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const result = await inventoryPersistenceUseCase.updateEntry(
        businessId,
        req.params.id,
        req.body,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteEntry(req, res) {
    try {
      const businessId = req.businessId || req.headers["x-business-id"];
      if (!businessId)
        return res.status(400).json({ message: "Falta x-business-id" });

      const result = await inventoryPersistenceUseCase.deleteEntry(
        businessId,
        req.params.id,
        req.user?.id,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new InventoryController();
