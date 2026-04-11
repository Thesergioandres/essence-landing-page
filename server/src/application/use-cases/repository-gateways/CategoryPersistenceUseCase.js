import CategoryRepository from "../../../infrastructure/database/repositories/CategoryRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const categoryPersistenceUseCase = createRepositoryGateway(CategoryRepository);

export default categoryPersistenceUseCase;
