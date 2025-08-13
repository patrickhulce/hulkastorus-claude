import {GET, PUT, DELETE} from "./route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {startMockR2Server, stopMockR2Server} from "../../../../../../tests/mocks/r2-server";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    file: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    directory: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
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
        endpoint: "http://localhost:9010",
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

describe("/api/v1/files/:id", () => {
  beforeAll(async () => {
    _mockServerPort = await startMockR2Server(9010);
  });

  afterAll(async () => {
    await stopMockR2Server();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({
      user: {id: "test-user-id"},
    });
  });

  const mockFile = {
    id: "test-file-id",
    userId: "test-user-id",
    directoryId: "test-dir-id",
    filename: "test.txt",
    fullPath: "/test.txt",
    mimeType: "text/plain",
    sizeBytes: BigInt(1024),
    permissions: "private",
    status: "validated",
    expirationPolicy: "infinite",
    expiresAt: null,
    r2Locator: "test/infinite/test-user-id/test-file-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    directory: {
      fullPath: "/",
    },
    user: {
      id: "test-user-id",
      name: "Test User",
    },
  };

  describe("GET /api/v1/files/:id", () => {
    it("should return file metadata for owner", async () => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("test-file-id");
      expect(data.filename).toBe("test.txt");
      expect(data.downloadUrl).toBe("/api/v1/files/test-file-id/download");
    });

    it("should return file metadata for public files", async () => {
      const publicFile = {...mockFile, permissions: "public", userId: "other-user-id"};
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(publicFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("test-file-id");
      expect(data.downloadUrl).toBe("/d/test-file-id");
      expect(data.owner).toEqual({
        id: "test-user-id",
        name: "Test User",
      });
    });

    it("should return 404 for non-existent files", async () => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/nonexistent");
      const response = await GET(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should return 404 for expired files", async () => {
      const expiredFile = {...mockFile, expiresAt: new Date("2020-01-01")};
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(expiredFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File has expired");
    });
  });

  describe("PUT /api/v1/files/:id", () => {
    it("should update file metadata", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.update as jest.Mock).mockResolvedValue({
        ...mockFile,
        filename: "renamed.txt",
        permissions: "public",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          filename: "renamed.txt",
          permissions: "public",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filename).toBe("renamed.txt");
      expect(data.permissions).toBe("public");

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {id: "test-file-id"},
          data: expect.objectContaining({
            filename: "renamed.txt",
            permissions: "public",
          }),
        }),
      );
    });

    it("should update file expiration policy", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.update as jest.Mock).mockResolvedValue({
        ...mockFile,
        expirationPolicy: "7d",
        expiresAt: new Date(),
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          expirationPolicy: "7d",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.expirationPolicy).toBe("7d");
      expect(data.expiresAt).toBeDefined();
    });

    it("should move file to different directory", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue({
        id: "new-dir-id",
        fullPath: "/documents",
      });
      (prisma.file.update as jest.Mock).mockResolvedValue({
        ...mockFile,
        directoryId: "new-dir-id",
        fullPath: "/documents/test.txt",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          directoryId: "new-dir-id",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.directoryId).toBe("new-dir-id");
      expect(data.fullPath).toBe("/documents/test.txt");
    });

    it("should return 404 for non-existent files", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/nonexistent", {
        method: "PUT",
        body: JSON.stringify({
          filename: "renamed.txt",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should return 401 for unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          filename: "renamed.txt",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("DELETE /api/v1/files/:id", () => {
    it("should delete file and remove from R2", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.delete as jest.Mock).mockResolvedValue(mockFile);

      // Upload a test file to R2
      const {getR2Client} = jest.requireActual("@/lib/r2-config");
      const r2Client = getR2Client();
      await r2Client.putObject({
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "test-user-id",
        fileId: "test-file-id",
        body: "test content",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("File deleted successfully");

      expect(prisma.file.delete).toHaveBeenCalledWith({
        where: {id: "test-file-id"},
      });
    });

    it("should delete file even if R2 deletion fails", async () => {
      const fileWithBadLocator = {...mockFile, r2Locator: "invalid/locator"};
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(fileWithBadLocator);
      (prisma.file.delete as jest.Mock).mockResolvedValue(fileWithBadLocator);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("File deleted successfully");
      expect(prisma.file.delete).toHaveBeenCalled();
    });

    it("should return 404 for non-existent files", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/nonexistent", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should return 401 for unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});
