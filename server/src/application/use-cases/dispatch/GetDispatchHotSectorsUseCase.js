export class GetDispatchHotSectorsUseCase {
  constructor(dispatchRepository) {
    this.dispatchRepository = dispatchRepository;
  }

  async execute({ businessId, options = {} }) {
    if (!businessId) {
      throw new Error("Negocio requerido para consultar sectores calientes");
    }

    return this.dispatchRepository.getHotSectors(businessId, options);
  }
}

export default GetDispatchHotSectorsUseCase;
