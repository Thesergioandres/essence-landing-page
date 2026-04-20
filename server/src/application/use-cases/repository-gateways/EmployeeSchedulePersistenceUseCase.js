import employeeScheduleRepository from "../../../infrastructure/database/repositories/EmployeeScheduleRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const employeeSchedulePersistenceUseCase = createRepositoryGateway(
  employeeScheduleRepository,
);

export default employeeSchedulePersistenceUseCase;
