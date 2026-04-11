import PaymentMethodRepository from "../../../infrastructure/database/repositories/PaymentMethodRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const paymentMethodPersistenceUseCase = createRepositoryGateway(PaymentMethodRepository);

export default paymentMethodPersistenceUseCase;
