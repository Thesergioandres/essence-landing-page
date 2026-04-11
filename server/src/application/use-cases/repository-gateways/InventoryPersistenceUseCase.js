import InventoryRepository from "../../../infrastructure/database/repositories/InventoryRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const inventoryPersistenceUseCase = createRepositoryGateway(InventoryRepository);

export default inventoryPersistenceUseCase;
