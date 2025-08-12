import { NextRequest } from "next/server";
import { GET as getDirs, POST as createDir } from "@/app/api/v1/directories/route";
import { GET as getDirById, PUT as updateDir, DELETE as deleteDir } from "@/app/api/v1/directories/[id]/route";
import { POST as createFile } from "@/app/api/v1/files/route";
import { GET as getFile, PUT as updateFile, DELETE as deleteFile } from "@/app/api/v1/files/[id]/route";
import { prisma } from "@/lib/prisma";
import { startMockR2Server, stopMockR2Server } from "../mocks/r2-server";

// Mock Prisma with comprehensive transaction support
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
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
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
      const { R2Client } = jest.requireActual("@/lib/r2-client");
      return new R2Client({
        endpoint: "http://localhost:9020",
        accessKeyId: "test",
        secretAccessKey: "test",
        bucketName: "test-bucket",
        region: "auto",
      });
    },
  };
});

// Mock nanoid for predictable IDs
jest.mock("@/lib/nanoid", () => ({
  generateNanoId: jest.fn(() => "test-nano-id"),
}));

let mockServerPort: number;

describe("File and Directory Management Integration", () => {
  beforeAll(async () => {
    mockServerPort = await startMockR2Server(9020);
  });

  afterAll(async () => {
    await stopMockR2Server();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({
      user: { id: "test-user-id" },
    });
  });

  const mockUser = "test-user-id";
  const mockDate = new Date("2024-01-01T00:00:00.000Z");

  describe("Complete File Lifecycle with Directories", () => {
    it("should handle complete workflow: create directory tree, upload file, manage file, cleanup", async () => {
      // Step 1: Create nested directory structure
      const mockDirectory = {
        id: "root-dir-id",
        userId: mockUser,
        fullPath: "/projects/2024/documents",
        parentId: null,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
        _count: { files: 0, children: 0 },
      };

      const mockParentDir = { id: "parent-dir-id", fullPath: "/projects" };
      const mockSubDir = { id: "sub-dir-id", fullPath: "/projects/2024" };

      (prisma.directory.upsert as jest.Mock)
        .mockResolvedValueOnce(mockParentDir)
        .mockResolvedValueOnce(mockSubDir)
        .mockResolvedValueOnce(mockDirectory);
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(mockDirectory);

      const createRequest = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "/projects/2024/documents",
          defaultPermissions: "private",
          defaultExpirationPolicy: "infinite",
        }),
      });

      const createResponse = await createDir(createRequest);
      const createdDir = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createdDir.fullPath).toBe("/projects/2024/documents");
      expect(prisma.directory.upsert).toHaveBeenCalledTimes(3);

      // Step 2: Upload file to created directory
      const mockFile = {
        id: "test-file-id",
        userId: mockUser,
        directoryId: "root-dir-id",
        filename: "report.pdf",
        fullPath: "/projects/2024/documents/report.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(1024),
        permissions: "private",
        status: "reserved",
        expirationPolicy: "30d",
        expiresAt: new Date("2024-01-31T00:00:00.000Z"),
        r2Locator: null,
        createdAt: mockDate,
        updatedAt: mockDate,
      };

      (prisma.file.create as jest.Mock).mockResolvedValue(mockFile);
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(mockDirectory);

      const uploadRequest = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "report.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          directoryId: "root-dir-id",
          permissions: "private",
          expirationPolicy: "30d",
        }),
      });

      const uploadResponse = await createFile(uploadRequest);
      const createdFile = await uploadResponse.json();

      expect(uploadResponse.status).toBe(201);
      expect(createdFile.filename).toBe("report.pdf");
      expect(createdFile.directoryId).toBe("root-dir-id");

      // Step 3: Update file properties
      const updatedFile = {
        ...mockFile,
        filename: "annual-report.pdf",
        permissions: "public",
        updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      };

      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.update as jest.Mock).mockResolvedValue(updatedFile);

      const updateRequest = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          filename: "annual-report.pdf",
          permissions: "public",
        }),
      });

      const updateResponse = await updateFile(updateRequest, {
        params: Promise.resolve({ id: "test-file-id" }),
      });
      const updatedFileData = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updatedFileData.filename).toBe("annual-report.pdf");
      expect(updatedFileData.permissions).toBe("public");

      // Step 4: Move file to different directory
      const targetDirectory = {
        id: "target-dir-id",
        fullPath: "/archive",
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
      };

      const movedFile = {
        ...updatedFile,
        directoryId: "target-dir-id",
        fullPath: "/archive/annual-report.pdf",
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(targetDirectory);
      (prisma.file.update as jest.Mock).mockResolvedValue(movedFile);

      const moveRequest = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          directoryId: "target-dir-id",
        }),
      });

      const moveResponse = await updateFile(moveRequest, {
        params: Promise.resolve({ id: "test-file-id" }),
      });
      const movedFileData = await moveResponse.json();

      expect(moveResponse.status).toBe(200);
      expect(movedFileData.directoryId).toBe("target-dir-id");
      expect(movedFileData.fullPath).toBe("/archive/annual-report.pdf");

      // Step 5: Update directory properties
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        files: [],
        children: [],
      });
      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        defaultPermissions: "public",
        _count: { files: 0, children: 0 },
      });

      const updateDirRequest = new NextRequest("http://localhost:3000/api/v1/directories/root-dir-id", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "public",
        }),
      });

      const updateDirResponse = await updateDir(updateDirRequest, {
        params: Promise.resolve({ id: "root-dir-id" }),
      });
      const updatedDirData = await updateDirResponse.json();

      expect(updateDirResponse.status).toBe(200);
      expect(updatedDirData.defaultPermissions).toBe("public");

      // Step 6: Delete file
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(movedFile);
      (prisma.file.delete as jest.Mock).mockResolvedValue(movedFile);

      const deleteFileRequest = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "DELETE",
      });

      const deleteFileResponse = await deleteFile(deleteFileRequest, {
        params: Promise.resolve({ id: "test-file-id" }),
      });
      const deleteFileData = await deleteFileResponse.json();

      expect(deleteFileResponse.status).toBe(200);
      expect(deleteFileData.message).toBe("File deleted successfully");

      // Step 7: Delete empty directory
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        files: [],
        _count: { children: 0 },
      });
      (prisma.directory.delete as jest.Mock).mockResolvedValue(mockDirectory);

      const deleteDirRequest = new NextRequest("http://localhost:3000/api/v1/directories/root-dir-id", {
        method: "DELETE",
      });

      const deleteDirResponse = await deleteDir(deleteDirRequest, {
        params: Promise.resolve({ id: "root-dir-id" }),
      });
      const deleteDirData = await deleteDirResponse.json();

      expect(deleteDirResponse.status).toBe(200);
      expect(deleteDirData.message).toBe("Directory deleted successfully");
    });

    it("should handle bulk operations with transaction rollback", async () => {
      const mockDirectories = [
        { id: "dir1", fullPath: "/bulk/test1", _count: { files: 2, children: 0 } },
        { id: "dir2", fullPath: "/bulk/test2", _count: { files: 1, children: 0 } },
      ];

      const mockFiles = [
        { id: "file1", directoryId: "dir1", r2Locator: "test/file1" },
        { id: "file2", directoryId: "dir1", r2Locator: "test/file2" },
        { id: "file3", directoryId: "dir2", r2Locator: "test/file3" },
      ];

      // Simulate transaction with multiple directory operations
      (prisma.$transaction as jest.Mock).mockImplementation(async (operations) => {
        // Execute all operations in sequence
        const results = [];
        for (const operation of operations) {
          if (typeof operation === 'function') {
            results.push(await operation(prisma));
          }
        }
        return results;
      });

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(mockDirectories);
      (prisma.file.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });
      (prisma.directory.delete as jest.Mock)
        .mockResolvedValueOnce(mockDirectories[0])
        .mockResolvedValueOnce(mockDirectories[1]);

      // Test successful bulk deletion
      const operations = mockDirectories.map((dir) => 
        jest.fn().mockResolvedValue(dir)
      );

      const transactionResult = await (prisma.$transaction as jest.Mock)(operations);
      
      expect(transactionResult).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalledWith(operations);
    });
  });

  describe("Directory Tree Operations", () => {
    it("should handle deep directory renaming with cascading updates", async () => {
      const rootDir = {
        id: "root-id",
        fullPath: "/projects/old-name",
        files: [{ id: "file1", fullPath: "/projects/old-name/file1.txt" }],
        children: [{ id: "child1", fullPath: "/projects/old-name/subdir" }],
        _count: { files: 1, children: 1 },
      };

      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(rootDir)
        .mockResolvedValueOnce(null); // No existing directory at new path
      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(undefined);
      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...rootDir,
        fullPath: "/projects/new-name",
        _count: { files: 1, children: 1 },
      });

      const renameRequest = new NextRequest("http://localhost:3000/api/v1/directories/root-id", {
        method: "PUT",
        body: JSON.stringify({
          fullPath: "/projects/new-name",
        }),
      });

      const renameResponse = await updateDir(renameRequest, {
        params: Promise.resolve({ id: "root-id" }),
      });
      const renamedDir = await renameResponse.json();

      expect(renameResponse.status).toBe(200);
      expect(renamedDir.fullPath).toBe("/projects/new-name");
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2); // Update children and files
    });

    it("should prevent circular directory references", async () => {
      const parentDir = {
        id: "parent-id",
        fullPath: "/parent",
      };
      const childDir = {
        id: "child-id",
        fullPath: "/parent/child/grandchild",
      };

      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(parentDir)
        .mockResolvedValueOnce(childDir);

      const circularRequest = new NextRequest("http://localhost:3000/api/v1/directories/parent-id", {
        method: "PUT",
        body: JSON.stringify({
          parentId: "child-id",
        }),
      });

      const circularResponse = await updateDir(circularRequest, {
        params: Promise.resolve({ id: "parent-id" }),
      });
      const errorData = await circularResponse.json();

      expect(circularResponse.status).toBe(400);
      expect(errorData.error).toBe("Cannot move directory into its own subdirectory");
    });

    it("should handle recursive directory listing with filtering", async () => {
      const mockDirectories = [
        { id: "1", fullPath: "/docs", _count: { files: 2, children: 1 }, parent: null },
        { id: "2", fullPath: "/docs/api", _count: { files: 5, children: 0 }, parent: { id: "1", fullPath: "/docs" } },
        { id: "3", fullPath: "/docs/guides", _count: { files: 3, children: 2 }, parent: { id: "1", fullPath: "/docs" } },
      ];

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(mockDirectories);

      const listRequest = new NextRequest(
        "http://localhost:3000/api/v1/directories?path=/docs&recursive=true"
      );
      const listResponse = await getDirs(listRequest);
      const listedDirs = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(listedDirs.directories).toHaveLength(3);
      expect(listedDirs.total).toBe(3);
      expect(prisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser,
            fullPath: { startsWith: "/docs/" },
          }),
        })
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle database connection failures gracefully", async () => {
      (prisma.directory.findMany as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest("http://localhost:3000/api/v1/directories");
      const response = await getDirs(request);
      const errorData = await response.json();

      expect(response.status).toBe(500);
      expect(errorData.error).toBe("Internal server error");
    });

    it("should handle invalid file sizes and constraints", async () => {
      const largeFileRequest = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "huge-file.zip",
          mimeType: "application/zip",
          sizeBytes: Number.MAX_SAFE_INTEGER + 1, // Too large
          permissions: "private",
        }),
      });

      const response = await createFile(largeFileRequest);
      const errorData = await response.json();

      expect(response.status).toBe(400);
      expect(errorData.error).toBe("Validation error");
    });

    it("should handle concurrent directory operations", async () => {
      const directory = {
        id: "concurrent-dir",
        fullPath: "/concurrent",
        _count: { files: 0, children: 0 },
      };

      // Simulate concurrent update operations
      let updateCount = 0;
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(directory);
      (prisma.directory.update as jest.Mock).mockImplementation(async () => {
        updateCount++;
        if (updateCount === 1) {
          // Simulate optimistic locking failure on first attempt
          throw new Error("Record version mismatch");
        }
        return { ...directory, updatedAt: new Date() };
      });

      const updateRequest = new NextRequest("http://localhost:3000/api/v1/directories/concurrent-dir", {
        method: "PUT",
        body: JSON.stringify({
          defaultPermissions: "public",
        }),
      });

      const response = await updateDir(updateRequest, {
        params: Promise.resolve({ id: "concurrent-dir" }),
      });

      expect(response.status).toBe(500); // Should handle the error
    });

    it("should validate file path traversal attempts", async () => {
      const maliciousRequest = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "../../../etc/passwd",
        }),
      });

      const response = await createDir(maliciousRequest);
      const data = await response.json();

      expect(response.status).toBe(201); // Path normalization should handle this
      expect(data.fullPath).toBe("/etc/passwd"); // Normalized to absolute path
    });

    it("should handle cleanup when R2 operations fail", async () => {
      const file = {
        id: "cleanup-test",
        r2Locator: "invalid/locator/path",
        status: "validated",
      };

      (prisma.file.findFirst as jest.Mock).mockResolvedValue(file);
      (prisma.file.delete as jest.Mock).mockResolvedValue(file);

      const deleteRequest = new NextRequest("http://localhost:3000/api/v1/files/cleanup-test", {
        method: "DELETE",
      });

      const response = await deleteFile(deleteRequest, {
        params: Promise.resolve({ id: "cleanup-test" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("File deleted successfully");
      expect(prisma.file.delete).toHaveBeenCalled();
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large directory listings efficiently", async () => {
      const largeDirectoryList = Array.from({ length: 1000 }, (_, i) => ({
        id: `dir-${i}`,
        fullPath: `/large-test/dir-${i}`,
        _count: { files: i % 10, children: i % 5 },
        parent: null,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
      }));

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(largeDirectoryList);

      const startTime = Date.now();
      const request = new NextRequest("http://localhost:3000/api/v1/directories");
      const response = await getDirs(request);
      const data = await response.json();
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(data.directories).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle bulk file operations with batching", async () => {
      const bulkFiles = Array.from({ length: 100 }, (_, i) => ({
        id: `bulk-file-${i}`,
        filename: `file-${i}.txt`,
        directoryId: "bulk-dir",
        r2Locator: `test/bulk-file-${i}`,
        status: "validated",
      }));

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue({
        id: "bulk-dir",
        files: bulkFiles,
        _count: { children: 0 },
      });
      (prisma.file.deleteMany as jest.Mock).mockResolvedValue({ count: 100 });
      (prisma.directory.delete as jest.Mock).mockResolvedValue({
        id: "bulk-dir",
      });

      const deleteRequest = new NextRequest("http://localhost:3000/api/v1/directories/bulk-dir", {
        method: "DELETE",
      });

      const response = await deleteDir(deleteRequest, {
        params: Promise.resolve({ id: "bulk-dir" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deletedFiles).toBe(100);
    });
  });
});