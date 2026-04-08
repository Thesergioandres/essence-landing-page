export class MarkDispatchAsDispatchedUseCase {
  constructor(dispatchRepository) {
    this.dispatchRepository = dispatchRepository;
  }

  async execute({ requestId, businessId, userId, payload = {} }) {
    if (!businessId) {
      throw new Error("Negocio requerido para despachar");
    }

    if (!requestId) {
      throw new Error("Id de despacho requerido");
    }

    return this.dispatchRepository.dispatchRequest(
      requestId,
      businessId,
      userId,
      payload,
    );
  }
}

export default MarkDispatchAsDispatchedUseCase;
