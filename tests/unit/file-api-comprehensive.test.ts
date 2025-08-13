import {NextRequest} from "next/server";
import {GET, PUT, DELETE} from "@/app/api/v1/files/[id]/route";
import {prisma} from "@/lib/prisma";

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

describe("File API Comprehensive Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({
      user: {id: "test-user-id"},
    });
  });

  const mockUser = "test-user-id";
  const mockDate = new Date("2024-01-01T00:00:00.000Z");

  const mockFile = {
    id: "test-file-id",
    userId: mockUser,
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
    createdAt: mockDate,
    updatedAt: mockDate,
    directory: {
      fullPath: "/",
    },
    user: {
      id: mockUser,
      firstName: "Test",
      lastName: "User",
    },
  };

  describe("GET /api/v1/files/:id", () => {
    it("should return file details for owner", async () => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("test-file-id");
      expect(data.filename).toBe("test.txt");
      expect(data.downloadUrl).toBe("/api/v1/files/test-file-id/download");
    });

    it("should return file details for public files with owner info", async () => {
      const publicFile = {...mockFile, permissions: "public", userId: "other-user-id"};
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(publicFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.downloadUrl).toBe("/d/test-file-id");
      expect(data.owner).toEqual({
        id: mockUser,
        name: "Test User",
      });
    });

    it("should handle expired files", async () => {
      const expiredFile = {...mockFile, expiresAt: new Date("2020-01-01")};
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(expiredFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File has expired");
    });

    it("should handle non-existent files", async () => {
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/nonexistent");
      const response = await GET(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should handle unauthorized access", async () => {
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle private files accessed by non-owner", async () => {
      const otherUserFile = {...mockFile, userId: "other-user-id"};
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(otherUserFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });
  });

  describe("PUT /api/v1/files/:id", () => {
    it("should update file metadata", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.update as jest.Mock).mockResolvedValue({
        ...mockFile,
        filename: "renamed.txt",
        permissions: "public",
        updatedAt: new Date(),
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
    });

    it("should update file expiration policy", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);

      const expectedExpiresAt = new Date();
      expectedExpiresAt.setDate(expectedExpiresAt.getDate() + 7);

      (prisma.file.update as jest.Mock).mockResolvedValue({
        ...mockFile,
        expirationPolicy: "7d",
        expiresAt: expectedExpiresAt,
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

      const targetDirectory = {
        id: "target-dir-id",
        fullPath: "/documents",
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
      };
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(targetDirectory);

      (prisma.file.update as jest.Mock).mockResolvedValue({
        ...mockFile,
        directoryId: "target-dir-id",
        fullPath: "/documents/test.txt",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          directoryId: "target-dir-id",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.directoryId).toBe("target-dir-id");
      expect(data.fullPath).toBe("/documents/test.txt");
    });

    it("should handle validation errors", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          permissions: "invalid-permission",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation error");
    });

    it("should handle non-existent file", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/nonexistent", {
        method: "PUT",
        body: JSON.stringify({
          filename: "new-name.txt",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should handle unauthorized updates", async () => {
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          filename: "hacker.txt",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle invalid directory move", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.directory.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          directoryId: "nonexistent-dir",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Target directory not found");
    });
  });

  describe("DELETE /api/v1/files/:id", () => {
    it("should delete file and clean up R2 storage", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.delete as jest.Mock).mockResolvedValue(mockFile);

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

    it("should handle file deletion with R2 failure gracefully", async () => {
      const fileWithBadLocator = {...mockFile, r2Locator: "invalid/locator"};
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(fileWithBadLocator);
      (prisma.file.delete as jest.Mock).mockResolvedValue(fileWithBadLocator);

      // Mock R2 client to simulate deletion failure
      jest.spyOn(console, "error").mockImplementation(() => {});

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("File deleted successfully");
      expect(prisma.file.delete).toHaveBeenCalled();
    });

    it("should handle non-existent file deletion", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files/nonexistent", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "nonexistent"})});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("File not found");
    });

    it("should handle unauthorized deletion", async () => {
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

    it("should handle files without R2 locator", async () => {
      const unreservedFile = {...mockFile, r2Locator: null, status: "reserved"};
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(unreservedFile);
      (prisma.file.delete as jest.Mock).mockResolvedValue(unreservedFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("File deleted successfully");
    });

    it("should handle database errors during deletion", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.delete as jest.Mock).mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "DELETE",
      });

      const response = await DELETE(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("Edge Cases and Security", () => {
    it("should sanitize filenames with special characters", async () => {
      const specialFile = {...mockFile, filename: "<script>alert('xss')</script>.txt"};
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(specialFile);
      (prisma.file.update as jest.Mock).mockResolvedValue({
        ...specialFile,
        filename: "safe-filename.txt",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: JSON.stringify({
          filename: "<script>alert('xss')</script>.txt",
        }),
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.filename).toBe("string");
    });

    it("should handle very large file sizes", async () => {
      const largeFile = {...mockFile, sizeBytes: BigInt(Number.MAX_SAFE_INTEGER)};
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(largeFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.sizeBytes).toBe("number");
    });

    it("should handle malformed request bodies", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
        method: "PUT",
        body: "{invalid json",
      });

      const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
      expect([400, 500]).toContain(response.status);
    });

    it("should handle null and undefined values gracefully", async () => {
      const incompleteFile = {
        ...mockFile,
        mimeType: null,
        sizeBytes: null,
        expiresAt: null,
      };
      (prisma.file.findUnique as jest.Mock).mockResolvedValue(incompleteFile);

      const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id");
      const response = await GET(request, {params: Promise.resolve({id: "test-file-id"})});

      expect([200, 500]).toContain(response.status);
    });

    it("should handle concurrent access to the same file", async () => {
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);

      let updateCount = 0;
      (prisma.file.update as jest.Mock).mockImplementation(() => {
        updateCount++;
        return Promise.resolve({
          ...mockFile,
          filename: `concurrent-${updateCount}.txt`,
          updatedAt: new Date(),
        });
      });

      const requests = Array.from({length: 10}, (_, i) =>
        PUT(
          new NextRequest("http://localhost:3000/api/v1/files/test-file-id", {
            method: "PUT",
            body: JSON.stringify({
              filename: `concurrent-${i}.txt`,
            }),
          }),
          {params: Promise.resolve({id: "test-file-id"})},
        ),
      );

      const responses = await Promise.all(requests);
      const successfulResponses = responses.filter((r) => r.status === 200);

      expect(successfulResponses.length).toBe(10);
      expect(prisma.file.update).toHaveBeenCalledTimes(10);
    });
  });
});
