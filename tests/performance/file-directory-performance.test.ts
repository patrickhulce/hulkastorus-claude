import { NextRequest } from "next/server";
import { POST as createFile } from "@/app/api/v1/files/route";
import { GET as getFile, PUT as updateFile, DELETE as deleteFile } from "@/app/api/v1/files/[id]/route";
import { POST as createDir, GET as listDirs } from "@/app/api/v1/directories/route";
import { GET as getDirById, PUT as updateDir, DELETE as deleteDir } from "@/app/api/v1/directories/[id]/route";
import { prisma } from "@/lib/prisma";

// Mock Prisma for performance testing
jest.mock("@/lib/prisma", () => ({
  prisma: {
    file: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    directory: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

// Mock R2 config for performance testing
jest.mock("@/lib/r2-config", () => {
  const originalModule = jest.requireActual("@/lib/r2-config");
  return {
    ...originalModule,
    currentEnv: "test",
    getR2Client: () => ({
      deleteObject: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue(undefined),
      headObject: jest.fn().mockResolvedValue({ size: 1024 }),
    }),
  };
});

// Mock nanoid for consistent IDs
jest.mock("@/lib/nanoid", () => ({
  generateNanoId: jest.fn(() => "perf-test-id"),
}));

// Performance measurement utilities
const measureTime = async (operation: () => Promise<any>) => {
  const startTime = process.hrtime.bigint();
  const result = await operation();
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;
  return { result, duration: durationMs };
};

const measureMemory = () => {
  if (global.gc) {
    global.gc();
  }
  return process.memoryUsage();
};

describe("File and Directory Management Performance Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({ user: { id: "perf-test-user" } });
  });

  const mockUser = "perf-test-user";
  const mockDate = new Date("2024-01-01T00:00:00.000Z");

  describe("File Operations Performance", () => {
    it("should handle bulk file creation efficiently", async () => {
      const fileCount = 1000;
      let createdCount = 0;

      (prisma.file.create as jest.Mock).mockImplementation(() => {
        createdCount++;
        return Promise.resolve({
          id: `bulk-file-${createdCount}`,
          userId: mockUser,
          filename: `file-${createdCount}.txt`,
          mimeType: "text/plain",
          sizeBytes: BigInt(1024),
          permissions: "private",
          status: "reserved",
          expirationPolicy: "infinite",
          createdAt: mockDate,
          updatedAt: mockDate,
        });
      });

      const memoryBefore = measureMemory();
      const { result, duration } = await measureTime(async () => {
        const promises = Array.from({ length: fileCount }, (_, i) =>
          createFile(new NextRequest("http://localhost:3000/api/v1/files", {
            method: "POST",
            body: JSON.stringify({
              filename: `bulk-file-${i}.txt`,
              mimeType: "text/plain",
              sizeBytes: 1024,
              permissions: "private",
            }),
          }))
        );
        return Promise.all(promises);
      });
      const memoryAfter = measureMemory();

      const successful = result.filter((r: Response) => r.status === 201);

      expect(successful.length).toBe(fileCount);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(memoryAfter.heapUsed - memoryBefore.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB memory increase

      console.log(`Bulk file creation: ${fileCount} files in ${duration.toFixed(2)}ms`);
      console.log(`Memory increase: ${((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
    });

    it("should maintain performance with large file metadata", async () => {
      const largeMetadata = {
        filename: "large-metadata-file.txt",
        mimeType: "text/plain",
        sizeBytes: 1024 * 1024 * 1024, // 1GB
        permissions: "private",
        description: "x".repeat(10000), // 10KB description
        tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
        customMetadata: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`key-${i}`, `value-${i}`.repeat(100)])
        ),
      };

      (prisma.file.create as jest.Mock).mockResolvedValue({
        id: "large-metadata-file",
        ...largeMetadata,
        sizeBytes: BigInt(largeMetadata.sizeBytes),
        userId: mockUser,
        status: "reserved",
        expirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
      });

      const { result, duration } = await measureTime(async () => {
        return createFile(new NextRequest("http://localhost:3000/api/v1/files", {
          method: "POST",
          body: JSON.stringify(largeMetadata),
        }));
      });

      expect(result.status).toBe(201);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      console.log(`Large metadata file creation: ${duration.toFixed(2)}ms`);
    });

    it("should handle concurrent file updates efficiently", async () => {
      const concurrencyLevel = 50;
      const file = {
        id: "concurrent-file",
        userId: mockUser,
        filename: "concurrent-test.txt",
        permissions: "private",
      };

      (prisma.file.findFirst as jest.Mock).mockResolvedValue(file);

      let updateCount = 0;
      (prisma.file.update as jest.Mock).mockImplementation(() => {
        updateCount++;
        return Promise.resolve({
          ...file,
          filename: `updated-${updateCount}.txt`,
          updatedAt: new Date(),
        });
      });

      const { result, duration } = await measureTime(async () => {
        const promises = Array.from({ length: concurrencyLevel }, (_, i) =>
          updateFile(new NextRequest("http://localhost:3000/api/v1/files/concurrent-file", {
            method: "PUT",
            body: JSON.stringify({
              filename: `concurrent-update-${i}.txt`,
            }),
          }), { params: Promise.resolve({ id: "concurrent-file" }) })
        );
        return Promise.all(promises);
      });

      const successful = result.filter((r: Response) => r.status === 200);

      expect(successful.length).toBe(concurrencyLevel);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Concurrent file updates: ${concurrencyLevel} updates in ${duration.toFixed(2)}ms`);
    });
  });

  describe("Directory Operations Performance", () => {
    it("should handle deep directory tree creation efficiently", async () => {
      const depth = 50;
      const basePath = "/performance/deep";
      let currentPath = basePath;
      const directories: any[] = [];

      for (let i = 1; i <= depth; i++) {
        currentPath += `/level-${i}`;
        directories.push({
          id: `deep-${i}`,
          userId: mockUser,
          fullPath: currentPath,
          parentId: i === 1 ? null : `deep-${i - 1}`,
          defaultPermissions: "private",
          defaultExpirationPolicy: "infinite",
          createdAt: mockDate,
          updatedAt: mockDate,
          _count: { files: 0, children: i < depth ? 1 : 0 },
        });
      }

      (prisma.directory.upsert as jest.Mock).mockImplementation((params) => {
        const path = params.where.userId_fullPath.fullPath;
        const dir = directories.find((d: any) => d.fullPath === path);
        return Promise.resolve(dir || directories[directories.length - 1]);
      });

      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(directories[directories.length - 1]);

      const finalPath = directories[directories.length - 1].fullPath;
      const { result, duration } = await measureTime(async () => {
        return createDir(new NextRequest("http://localhost:3000/api/v1/directories", {
          method: "POST",
          body: JSON.stringify({ fullPath: finalPath }),
        }));
      });

      expect(result.status).toBe(201);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(prisma.directory.upsert).toHaveBeenCalledTimes(depth);

      console.log(`Deep directory creation: ${depth} levels in ${duration.toFixed(2)}ms`);
    });

    it("should handle wide directory listing efficiently", async () => {
      const breadth = 10000;
      const directories = Array.from({ length: breadth }, (_, i) => ({
        id: `wide-${i}`,
        userId: mockUser,
        fullPath: `/performance/wide/dir-${i}`,
        parentId: "wide-parent",
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
        createdAt: mockDate,
        updatedAt: mockDate,
        _count: { files: Math.floor(Math.random() * 10), children: 0 },
        parent: { id: "wide-parent", fullPath: "/performance/wide" },
      }));

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(directories);

      const memoryBefore = measureMemory();
      const { result, duration } = await measureTime(async () => {
        return listDirs(new NextRequest(
          "http://localhost:3000/api/v1/directories?parentId=wide-parent"
        ));
      });
      const memoryAfter = measureMemory();

      const data = await result.json();

      expect(result.status).toBe(200);
      expect(data.directories.length).toBe(breadth);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`Wide directory listing: ${breadth} directories in ${duration.toFixed(2)}ms`);
      console.log(`Memory for listing: ${((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
    });

    it("should handle recursive directory operations efficiently", async () => {
      const depth = 10;
      const breadth = 5;
      const directories: any[] = [];

      // Create a tree structure
      let nodeId = 0;
      const createNode = (level: number, parentPath: string, parentId: string | null) => {
        if (level > depth) return;

        for (let i = 0; i < breadth; i++) {
          const id = `tree-${nodeId++}`;
          const path = `${parentPath}/node-${level}-${i}`;
          directories.push({
            id,
            userId: mockUser,
            fullPath: path,
            parentId,
            defaultPermissions: "private",
            defaultExpirationPolicy: "infinite",
            createdAt: mockDate,
            updatedAt: mockDate,
            _count: { files: Math.floor(Math.random() * 5), children: level < depth ? breadth : 0 },
            parent: parentId ? { id: parentId, fullPath: parentPath.substring(0, parentPath.lastIndexOf('/')) } : null,
          });

          createNode(level + 1, path, id);
        }
      };

      createNode(1, "/performance/recursive", null);

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(directories.slice(0, 1000)); // Limit to prevent memory issues

      const { result, duration } = await measureTime(async () => {
        return listDirs(new NextRequest(
          "http://localhost:3000/api/v1/directories?path=/performance/recursive&recursive=true"
        ));
      });

      const data = await result.json();

      expect(result.status).toBe(200);
      expect(data.directories.length).toBeGreaterThan(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Recursive directory listing: ${data.directories.length} directories in ${duration.toFixed(2)}ms`);
    });

    it("should handle large directory rename operations efficiently", async () => {
      const childCount = 1000;
      const fileCount = 500;

      const rootDir = {
        id: "rename-root",
        userId: mockUser,
        fullPath: "/performance/old-name",
        files: Array.from({ length: fileCount }, (_, i) => ({
          id: `rename-file-${i}`,
          fullPath: `/performance/old-name/file-${i}.txt`,
        })),
        children: Array.from({ length: childCount }, (_, i) => ({
          id: `rename-child-${i}`,
          fullPath: `/performance/old-name/child-${i}`,
        })),
        _count: { files: fileCount, children: childCount },
      };

      (prisma.directory.findFirst as jest.Mock)
        .mockResolvedValueOnce(rootDir)
        .mockResolvedValueOnce(null); // No existing directory at new path

      let sqlExecutions = 0;
      (prisma.$executeRawUnsafe as jest.Mock).mockImplementation(() => {
        sqlExecutions++;
        return Promise.resolve(undefined);
      });

      (prisma.directory.update as jest.Mock).mockResolvedValue({
        ...rootDir,
        fullPath: "/performance/new-name",
        _count: { files: fileCount, children: childCount },
      });

      const { result, duration } = await measureTime(async () => {
        return updateDir(new NextRequest("http://localhost:3000/api/v1/directories/rename-root", {
          method: "PUT",
          body: JSON.stringify({ fullPath: "/performance/new-name" }),
        }), { params: Promise.resolve({ id: "rename-root" }) });
      });

      const data = await result.json();

      expect(result.status).toBe(200);
      expect(data.fullPath).toBe("/performance/new-name");
      expect(sqlExecutions).toBe(2); // One for children, one for files
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Large directory rename: ${childCount} children + ${fileCount} files in ${duration.toFixed(2)}ms`);
    });
  });

  describe("Mixed Operations Performance", () => {
    it("should handle mixed file and directory operations efficiently", async () => {
      const operationCount = 200;
      const operations: any[] = [];

      // Setup mock data
      const mockFile = {
        id: "mixed-file",
        userId: mockUser,
        filename: "mixed-test.txt",
        permissions: "private",
      };

      const mockDir = {
        id: "mixed-dir",
        userId: mockUser,
        fullPath: "/mixed-test",
        _count: { files: 0, children: 0 },
      };

      (prisma.file.create as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.update as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.delete as jest.Mock).mockResolvedValue(mockFile);

      (prisma.directory.upsert as jest.Mock).mockResolvedValue(mockDir);
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue(mockDir);
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(mockDir);
      (prisma.directory.update as jest.Mock).mockResolvedValue(mockDir);
      (prisma.directory.delete as jest.Mock).mockResolvedValue(mockDir);

      // Create mixed operations
      for (let i = 0; i < operationCount; i++) {
        const operationType = i % 6;
        
        switch (operationType) {
          case 0: // Create file
            operations.push(() => createFile(new NextRequest("http://localhost:3000/api/v1/files", {
              method: "POST",
              body: JSON.stringify({
                filename: `mixed-${i}.txt`,
                mimeType: "text/plain",
                permissions: "private",
              }),
            })));
            break;

          case 1: // Update file
            operations.push(() => updateFile(new NextRequest("http://localhost:3000/api/v1/files/mixed-file", {
              method: "PUT",
              body: JSON.stringify({ filename: `updated-${i}.txt` }),
            }), { params: Promise.resolve({ id: "mixed-file" }) }));
            break;

          case 2: // Create directory
            operations.push(() => createDir(new NextRequest("http://localhost:3000/api/v1/directories", {
              method: "POST",
              body: JSON.stringify({ fullPath: `/mixed-${i}` }),
            })));
            break;

          case 3: // Update directory
            operations.push(() => updateDir(new NextRequest("http://localhost:3000/api/v1/directories/mixed-dir", {
              method: "PUT",
              body: JSON.stringify({ defaultPermissions: "public" }),
            }), { params: Promise.resolve({ id: "mixed-dir" }) }));
            break;

          case 4: // Get file
            operations.push(() => getFile(new NextRequest("http://localhost:3000/api/v1/files/mixed-file"), {
              params: Promise.resolve({ id: "mixed-file" }),
            }));
            break;

          case 5: // Get directory
            operations.push(() => getDirById(new NextRequest("http://localhost:3000/api/v1/directories/mixed-dir"), {
              params: Promise.resolve({ id: "mixed-dir" }),
            }));
            break;
        }
      }

      const memoryBefore = measureMemory();
      const { result, duration } = await measureTime(async () => {
        // Execute operations in batches to avoid overwhelming the system
        const batchSize = 20;
        const results = [];

        for (let i = 0; i < operations.length; i += batchSize) {
          const batch = operations.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(op => op()));
          results.push(...batchResults);
        }

        return results;
      });
      const memoryAfter = measureMemory();

      const successful = result.filter((r: Response) => [200, 201].includes(r.status));

      expect(successful.length).toBe(operationCount);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`Mixed operations: ${operationCount} operations in ${duration.toFixed(2)}ms`);
      console.log(`Average per operation: ${(duration / operationCount).toFixed(2)}ms`);
      console.log(`Memory increase: ${((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
    });

    it("should handle cleanup operations efficiently", async () => {
      const fileCount = 500;
      const dirCount = 100;

      // Setup files to delete
      const filesToDelete = Array.from({ length: fileCount }, (_, i) => ({
        id: `cleanup-file-${i}`,
        r2Locator: `test/cleanup-file-${i}`,
        status: "validated",
      }));

      const directoryWithFiles = {
        id: "cleanup-dir",
        userId: mockUser,
        fullPath: "/cleanup",
        files: filesToDelete,
        _count: { children: 0 },
      };

      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(directoryWithFiles);
      (prisma.file.deleteMany as jest.Mock).mockResolvedValue({ count: fileCount });
      (prisma.directory.delete as jest.Mock).mockResolvedValue(directoryWithFiles);

      const { getR2Client } = jest.requireActual("@/lib/r2-config");
      const r2Client = getR2Client();

      const { result, duration } = await measureTime(async () => {
        return deleteDir(new NextRequest("http://localhost:3000/api/v1/directories/cleanup-dir", {
          method: "DELETE",
        }), { params: Promise.resolve({ id: "cleanup-dir" }) });
      });

      const data = await result.json();

      expect(result.status).toBe(200);
      expect(data.deletedFiles).toBe(fileCount);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`Cleanup operation: ${fileCount} files deleted in ${duration.toFixed(2)}ms`);
      console.log(`Average per file: ${(duration / fileCount).toFixed(2)}ms`);
    });
  });

  describe("Stress Testing", () => {
    it("should maintain stability under sustained load", async () => {
      const testDuration = 30000; // 30 seconds
      const operationsPerSecond = 10;
      const startTime = Date.now();
      const results = [];

      (prisma.file.create as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          id: `stress-${Date.now()}-${Math.random()}`,
          filename: "stress-test.txt",
          mimeType: "text/plain",
          permissions: "private",
          userId: mockUser,
        })
      );

      while (Date.now() - startTime < testDuration) {
        const batchPromises = Array.from({ length: operationsPerSecond }, () =>
          createFile(new NextRequest("http://localhost:3000/api/v1/files", {
            method: "POST",
            body: JSON.stringify({
              filename: `stress-${Date.now()}.txt`,
              mimeType: "text/plain",
              permissions: "private",
            }),
          }))
        );

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const successful = results.filter(r => 
        r.status === "fulfilled" && r.value.status === 201
      );

      const errorRate = (results.length - successful.length) / results.length;
      const totalOperations = results.length;
      const actualDuration = Date.now() - startTime;

      expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
      expect(successful.length).toBeGreaterThan(totalOperations * 0.8); // At least 80% success

      console.log(`Stress test: ${totalOperations} operations over ${actualDuration}ms`);
      console.log(`Success rate: ${((successful.length / totalOperations) * 100).toFixed(2)}%`);
      console.log(`Operations per second: ${((totalOperations / actualDuration) * 1000).toFixed(2)}`);
    });

    it("should recover gracefully from memory pressure", async () => {
      const largeObjectCount = 1000;
      const largeObjects = [];

      // Create memory pressure
      for (let i = 0; i < largeObjectCount; i++) {
        largeObjects.push({
          id: i,
          data: new Array(10000).fill(`memory-pressure-${i}`),
        });
      }

      const memoryBefore = measureMemory();

      // Perform operations under memory pressure
      (prisma.file.create as jest.Mock).mockResolvedValue({
        id: "memory-test",
        filename: "memory-test.txt",
        mimeType: "text/plain",
        permissions: "private",
        userId: mockUser,
      });

      const { result, duration } = await measureTime(async () => {
        const promises = Array.from({ length: 100 }, (_, i) =>
          createFile(new NextRequest("http://localhost:3000/api/v1/files", {
            method: "POST",
            body: JSON.stringify({
              filename: `memory-pressure-${i}.txt`,
              mimeType: "text/plain",
              permissions: "private",
            }),
          }))
        );
        return Promise.all(promises);
      });

      // Clear memory pressure
      largeObjects.length = 0;
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = measureMemory();
      const successful = result.filter((r: Response) => r.status === 201);

      expect(successful.length).toBeGreaterThan(80); // At least 80% success under pressure
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Memory pressure test: ${successful.length}/100 operations successful`);
      console.log(`Peak memory usage: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});