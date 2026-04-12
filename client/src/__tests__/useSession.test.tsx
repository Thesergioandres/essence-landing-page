import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "../hooks/useSession";

vi.mock("../api/axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("../features/auth/services", () => ({
  authService: {
    getCurrentUser: vi.fn(),
    getProfile: vi.fn(),
  },
}));

const mockedApi = (await import("../api/axios")).default as unknown as {
  get: ReturnType<typeof vi.fn>;
};
const mockedAuth = (await import("../features/auth/services"))
  .authService as unknown as {
  getCurrentUser: ReturnType<typeof vi.fn>;
  getProfile: ReturnType<typeof vi.fn>;
};

describe("useSession", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("asigna businessId automáticamente para distribuidor con único membership", async () => {
    localStorage.setItem("token", "tkn");
    mockedAuth.getCurrentUser.mockReturnValue({
      role: "employee",
      token: "tkn",
    });
    mockedAuth.getProfile.mockResolvedValue({
      role: "employee",
      token: "tkn",
    });
    mockedApi.get.mockResolvedValue({
      data: { memberships: [{ business: { _id: "biz1" } }] },
    });

    renderHook(() => useSession());

    await waitFor(() => {
      expect(localStorage.getItem("businessId")).toBe("biz1");
    });
  });
});
