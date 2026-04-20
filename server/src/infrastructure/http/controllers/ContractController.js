import contractPersistenceUseCase from "../../../application/use-cases/repository-gateways/ContractPersistenceUseCase.js";

class ContractController {
  async list(req, res) {
    try {
      const data = await contractPersistenceUseCase.list({
        businessId: req.businessId,
        requesterRole: req.user?.role,
        requesterId: req.user?.id,
        signedBy: req.query?.signedBy ? String(req.query.signedBy) : null,
      });

      return res.json({ success: true, data });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await contractPersistenceUseCase.findById({
        contractId: req.params.id,
        businessId: req.businessId,
        requesterRole: req.user?.role,
        requesterId: req.user?.id,
      });

      return res.json({ success: true, data });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const data = await contractPersistenceUseCase.createSignedContract({
        businessId: req.businessId,
        requesterRole: req.user?.role,
        requesterId: req.user?.id,
        title: req.body?.title,
        content: req.body?.content,
        signatureData: req.body?.signatureData,
        photoData: req.body?.photoData,
        signedBy: req.body?.signedBy,
      });

      return res.status(201).json({ success: true, data });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const data = await contractPersistenceUseCase.updateById({
        contractId: req.params.id,
        businessId: req.businessId,
        requesterRole: req.user?.role,
        requesterId: req.user?.id,
        data: req.body || {},
      });

      return res.json({ success: true, data });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const data = await contractPersistenceUseCase.deleteById({
        contractId: req.params.id,
        businessId: req.businessId,
        requesterRole: req.user?.role,
      });

      return res.json({ success: true, data, message: data.message });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }
}

export default new ContractController();
