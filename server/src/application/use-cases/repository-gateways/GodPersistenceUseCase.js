import GodRepository from "../../../infrastructure/database/repositories/GodRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const godPersistenceUseCase = createRepositoryGateway(GodRepository);

export default godPersistenceUseCase;
