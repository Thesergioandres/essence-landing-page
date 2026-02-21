const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = (warning, ...args) => {
  const message =
    typeof warning === "string"
      ? warning
      : warning && typeof warning.message === "string"
        ? warning.message
        : "";

  if (message.includes("--localstorage-file")) {
    return;
  }

  return originalEmitWarning(warning, ...args);
};
