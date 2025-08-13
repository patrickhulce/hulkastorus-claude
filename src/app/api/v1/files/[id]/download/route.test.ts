import {GET} from "./route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {startMockR2Server, stopMockR2Server} from "../../../../../../../tests/mocks/r2-server";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    file: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

// Mock next-auth/jwt
jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

// Mock R2 config to use test server
jest.mock("@/lib/r2-config", () => {
  const originalModule = jest.requireActual("@/lib/r2-config");
  return {
    ...originalModule,
    currentEnv: "test",
    getR2Client: () => {
      const {R2Client} = jest.requireActual("@/lib/r2-client");
      return new R2Client({
        endpoint: "http://localhost:9006",
        accessKeyId: "test",
        secretAccessKey: "test",
        bucketName: "test-bucket",
        region: "auto",
      });
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _mockServerPort: number;

describe("GET /api/v1/files/:id/download", () => {
  beforeAll(async () => {
    _mockServerPort = await startMockR2Server(9006);
  });

  afterAll(async () => {
    await stopMockR2Server();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPublicFile = {
    id: "test-file-id",
    userId: "file-owner-id",
    status: "validated",
    r2Locator: "test/infinite/file-owner-id/test-file-id",
    filename: "test.txt",
    fullPath: "/test.txt",
    permissions: "public",
    expiresAt: null,
    user: {id: "file-owner-id"},
  };

  const mockPrivateFile = {
    ...mockPublicFile,
    permissions: "private",
  };

  const mockExpiredFile = {
    ...mockPublicFile,
    expiresAt: new Date("2020-01-01"), // Past date
  };

  describe("Public files", () => {
    beforeEach(() => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockPublicFile);
    });

    it("should redirect to download URL for public files", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});

      expect(response.status).toBe(307); // Redirect
      const location = response.headers.get("Location");
      expect(location).toContain("http://localhost:9006");
      expect(location).toContain("test/infinite/file-owner-id/test-file-id");
    });

    it("should work without authentication for public files", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {auth} = require("@/lib/auth");
      auth.mockRejectedValue(new Error("No session"));

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});

      expect(response.status).toBe(307); // Redirect
    });
  });

  describe("Private files", () => {
    beforeEach(() => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockPrivateFile);
    });

    it("should redirect to download URL for file owner", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue({
        user: {id: "file-owner-id"},
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});

      expect(response.status).toBe(307); // Redirect
      const location = response.headers.get("Location");
      expect(location).toContain("http://localhost:9006");
    });

    it("should reject access for non-owner", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue({
        user: {id: "different-user-id"},
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should reject access for unauthenticated users", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });
  });

  describe("File validation", () => {
    it("should reject non-existent files", async () => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/nonexistent/download");

      const response = await GET(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should reject expired files", async () => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockExpiredFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should reject non-validated files", async () => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue({
        ...mockPublicFile,
        status: "reserved",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should reject files without R2 locator", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue({
        user: {id: "file-owner-id"},
      });

      (prisma.file.findUnique as jest.Mock).mockResolvedValue({
        ...mockPrivateFile,
        r2Locator: null,
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("File not available");
    });

    it("should reject files with invalid R2 locator", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue({
        user: {id: "file-owner-id"},
      });

      (prisma.file.findUnique as jest.Mock).mockResolvedValue({
        ...mockPrivateFile,
        r2Locator: "invalid-locator-format",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Invalid file locator");
    });
  });

  describe("Download tokens", () => {
    it("should handle download token parameter", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const getToken = jest.mocked(require("next-auth/jwt").getToken);
      getToken.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/v1/files/test-file-id/download?token=some-token",
      );

      await GET(request, {params: Promise.resolve({id: "test-file-id"})});

      expect(getToken).toHaveBeenCalledWith(
        expect.objectContaining({
          req: expect.any(Object),
          secret: undefined,
          raw: true,
        }),
      );
    });
  });

  describe("Error handling", () => {
    it("should handle auth service errors gracefully", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockRejectedValue(new Error("Auth service down"));

      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockPublicFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});

      // Should still work for public files even if auth fails
      expect(response.status).toBe(307);
    });

    it("should handle database errors", async () => {
      (prisma.file.findUnique as jest.Mock).mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/download");

      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
