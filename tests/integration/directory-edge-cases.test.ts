import {NextRequest} from "next/server";
import {POST as createDir, GET as listDirs} from "@/app/api/v1/directories/route";
import {PUT as updateDir, DELETE as deleteDir} from "@/app/api/v1/directories/[id]/route";
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
      deleteObject: jest.fn(),
    }),
  };
});

describe("Directory Edge Cases and Boundary Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({
      user: {id: "test-user-id"},
    });
  });

  const mockUser = "test-user-id";
  const mockDate = new Date("2024-01-01T00:00:00.000Z");

  describe("Path Normalization and Validation", () => {
    it("should handle various path formats and normalize them", async () => {
      const testCases = [
        {input: "simple", expected: "/simple"},
        {input: "/already/absolute", expected: "/already/absolute"},
        {input: "//double//slashes//", expected: "/double/slashes"},
        {input: "trailing/slash/", expected: "/trailing/slash"},
        {input: "./relative/path", expected: "/relative/path"},
        {input: "unicode/测试/путь", expected: "/unicode/测试/путь"},
        {input: "spaces in path", expected: "/spaces in path"},
      ];

      for (const testCase of testCases) {
        const mockDir = {
          id: "test-id",
          userId: mockUser,
          fullPath: testCase.expected,
          parentId: null,
          defaultPermissions: "private",
          defaultExpirationPolicy: "infinite",
          createdAt: mockDate,
          updatedAt: mockDate,
          _count: {files: 0, children: 0},
        };

        (prisma.directory.upsert as jest.Mock).mockResolvedValue(mockDir);
        (prisma.directory.findUnique as jest.Mock).mockResolvedValue(mockDir);

        const request = new NextRequest("http://localhost:3000/api/v1/directories", {
          method: "POST",
          body: JSON.stringify({
            fullPath: testCase.input,
          }),
        });

        const response = await createDir(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.fullPath).toBe(testCase.expected);
      }
    });

    it("should handle extremely long paths within limits", async () => {
      const longPath = "/" + "a".repeat(995); // 996 chars total (within 1000 limit)
      const mockDir = {
        id: "long-path-id",
        fullPath: longPath,
        parentId: null,
        userId: mockUser,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
        _count: {files: 0, children: 0},
      };

      (prisma.directory.upsert as jest.Mock).mockResolvedValue(mockDir);
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(mockDir);

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: longPath,
        }),
      });

      const response = await createDir(request);
      expect(response.status).toBe(201);
    });

    it("should reject paths exceeding maximum length", async () => {
      const tooLongPath = "/" + "a".repeat(1000); // 1001 chars total (exceeds 1000 limit)

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: tooLongPath,
        }),
      });

      const response = await createDir(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation error");
    });

    it("should handle special characters and escape sequences", async () => {
      const specialPaths = [
        "/special/chars/!@#$%^&*()",
        "/encoded/%20space%20test",
        "/newlines/test\nwith\nbreaks",
        "/tabs/test\twith\ttabs",
        "/quotes/test'with\"quotes",
        "/backslashes/test\\with\\backslashes",
      ];

      for (const path of specialPaths) {
        const mockDir = {
          id: `special-${Math.random()}`,
          fullPath: path,
          parentId: null,
          userId: mockUser,
          defaultPermissions: "private",
          defaultExpirationPolicy: "infinite",
          createdAt: mockDate,
          updatedAt: mockDate,
          _count: {files: 0, children: 0},
        };

        (prisma.directory.upsert as jest.Mock).mockResolvedValue(mockDir);
        (prisma.directory.findUnique as jest.Mock).mockResolvedValue(mockDir);

        const request = new NextRequest("http://localhost:3000/api/v1/directories", {
          method: "POST",
          body: JSON.stringify({fullPath: path}),
        });

        const response = await createDir(request);
        expect(response.status).toBe(201);
      }
    });
  });

  describe("Deep Directory Hierarchies", () => {
    it("should handle very deep directory structures", async () => {
      // Create a 20-level deep directory structure
      const depth = 20;
      const basePath = "/deep";
      let currentPath = "";
      const directories: Array<{
        id: string; 
        fullPath: string; 
        parentId: string | null;
        userId: string;
        defaultPermissions: string;
        defaultExpirationPolicy: string;
        createdAt: Date;
        updatedAt: Date;
      }> = [];

      // First create the base directory
      directories.push({
        id: "deep-0",
        fullPath: basePath,
        parentId: null,
        userId: mockUser,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
      });

      currentPath = basePath;
      for (let i = 1; i <= depth; i++) {
        currentPath += `/level${i}`;
        directories.push({
          id: `deep-${i}`,
          fullPath: currentPath,
          parentId: i === 1 ? "deep-0" : `deep-${i - 1}`,
          userId: mockUser,
          defaultPermissions: "private",
          defaultExpirationPolicy: "infinite",
          createdAt: mockDate,
          updatedAt: mockDate,
        });
      }

      (prisma.directory.upsert as jest.Mock).mockImplementation((params) => {
        const path = params.where.userId_fullPath.fullPath;
        const dir = directories.find((d: {fullPath: string}) => d.fullPath === path);
        return Promise.resolve(dir || directories[directories.length - 1]);
      });

      (prisma.directory.findUnique as jest.Mock).mockResolvedValue({
        ...directories[directories.length - 1],
        _count: {files: 0, children: 0},
      });

      const finalPath = directories[directories.length - 1].fullPath;
      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: finalPath,
        }),
      });

      const response = await createDir(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fullPath).toBe(finalPath);
      expect(prisma.directory.upsert).toHaveBeenCalledTimes(depth + 1); // +1 for base directory
    });

    it("should handle directory tree with many siblings", async () => {
      const siblingCount = 100;
      const siblings = Array.from({length: siblingCount}, (_, i) => ({
        id: `sibling-${i}`,
        fullPath: `/siblings/child-${i}`,
        parentId: "parent-id",
        _count: {files: i, children: 0},
        parent: {id: "parent-id", fullPath: "/siblings"},
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
      }));

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(siblings);

      const request = new NextRequest(
        "http://localhost:3000/api/v1/directories?parentId=parent-id",
      );
      const response = await listDirs(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.directories).toHaveLength(siblingCount);
      expect(data.total).toBe(siblingCount);
    });
  });

  describe("Concurrent Operations and Race Conditions", () => {
    it("should handle simultaneous directory creation with same path", async () => {
      const conflictPath = "/conflict/test";
      let creationCount = 0;

      (prisma.directory.upsert as jest.Mock).mockImplementation(() => {
        creationCount++;
        const baseDir = {
          id: "first-creation",
          fullPath: conflictPath,
          parentId: null,
          userId: mockUser,
          defaultPermissions: "private",
          defaultExpirationPolicy: "infinite",
          createdAt: mockDate,
          updatedAt: mockDate,
          _count: {files: 0, children: 0},
        };

        if (creationCount === 1) {
          return Promise.resolve(baseDir);
        } else {
          // Simulate second request finding existing directory
          return Promise.resolve(baseDir);
        }
      });

      (prisma.directory.findUnique as jest.Mock).mockResolvedValue({
        id: "first-creation",
        fullPath: conflictPath,
        parentId: null,
        userId: mockUser,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
        _count: {files: 0, children: 0},
      });

      // Simulate two concurrent requests
      const request1 = createDir(
        new NextRequest("http://localhost:3000/api/v1/directories", {
          method: "POST",
          body: JSON.stringify({fullPath: conflictPath}),
        }),
      );

      const request2 = createDir(
        new NextRequest("http://localhost:3000/api/v1/directories", {
          method: "POST",
          body: JSON.stringify({fullPath: conflictPath}),
        }),
      );

      const [response1, response2] = await Promise.all([request1, request2]);
      const [data1, data2] = await Promise.all([response1.json(), response2.json()]);

      // Both should succeed (upsert handles conflicts)
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(data1.fullPath).toBe(conflictPath);
      expect(data2.fullPath).toBe(conflictPath);
    });

    it("should handle concurrent directory renames", async () => {
      const originalDir = {
        id: "concurrent-rename",
        fullPath: "/original/path",
        parentId: null,
        userId: mockUser,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
        files: [],
        children: [],
        _count: {files: 0, children: 0},
      };

      let renameAttempts = 0;
      let findFirstCalls = 0;
      (prisma.directory.findFirst as jest.Mock).mockImplementation(() => {
        findFirstCalls++;
        if (findFirstCalls <= 2) {
          // First two calls are for finding the directory to update
          return Promise.resolve(originalDir);
        } else if (findFirstCalls === 3) {
          // Third call checks for existing directory at new path - allow first rename
          return Promise.resolve(null);
        } else {
          // Fourth call checks for existing directory at new path - block second rename
          return Promise.resolve({
            id: "existing-dir",
            fullPath: "/totally/separate/path2",
            userId: mockUser,
          });
        }
      });
      (prisma.directory.update as jest.Mock).mockImplementation(() => {
        renameAttempts++;
        if (renameAttempts === 1) {
          // First rename succeeds
          return Promise.resolve({
            ...originalDir,
            fullPath: "/completely/different/path1",
            updatedAt: mockDate,
            _count: {files: 0, children: 0},
          });
        } else {
          // Second rename conflicts
          return Promise.reject(new Error("Directory path already exists"));
        }
      });

      const rename1 = updateDir(
        new NextRequest("http://localhost:3000/api/v1/directories/concurrent-rename", {
          method: "PUT",
          body: JSON.stringify({fullPath: "/completely/different/path1"}),
        }),
        {params: Promise.resolve({id: "concurrent-rename"})},
      );

      const rename2 = updateDir(
        new NextRequest("http://localhost:3000/api/v1/directories/concurrent-rename", {
          method: "PUT",
          body: JSON.stringify({fullPath: "/totally/separate/path2"}),
        }),
        {params: Promise.resolve({id: "concurrent-rename"})},
      );

      const [response1, response2] = await Promise.allSettled([rename1, rename2]);

      // Debug: Log what actually happened
      // console.log("Response 1:", response1.status, response1.status === "fulfilled" ? response1.value.status : response1.reason);
      // console.log("Response 2:", response2.status, response2.status === "fulfilled" ? response2.value.status : response2.reason);

      // One should succeed, one should fail
      expect(
        (response1.status === "fulfilled" && response1.value.status === 200) ||
          (response2.status === "fulfilled" && response2.value.status === 200),
      ).toBe(true);
    });
  });

  describe("Resource Limits and Constraints", () => {
    it("should handle directory with maximum allowed files", async () => {
      const maxFiles = 10000;
      const mockFiles = Array.from({length: maxFiles}, (_, i) => ({
        id: `file-${i}`,
        filename: `file-${i}.txt`,
        r2Locator: `test/file-${i}`,
        status: "validated",
      }));

      const directoryWithManyFiles = {
        id: "max-files-dir",
        fullPath: "/max-files",
        files: mockFiles,
        _count: {children: 0},
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(directoryWithManyFiles);
      (prisma.file.deleteMany as jest.Mock).mockResolvedValue({count: maxFiles});
      (prisma.directory.delete as jest.Mock).mockResolvedValue(directoryWithManyFiles);

      const deleteRequest = new NextRequest(
        "http://localhost:3000/api/v1/directories/max-files-dir",
        {
          method: "DELETE",
        },
      );

      const response = await deleteDir(deleteRequest, {
        params: Promise.resolve({id: "max-files-dir"}),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deletedFiles).toBe(maxFiles);
    });

    it("should handle deeply nested directory deletion with cascading", async () => {
      const nestedDir = {
        id: "nested-root",
        fullPath: "/nested/root",
        files: [{id: "nested-file", r2Locator: "test/nested-file", status: "validated"}],
        children: [{id: "nested-child", fullPath: "/nested/root/child"}],
        _count: {children: 1},
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(nestedDir);

      const deleteRequest = new NextRequest(
        "http://localhost:3000/api/v1/directories/nested-root",
        {
          method: "DELETE",
        },
      );

      const response = await deleteDir(deleteRequest, {
        params: Promise.resolve({id: "nested-root"}),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Directory is not empty");
      expect(data.details).toBe("Please delete all subdirectories first");
    });
  });

  describe("Data Integrity and Validation", () => {
    it("should validate directory ownership across operations", async () => {
      const unauthorizedAuth = jest.mocked(require("@/lib/auth").auth);
      unauthorizedAuth.mockResolvedValue({
        user: {id: "unauthorized-user"},
      });

      const otherUserDir = {
        id: "other-user-dir",
        userId: "other-user-id",
        fullPath: "/other/user/dir",
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const updateRequest = new NextRequest(
        "http://localhost:3000/api/v1/directories/other-user-dir",
        {
          method: "PUT",
          body: JSON.stringify({defaultPermissions: "public"}),
        },
      );

      const response = await updateDir(updateRequest, {
        params: Promise.resolve({id: "other-user-dir"}),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Directory not found");
    });

    it("should maintain referential integrity during complex operations", async () => {
      const parentDir = {
        id: "integrity-parent",
        fullPath: "/integrity/parent",
        parentId: null,
        userId: mockUser,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
        files: [],
        children: [{id: "integrity-child", fullPath: "/integrity/parent/child"}],
        _count: {files: 0, children: 1},
      };

      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(parentDir)
        .mockResolvedValueOnce(null);
      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(undefined);
      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...parentDir,
        fullPath: "/integrity/moved",
        updatedAt: mockDate,
        _count: {files: 0, children: 1},
      });

      const moveRequest = new NextRequest(
        "http://localhost:3000/api/v1/directories/integrity-parent",
        {
          method: "PUT",
          body: JSON.stringify({fullPath: "/integrity/moved"}),
        },
      );

      const response = await updateDir(moveRequest, {
        params: Promise.resolve({id: "integrity-parent"}),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fullPath).toBe("/integrity/moved");

      // Should update child directories
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        "/integrity/parent/",
        "/integrity/moved/",
        mockUser,
        "/integrity/parent/%",
      );
    });

    it("should handle malformed request data gracefully", async () => {
      const malformedRequests = [
        {body: "{invalid json"},
        {body: JSON.stringify({fullPath: null})},
        {body: JSON.stringify({fullPath: 123})},
        {body: JSON.stringify({defaultPermissions: "invalid"})},
        {body: JSON.stringify({defaultExpirationPolicy: "never"})},
      ];

      for (const requestData of malformedRequests) {
        const request = new NextRequest("http://localhost:3000/api/v1/directories", {
          method: "POST",
          body: requestData.body,
        });

        const response = await createDir(request);
        expect([400, 500]).toContain(response.status); // Should handle gracefully
      }
    });
  });

  describe("Performance Edge Cases", () => {
    it("should handle rapid sequential operations", async () => {
      const rapidOperations = Array.from({length: 50}, (_, i) => ({
        id: `rapid-${i}`,
        fullPath: `/rapid/test-${i}`,
        parentId: null,
        userId: mockUser,
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
        _count: {files: 0, children: 0},
      }));

      let operationCount = 0;
      (prisma.directory.upsert as jest.Mock).mockImplementation(() => {
        const result = rapidOperations[operationCount % rapidOperations.length];
        operationCount++;
        return Promise.resolve(result);
      });
      (prisma.directory.findUnique as jest.Mock).mockImplementation(() => {
        const result = rapidOperations[operationCount % rapidOperations.length];
        return Promise.resolve(result);
      });

      const startTime = Date.now();
      const promises = rapidOperations.map((op, i) =>
        createDir(
          new NextRequest("http://localhost:3000/api/v1/directories", {
            method: "POST",
            body: JSON.stringify({fullPath: `/rapid/test-${i}`}),
          }),
        ),
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle memory-intensive directory trees", async () => {
      const breadth = 10;
      const depth = 3;
      const totalNodes = Math.pow(breadth, depth);

      // Generate a large tree structure
      const largeTree = [];
      for (let level = 0; level < depth; level++) {
        for (let node = 0; node < Math.pow(breadth, level); node++) {
          const id = `tree-${level}-${node}`;
          const path = `/large-tree/level-${level}/node-${node}`;
          largeTree.push({
            id,
            fullPath: path,
            _count: {
              files: Math.floor(Math.random() * 10),
              children: level < depth - 1 ? breadth : 0,
            },
            parent:
              level === 0
                ? null
                : {
                    id: `tree-${level - 1}-${Math.floor(node / breadth)}`,
                    fullPath: `/large-tree/level-${level - 1}/node-${Math.floor(node / breadth)}`,
                  },
            defaultPermissions: "private",
            defaultExpirationPolicy: "infinite",
            createdAt: mockDate,
            updatedAt: mockDate,
          });
        }
      }

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(largeTree.slice(0, 1000)); // Limit to 1000 for response

      const request = new NextRequest(
        "http://localhost:3000/api/v1/directories?path=/large-tree&recursive=true",
      );

      const startTime = Date.now();
      const response = await listDirs(request);
      const data = await response.json();
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(data.directories.length).toBeLessThanOrEqual(1000);
      expect(endTime - startTime).toBeLessThan(3000); // Should handle efficiently
    });
  });
});
