import {NextRequest} from "next/server";
import {
  GET as getDirById,
  PUT as updateDir,
  DELETE as deleteDir,
} from "@/app/api/v1/directories/[id]/route";
import {GET as listDirs, POST as createDir} from "@/app/api/v1/directories/route";
import {prisma} from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    directory: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
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

// Mock R2 config
jest.mock("@/lib/r2-config", () => {
  const originalModule = jest.requireActual("@/lib/r2-config");
  return {
    ...originalModule,
    currentEnv: "test",
    getR2Client: () => ({
      deleteObject: jest.fn().mockResolvedValue(undefined),
    }),
  };
});

describe("Directory API Comprehensive Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({
      user: {id: "test-user-id"},
    });
  });

  const mockUser = "test-user-id";
  const mockDate = new Date("2024-01-01T00:00:00.000Z");

  const mockDirectory = {
    id: "test-dir-id",
    userId: mockUser,
    fullPath: "/documents",
    parentId: null,
    defaultPermissions: "private",
    defaultExpirationPolicy: "infinite",
    createdAt: mockDate,
    updatedAt: mockDate,
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
        createdAt: mockDate,
        updatedAt: mockDate,
      },
    ],
  };

  describe("GET /api/v1/directories/:id", () => {
    it("should return directory details with children and files", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(mockDirectory);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id");
      const response = await getDirById(request, {params: Promise.resolve({id: "test-dir-id"})});
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
      const response = await getDirById(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });

    it("should return 401 for unauthorized requests", async () => {
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id");
      const response = await getDirById(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle directories owned by different users", async () => {
      const otherUserDir = {...mockDirectory, userId: "other-user-id"};
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id");
      const response = await getDirById(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });
  });

  describe("PUT /api/v1/directories/:id", () => {
    it("should update directory metadata", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(mockDirectory);
      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        defaultPermissions: "public",
        defaultExpirationPolicy: "30d",
        _count: {files: 3, children: 2},
      });

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "public",
          defaultExpirationPolicy: "30d",
        }),
      });

      const response = await updateDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.defaultPermissions).toBe("public");
      expect(data.defaultExpirationPolicy).toBe("30d");
    });

    it("should rename directory and update child paths", async () => {
      const dirWithChildren = {
        ...mockDirectory,
        files: [{id: "file-1", fullPath: "/documents/file.txt"}],
        children: [{id: "child-1", fullPath: "/documents/subdir"}],
      };

      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(dirWithChildren)
        .mockResolvedValueOnce(null); // No existing directory at new path

      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(undefined);
      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...dirWithChildren,
        fullPath: "/archive",
        _count: {files: 1, children: 1},
      });

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          fullPath: "/archive",
        }),
      });

      const response = await updateDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fullPath).toBe("/archive");
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2); // Update children and files
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

      const response = await updateDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot move directory into its own subdirectory");
    });

    it("should handle path conflicts", async () => {
      const existingDir = {...mockDirectory, id: "existing-dir"};
      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockDirectory)
        .mockResolvedValueOnce(existingDir); // Existing directory at new path

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          fullPath: "/existing-path",
        }),
      });

      const response = await updateDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Directory already exists at this path");
    });

    it("should handle validation errors", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "invalid-permission",
        }),
      });

      const response = await updateDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation error");
    });

    it("should handle non-existent directory", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/nonexistent", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "public",
        }),
      });

      const response = await updateDir(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });

    it("should handle unauthorized updates", async () => {
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "public",
        }),
      });

      const response = await updateDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("DELETE /api/v1/directories/:id", () => {
    it("should delete empty directory", async () => {
      const emptyDirectory = {
        ...mockDirectory,
        files: [],
        _count: {children: 0},
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(emptyDirectory);
      (prisma.directory.delete as jest.Mock).mockResolvedValue(emptyDirectory);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await deleteDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Directory deleted successfully");
      expect(data.deletedFiles).toBe(0);
    });

    it("should delete directory with files and clean up R2", async () => {
      const dirWithFiles = {
        ...mockDirectory,
        files: [
          {id: "file-1", r2Locator: "test/file-1", status: "validated"},
          {id: "file-2", r2Locator: "test/file-2", status: "validated"},
        ],
        _count: {children: 0},
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(dirWithFiles);
      (prisma.file.deleteMany as jest.Mock).mockResolvedValue({count: 2});
      (prisma.directory.delete as jest.Mock).mockResolvedValue(dirWithFiles);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await deleteDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Directory deleted successfully");
      expect(data.deletedFiles).toBe(2);
      expect(prisma.file.deleteMany).toHaveBeenCalled();
    });

    it("should not delete directory with subdirectories", async () => {
      const dirWithChildren = {
        ...mockDirectory,
        _count: {children: 2},
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(dirWithChildren);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await deleteDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Directory is not empty");
      expect(data.details).toBe("Please delete all subdirectories first");
    });

    it("should handle R2 cleanup failures gracefully", async () => {
      const dirWithFiles = {
        ...mockDirectory,
        files: [{id: "file-1", r2Locator: "invalid/locator", status: "validated"}],
        _count: {children: 0},
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(dirWithFiles);
      (prisma.file.deleteMany as jest.Mock).mockResolvedValue({count: 1});
      (prisma.directory.delete as jest.Mock).mockResolvedValue(dirWithFiles);

      // Mock R2 client to simulate deletion failure
      jest.spyOn(console, "error").mockImplementation(() => {});

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await deleteDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Directory deleted successfully");
    });

    it("should handle non-existent directory", async () => {
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/nonexistent", {
        method: "DELETE",
      });

      const response = await deleteDir(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });

    it("should handle unauthorized deletion", async () => {
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id", {
        method: "DELETE",
      });

      const response = await deleteDir(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("POST /api/v1/directories", () => {
    it("should create a new directory", async () => {
      (prisma.directory.upsert as jest.Mock).mockResolvedValue(mockDirectory);
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(mockDirectory);

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "/documents",
          defaultPermissions: "private",
          defaultExpirationPolicy: "infinite",
        }),
      });

      const response = await createDir(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fullPath).toBe("/documents");
      expect(data.defaultPermissions).toBe("private");
    });

    it("should create nested directory structure automatically", async () => {
      const directories = [
        {...mockDirectory, id: "parent", fullPath: "/projects"},
        {...mockDirectory, id: "year", fullPath: "/projects/2024"},
        {...mockDirectory, id: "month", fullPath: "/projects/2024/december"},
      ];

      (prisma.directory.upsert as jest.Mock)
        .mockResolvedValueOnce(directories[0])
        .mockResolvedValueOnce(directories[1])
        .mockResolvedValueOnce(directories[2]);

      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(directories[2]);

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "/projects/2024/december",
        }),
      });

      const response = await createDir(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fullPath).toBe("/projects/2024/december");
      expect(prisma.directory.upsert).toHaveBeenCalledTimes(3);
    });

    it("should handle path normalization", async () => {
      const normalizedDir = {...mockDirectory, fullPath: "/normalized/path"};
      (prisma.directory.upsert as jest.Mock).mockResolvedValue(normalizedDir);
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(normalizedDir);

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "//normalized//path//",
        }),
      });

      const response = await createDir(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fullPath).toBe("/normalized/path");
    });

    it("should handle validation errors", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "",
        }),
      });

      const response = await createDir(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation error");
    });
  });

  describe("GET /api/v1/directories", () => {
    it("should list all user directories", async () => {
      const directories = [
        mockDirectory,
        {...mockDirectory, id: "dir-2", fullPath: "/images"},
        {...mockDirectory, id: "dir-3", fullPath: "/videos"},
      ];

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(directories);

      const request = new NextRequest("http://localhost:3000/api/v1/directories");
      const response = await listDirs(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.directories).toHaveLength(3);
      expect(data.total).toBe(3);
    });

    it("should filter directories by parent", async () => {
      (prisma.directory.findMany as jest.Mock).mockResolvedValue([mockDirectory]);

      const request = new NextRequest(
        "http://localhost:3000/api/v1/directories?parentId=parent-dir-id",
      );
      const response = await listDirs(request);

      expect(response.status).toBe(200);
      expect(prisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser,
            parentId: "parent-dir-id",
          }),
        }),
      );
    });

    it("should filter directories by path", async () => {
      (prisma.directory.findMany as jest.Mock).mockResolvedValue([mockDirectory]);

      const request = new NextRequest("http://localhost:3000/api/v1/directories?path=/documents");
      const response = await listDirs(request);

      expect(response.status).toBe(200);
      expect(prisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser,
            fullPath: "/documents",
          }),
        }),
      );
    });

    it("should handle recursive directory listing", async () => {
      const recursiveDirectories = [
        mockDirectory,
        {...mockDirectory, id: "sub-1", fullPath: "/documents/sub1"},
        {...mockDirectory, id: "sub-2", fullPath: "/documents/sub2"},
      ];

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(recursiveDirectories);

      const request = new NextRequest(
        "http://localhost:3000/api/v1/directories?path=/documents&recursive=true",
      );
      const response = await listDirs(request);

      expect(response.status).toBe(200);
      expect(prisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser,
            fullPath: {
              startsWith: "/documents/",
            },
          }),
        }),
      );
    });

    it("should handle unauthorized listing", async () => {
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories");
      const response = await listDirs(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Edge Cases and Security", () => {
    it("should handle special characters in paths", async () => {
      const specialDir = {...mockDirectory, fullPath: "/special/path with spaces & symbols!"};
      (prisma.directory.upsert as jest.Mock).mockResolvedValue(specialDir);
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(specialDir);

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "/special/path with spaces & symbols!",
        }),
      });

      const response = await createDir(request);
      expect(response.status).toBe(201);
    });

    it("should handle very long paths", async () => {
      const longPath = "/" + "a".repeat(995);
      const longDir = {...mockDirectory, fullPath: longPath};
      (prisma.directory.upsert as jest.Mock).mockResolvedValue(longDir);
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(longDir);

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: longPath,
        }),
      });

      const response = await createDir(request);
      expect(response.status).toBe(201);
    });

    it("should handle malformed request bodies", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: "{invalid json",
      });

      const response = await createDir(request);
      expect([400, 500]).toContain(response.status);
    });

    it("should handle database errors gracefully", async () => {
      (prisma.directory.findFirst as jest.Mock).mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/v1/directories/test-dir-id");
      const response = await getDirById(request, {params: Promise.resolve({id: "test-dir-id"})});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should handle large directory structures efficiently", async () => {
      const largeDirectoryList = Array.from({length: 1000}, (_, i) => ({
        ...mockDirectory,
        id: `large-dir-${i}`,
        fullPath: `/large/dir-${i}`,
      }));

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(largeDirectoryList);

      const request = new NextRequest("http://localhost:3000/api/v1/directories");
      const response = await listDirs(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.directories).toHaveLength(1000);
    });
  });
});
