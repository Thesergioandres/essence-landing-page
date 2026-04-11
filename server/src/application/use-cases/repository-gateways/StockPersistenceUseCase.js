import StockRepository from "../../../infrastructure/database/repositories/StockRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const stockPersistenceUseCase = createRepositoryGateway(StockRepository);

export default stockPersistenceUseCase;
