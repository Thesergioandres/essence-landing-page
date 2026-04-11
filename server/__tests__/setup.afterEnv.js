import { jest } from "@jest/globals";
import mongoose from "mongoose";

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    const dbName = (mongoose.connection.name || "").toLowerCase();

    if (!dbName.includes("test")) {
      throw new Error(
        `[TEST SAFETY] Refusing to drop non-test database: ${mongoose.connection.name}`,
      );
    }

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
