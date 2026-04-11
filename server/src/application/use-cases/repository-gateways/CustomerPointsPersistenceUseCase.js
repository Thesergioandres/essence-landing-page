import CustomerPointsRepository from "../../../infrastructure/database/repositories/CustomerPointsRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const customerPointsPersistenceUseCase = createRepositoryGateway(CustomerPointsRepository);

export default customerPointsPersistenceUseCase;
