export const createRepositoryGateway = (repository) =>
  new Proxy(
    {},
    {
      get(_target, propertyKey) {
        const value = repository[propertyKey];
        return typeof value === "function" ? value.bind(repository) : value;
      },
      set(_target, propertyKey, value) {
        repository[propertyKey] = value;
        return true;
      },
    },
  );
