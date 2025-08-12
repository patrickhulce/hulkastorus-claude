import {GET, PUT, DELETE} from "./route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {startMockR2Server, stopMockR2Server} from "../../../../../../tests/mocks/r2-server";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    directory: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    file: {
      deleteMany: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
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
        endpoint: "http://localhost:9011",
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

describe("/api/v1/directories/:id", () => {
  beforeAll(async () => {
    _mockServerPort = await startMockR2Server(9011);
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

  const mockDirectory = {
    id: "test-dir-id",
    userId: "test-user-id",
    fullPath: "/documents",
    parentId: null,
    defaultPermissions: "private",
    defaultExpirationPolicy: "infinite",
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      files: 3,
      children: 2,
    },
    parent: null,
    children: [
      {
        id: "child-1",
        fullPath: "/documents/projects",
        _count: {files: 1, children: 0},
      },
      {
        id: "child-2",
        fullPath: "/documents/archive",
        _count: {files: 2, children: 1},
      },
    ],
    files: [
      {
        id: "file-1",
        filename: "report.pdf",
        fullPath: "/documents/report.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(2048),
        permissions: "private",
        status: "validated",
        expirationPolicy: "infinite",
        expiresAt: null,
        r2Locator: "test/infinite/test-user-id/file-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  describe("GET /api/v1/directories/:id", () => {
    it("should return directory details with children and files", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(mockDirectory);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("test-dir-id");
      expect(data.fullPath).toBe("/documents");
      expect(data.fileCount).toBe(3);
      expect(data.subdirectoryCount).toBe(2);
      expect(data.children).toHaveLength(2);
      expect(data.files).toHaveLength(1);
    });

    it("should return 404 for non-existent directory", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/nonexistent");
      const response = await GET(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });

    it("should return 401 for unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("PUT /api/v1/directories/:id", () => {
    it("should update directory metadata", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(mockDirectory);
      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        defaultPermissions: "public",
        defaultExpirationPolicy: "30d",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "public",
          defaultExpirationPolicy: "30d",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.defaultPermissions).toBe("public");
      expect(data.defaultExpirationPolicy).toBe("30d");

      expect(prisma.directory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {id: "test-dir-id"},
          data: expect.objectContaining({
            defaultPermissions: "public",
            defaultExpirationPolicy: "30d",
          }),
        }),
      );
    });

    it("should rename directory and update child paths", async () => {
      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockDirectory)
        .mockResolvedValueOnce(null); // No existing directory at new path
      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        fullPath: "/archive",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          fullPath: "/archive",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fullPath).toBe("/archive");

      // Should update child directories and files
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it("should prevent moving directory into its own subdirectory", async () => {
      const parentDir = {
        ...mockDirectory,
        id: "parent-dir",
        fullPath: "/documents/projects/2024",
      };
      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockDirectory)
        .mockResolvedValueOnce(parentDir);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          parentId: "parent-dir",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot move directory into its own subdirectory");
    });

    it("should return 404 for non-existent directory", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/nonexistent", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "public",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });
  });

  describe("DELETE /api/v1/directories/:id", () => {
    it("should delete empty directory", async () => {
      const emptyDirectory = {
        ...mockDirectory,
        files: [],
        _count: {
          files: 0,
          children: 0,
        },
      };
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(emptyDirectory);
      (prisma.directory.delete as jest.Mock).mockResolvedValue(emptyDirectory);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Directory deleted successfully");
      expect(data.deletedFiles).toBe(0);

      expect(prisma.directory.delete).toHaveBeenCalledWith({
        where: {id: "test-dir-id"},
      });
    });

    it("should delete directory with files", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        _count: {
          files: 3,
          children: 0, // No subdirectories
        },
      });
      (prisma.file.deleteMany as jest.Mock).mockResolvedValue({count: 3});
      (prisma.directory.delete as jest.Mock).mockResolvedValue(mockDirectory);

      // Upload test file to R2
      const {getR2Client} = jest.requireActual("@/lib/r2-config");
      const r2Client = getR2Client();
      await r2Client.putObject({
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "test-user-id",
        fileId: "file-1",
        body: "test content",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Directory deleted successfully");
      expect(data.deletedFiles).toBe(1);

      expect(prisma.file.deleteMany).toHaveBeenCalledWith({
        where: {directoryId: "test-dir-id"},
      });
    });

    it("should not delete directory with subdirectories", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(mockDirectory);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Directory is not empty");
      expect(data.details).toBe("Please delete all subdirectories first");
    });

    it("should return 404 for non-existent directory", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/nonexistent", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });

    it("should return 401 for unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});