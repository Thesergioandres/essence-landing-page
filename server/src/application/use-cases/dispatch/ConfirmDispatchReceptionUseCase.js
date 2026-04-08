export class ConfirmDispatchReceptionUseCase {
  constructor(dispatchRepository) {
    this.dispatchRepository = dispatchRepository;
  }

  async execute({ requestId, businessId, userId, allowGodBypass = false }) {
    if (!businessId) {
      throw new Error("Negocio requerido para confirmar recepción");
    }

    if (!requestId) {
      throw new Error("Id de despacho requerido");
    }

    return this.dispatchRepository.confirmReception(
      requestId,
      businessId,
      userId,
      {
        allowGodBypass,
      },
    );
  }
}

export default ConfirmDispatchReceptionUseCase;
