export class ListSalesUseCase {
  constructor(saleReadRepository) {
    this.saleReadRepository = saleReadRepository;
  }

  async execute({ businessId, filters = {} }) {
    if (!businessId) {
      throw new Error("Negocio requerido para listar ventas");
    }

    return this.saleReadRepository.list(businessId, filters);
  }
}

export default ListSalesUseCase;
