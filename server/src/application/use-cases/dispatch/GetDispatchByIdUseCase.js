export class GetDispatchByIdUseCase {
  constructor(dispatchRepository) {
    this.dispatchRepository = dispatchRepository;
  }

  async execute({ requestId, businessId }) {
    if (!businessId) {
      throw new Error("Negocio requerido para consultar despacho");
    }

    if (!requestId) {
      throw new Error("Id de despacho requerido");
    }

    return this.dispatchRepository.findById(requestId, businessId);
  }
}

export default GetDispatchByIdUseCase;
