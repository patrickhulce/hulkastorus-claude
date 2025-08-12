import {POST, GET} from "./route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    directory: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

describe("/api/v1/directories", () => {
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
      files: 5,
      children: 2,
    },
    parent: null,
  };

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

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("test-dir-id");
      expect(data.fullPath).toBe("/documents");
      expect(data.fileCount).toBe(5);
      expect(data.subdirectoryCount).toBe(2);

      expect(prisma.directory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_fullPath: {
              userId: "test-user-id",
              fullPath: "/documents",
            },
          }),
          create: expect.objectContaining({
            userId: "test-user-id",
            fullPath: "/documents",
            defaultPermissions: "private",
            defaultExpirationPolicy: "infinite",
          }),
        }),
      );
    });

    it("should create nested directory structure", async () => {
      (prisma.directory.upsert as jest.Mock)
        .mockResolvedValueOnce({...mockDirectory, fullPath: "/projects"})
        .mockResolvedValueOnce({...mockDirectory, fullPath: "/projects/2024"})
        .mockResolvedValueOnce({...mockDirectory, fullPath: "/projects/2024/december"});
      (prisma.directory.findUnique as jest.Mock).mockResolvedValue({
        ...mockDirectory,
        fullPath: "/projects/2024/december",
      });

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "/projects/2024/december",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fullPath).toBe("/projects/2024/december");
      expect(prisma.directory.upsert).toHaveBeenCalledTimes(3);
    });

    it("should return 401 for unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "/documents",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 for invalid path", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/directories", {
        method: "POST",
        body: JSON.stringify({
          fullPath: "",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation error");
    });
  });

  describe("GET /api/v1/directories", () => {
    it("should list all user directories", async () => {
      const mockDirectories = [
        mockDirectory,
        {...mockDirectory, id: "dir-2", fullPath: "/images"},
        {...mockDirectory, id: "dir-3", fullPath: "/videos"},
      ];

      (prisma.directory.findMany as jest.Mock).mockResolvedValue(mockDirectories);

      const request = new NextRequest("http://localhost:3000/api/v1/directories");
      const response = await GET(request);
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
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "test-user-id",
            parentId: "parent-dir-id",
          }),
        }),
      );
    });

    it("should filter directories by path", async () => {
      (prisma.directory.findMany as jest.Mock).mockResolvedValue([mockDirectory]);

      const request = new NextRequest("http://localhost:3000/api/v1/directories?path=/documents");
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "test-user-id",
            fullPath: "/documents",
          }),
        }),
      );
    });

    it("should get recursive directories", async () => {
      (prisma.directory.findMany as jest.Mock).mockResolvedValue([
        mockDirectory,
        {...mockDirectory, id: "sub-1", fullPath: "/documents/sub1"},
        {...mockDirectory, id: "sub-2", fullPath: "/documents/sub2"},
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/v1/directories?path=/documents&recursive=true",
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "test-user-id",
            fullPath: {
              startsWith: "/documents/",
            },
          }),
        }),
      );
    });

    it("should return 401 for unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/directories");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});