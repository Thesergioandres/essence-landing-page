import { UserRepository } from "../../../infrastructure/database/repositories/UserRepository.js";

export class UserPersistenceUseCase {
  constructor(repository = new UserRepository()) {
    this.userRepository = repository;
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        const val = target.userRepository[prop];
        return typeof val === "function"
          ? val.bind(target.userRepository)
          : val;
      },
    });
  }

  async count() {
    return await this.userRepository.count();
  }
}
