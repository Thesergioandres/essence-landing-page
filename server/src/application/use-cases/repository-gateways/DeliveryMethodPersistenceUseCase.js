import DeliveryMethodRepository from "../../../infrastructure/database/repositories/DeliveryMethodRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const deliveryMethodPersistenceUseCase = createRepositoryGateway(DeliveryMethodRepository);

export default deliveryMethodPersistenceUseCase;
