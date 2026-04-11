import ExpenseRepository from "../../../infrastructure/database/repositories/ExpenseRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const expensePersistenceUseCase = createRepositoryGateway(ExpenseRepository);

export default expensePersistenceUseCase;
