import PushSubscriptionRepository from "../../../infrastructure/database/repositories/PushSubscriptionRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const pushSubscriptionPersistenceUseCase = createRepositoryGateway(PushSubscriptionRepository);

export default pushSubscriptionPersistenceUseCase;
