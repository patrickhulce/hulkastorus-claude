import {POST} from "./route";
import {DELETE} from "./[id]/route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock nanoid
jest.mock("@/lib/nanoid", () => ({
  generateNanoId: () => "test-nano-id",
}));

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

describe("/api/v1/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/users", () => {
    it("should create a new user with hashed password", async () => {
      const mockUser = {
        id: "test-nano-id",
        email: "test@example.com",
        password: "hashed-password",
        firstName: "John",
        lastName: "Doe",
        inviteCode: "WELCOMETOTHEPARTYPAL",
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const request = new NextRequest("http://localhost:3000/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
          inviteCode: "WELCOMETOTHEPARTYPAL",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify bcrypt was called
      const bcrypt = await import("bcryptjs");
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);

      expect(response.status).toBe(201);
      expect(data.email).toBe("test@example.com");
      expect(data.password).toBeUndefined();
    });
  });

  describe("DELETE /api/v1/users/:id", () => {
    it("should delete a user", async () => {
      (prisma.user.delete as jest.Mock).mockResolvedValue({});

      const request = new NextRequest("http://localhost:3000/api/v1/users/test-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: {id: "test-id"}});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("User deleted successfully");
    });
  });
});
