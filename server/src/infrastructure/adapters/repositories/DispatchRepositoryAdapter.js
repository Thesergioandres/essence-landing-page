import DispatchRepositoryPort from "../../../domain/ports/DispatchRepositoryPort.js";
import DispatchRepository from "../../database/repositories/DispatchRepository.js";

export class DispatchRepositoryAdapter extends DispatchRepositoryPort {
  constructor(repository = DispatchRepository) {
    super();
    this.repository = repository;
  }

  async createRequest(data, businessId, requesterId) {
    return this.repository.createRequest(data, businessId, requesterId);
  }

  async findById(requestId, businessId) {
    return this.repository.findById(requestId, businessId);
  }

  async findRequests(businessId, filters = {}) {
    return this.repository.findRequests(businessId, filters);
  }

  async dispatchRequest(requestId, businessId, userId, payload = {}) {
    return this.repository.dispatchRequest(
      requestId,
      businessId,
      userId,
      payload,
    );
  }

  async confirmReception(requestId, businessId, userId, options = {}) {
    return this.repository.confirmReception(
      requestId,
      businessId,
      userId,
      options,
    );
  }

  async getPendingCount(businessId, options = {}) {
    return this.repository.getPendingCount(businessId, options);
  }

  async getHotSectors(businessId, options = {}) {
    return this.repository.getHotSectors(businessId, options);
  }
}

export default DispatchRepositoryAdapter;
