import { CustomerRepository } from "../../database/repositories/CustomerRepository.js";

const repository = new CustomerRepository();

export class CustomerController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const customer = await repository.create(
        { ...req.body, business: businessId },
        req.user._id,
        req.user,
      );

      res.status(201).json({ success: true, data: customer });
    } catch (error) {
      const status = error.statusCode || 500;
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
        data: result.customers,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const customer = await repository.findById(req.params.id, businessId);

      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Cliente no encontrado" });
      }

      res.json({ success: true, data: customer });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId;
      const customer = await repository.update(
        req.params.id,
        businessId,
        req.body,
        req.user._id,
        req.user,
      );

      res.json({ success: true, data: customer });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      await repository.delete(req.params.id, businessId, req.user);

      res.json({ success: true, message: "Cliente eliminado" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
