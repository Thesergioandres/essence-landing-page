import SaleWriteRepositoryPort from "../../../domain/ports/SaleWriteRepositoryPort.js";
import { SaleRepository } from "../../database/repositories/SaleRepository.js";

export class SaleWriteRepositoryAdapter extends SaleWriteRepositoryPort {
  constructor(repository = new SaleRepository()) {
    super();
    this.repository = repository;
  }

  async create(saleData, session) {
    return this.repository.create(saleData, session);
  }
}

export default SaleWriteRepositoryAdapter;
