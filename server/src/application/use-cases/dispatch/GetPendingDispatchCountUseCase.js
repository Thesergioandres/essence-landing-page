export class GetPendingDispatchCountUseCase {
  constructor(dispatchRepository) {
    this.dispatchRepository = dispatchRepository;
  }

  async execute({ businessId, options = {} }) {
    if (!businessId) {
      throw new Error("Negocio requerido para consultar pendientes");
    }

    return this.dispatchRepository.getPendingCount(businessId, options);
  }
}

export default GetPendingDispatchCountUseCase;
