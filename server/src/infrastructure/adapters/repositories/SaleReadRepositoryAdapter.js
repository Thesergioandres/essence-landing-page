import SaleReadRepositoryPort from "../../../domain/ports/SaleReadRepositoryPort.js";
import { SaleRepository } from "../../database/repositories/SaleRepository.js";

export class SaleReadRepositoryAdapter extends SaleReadRepositoryPort {
  constructor(repository = new SaleRepository()) {
    super();
    this.repository = repository;
  }

  async list(businessId, options = {}) {
    return this.repository.list(businessId, options);
  }
}

export default SaleReadRepositoryAdapter;
