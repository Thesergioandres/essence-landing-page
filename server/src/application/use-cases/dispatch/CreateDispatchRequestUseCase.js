export class CreateDispatchRequestUseCase {
  constructor(dispatchRepository) {
    this.dispatchRepository = dispatchRepository;
  }

  async execute({ data, businessId, requesterId }) {
    if (!businessId) {
      throw new Error("Negocio requerido para crear despacho");
    }

    return this.dispatchRepository.createRequest(data, businessId, requesterId);
  }
}

export default CreateDispatchRequestUseCase;
