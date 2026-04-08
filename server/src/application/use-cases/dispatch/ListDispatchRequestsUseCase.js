export class ListDispatchRequestsUseCase {
  constructor(dispatchRepository) {
    this.dispatchRepository = dispatchRepository;
  }

  async execute({ businessId, filters = {} }) {
    if (!businessId) {
      throw new Error("Negocio requerido para listar despachos");
    }

    return this.dispatchRepository.findRequests(businessId, filters);
  }
}

export default ListDispatchRequestsUseCase;
