import { ProviderPersistenceUseCase } from "../../../application/use-cases/repository-gateways/ProviderPersistenceUseCase.js";

const repository = new ProviderPersistenceUseCase();

const normalizeProviderPayload = (payload = {}) => {
  const normalized = {};

  if (payload.name !== undefined) normalized.name = payload.name;
  if (payload.contactName !== undefined)
    normalized.contactName = payload.contactName;
  if (payload.address !== undefined) normalized.address = payload.address;
  if (payload.notes !== undefined) normalized.notes = payload.notes;
  if (payload.metadata !== undefined) normalized.metadata = payload.metadata;

  const resolvedPhone =
    payload.contactPhone !== undefined ? payload.contactPhone : payload.phone;
  if (resolvedPhone !== undefined) {
    normalized.contactPhone = resolvedPhone;
  }

  const resolvedEmail =
    payload.contactEmail !== undefined ? payload.contactEmail : payload.email;
  if (resolvedEmail !== undefined) {
    normalized.contactEmail = resolvedEmail;
  }

  const resolvedActive =
    payload.active !== undefined ? payload.active : payload.isActive;
  if (resolvedActive !== undefined) {
    normalized.active = Boolean(resolvedActive);
  }

  return normalized;
};

export class ProviderController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const providerPayload = normalizeProviderPayload(req.body || {});

      const provider = await repository.create({
        ...providerPayload,
        business: businessId,
      });
      res.status(201).json({ success: true, data: provider });
    } catch (error) {
      const status = error.code === 11000 ? 409 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.findByBusiness(businessId, req.query);
      res.json({
        success: true,
        data: result.providers,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const provider = await repository.findById(req.params.id, businessId);

      if (!provider) {
        return res
          .status(404)
          .json({ success: false, message: "Proveedor no encontrado" });
      }

      res.json({ success: true, data: provider });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId;
      const providerPayload = normalizeProviderPayload(req.body || {});
      const provider = await repository.update(
        req.params.id,
        businessId,
        providerPayload,
      );
      res.json({ success: true, data: provider });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      await repository.delete(req.params.id, businessId);
      res.json({ success: true, message: "Proveedor eliminado" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
