export class DispatchRepositoryPort {
  async createRequest(_data, _businessId, _requesterId) {
    throw new Error("DispatchRepositoryPort.createRequest no implementado");
  }

  async findById(_requestId, _businessId) {
    throw new Error("DispatchRepositoryPort.findById no implementado");
  }

  async findRequests(_businessId, _filters) {
    throw new Error("DispatchRepositoryPort.findRequests no implementado");
  }

  async dispatchRequest(_requestId, _businessId, _userId, _payload) {
    throw new Error("DispatchRepositoryPort.dispatchRequest no implementado");
  }

  async confirmReception(_requestId, _businessId, _userId, _options) {
    throw new Error("DispatchRepositoryPort.confirmReception no implementado");
  }

  async getPendingCount(_businessId, _options) {
    throw new Error("DispatchRepositoryPort.getPendingCount no implementado");
  }

  async getHotSectors(_businessId, _options) {
    throw new Error("DispatchRepositoryPort.getHotSectors no implementado");
  }
}

export default DispatchRepositoryPort;
