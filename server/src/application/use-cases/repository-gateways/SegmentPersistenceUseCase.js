import SegmentRepository from "../../../infrastructure/database/repositories/SegmentRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const segmentPersistenceUseCase = createRepositoryGateway(SegmentRepository);

export default segmentPersistenceUseCase;
