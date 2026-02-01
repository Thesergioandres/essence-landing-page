import { BusinessRepository } from "../../database/repositories/BusinessRepository.js";

const repository = new BusinessRepository();

export class BusinessController {
  async create(req, res) {
    try {
      const business = await repository.create(req.body, req.user.id);
      res.status(201).json({ success: true, data: business });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const businesses = await repository.findAll();
      res.json({ success: true, data: businesses });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const result = await repository.findWithMembers(req.params.id);
      if (!result.business) {
        return res
          .status(404)
          .json({ success: false, message: "Negocio no encontrado" });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const business = await repository.update(req.business._id, req.body);
      res.json({ success: true, data: business });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async updateFeatures(req, res) {
    try {
      const { features } = req.body;
      if (!features || typeof features !== "object") {
        return res
          .status(400)
          .json({ success: false, message: "features es requerido" });
      }

      const business = await repository.updateFeatures(
        req.business._id,
        features,
      );
      res.json({ success: true, data: business });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async addMember(req, res) {
    try {
      const { userId, role, permissions, allowedBranches } = req.body;
      if (!userId || !role) {
        return res
          .status(400)
          .json({ success: false, message: "userId y role son requeridos" });
      }

      const membership = await repository.addMember(req.businessId, {
        userId,
        role,
        permissions,
        allowedBranches,
      });

      res.status(201).json({ success: true, data: membership });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateMember(req, res) {
    try {
      const membership = await repository.updateMember(
        req.businessId,
        req.params.membershipId,
        req.body,
      );
      res.json({ success: true, data: membership });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async removeMember(req, res) {
    try {
      await repository.removeMember(req.businessId, req.params.membershipId);
      res.json({ success: true, message: "Miembro eliminado" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getMembers(req, res) {
    try {
      const members = await repository.getMembers(req.businessId);
      res.json({ success: true, data: members });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
