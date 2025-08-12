import {POST, GET} from "./route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {startMockR2Server, stopMockR2Server} from "../../../../../tests/mocks/r2-server";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    directory: {
      upsert: jest.fn(),
    },
    file: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

// Mock nanoid
let nanoIdCounter = 0;
jest.mock("@/lib/nanoid", () => ({
  generateNanoId: jest.fn(() => {
    const ids = ["test-file-id", "test-dir-id", "test-subdir-id", "test-file-id-2"];
    return ids[nanoIdCounter++ % ids.length];
  }),
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
        endpoint: "http://localhost:9004",
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

describe("/api/v1/files", () => {
  beforeAll(async () => {
    _mockServerPort = await startMockR2Server(9004);
  });

  afterAll(async () => {
    await stopMockR2Server();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    nanoIdCounter = 0; // Reset nano ID counter
  });

  describe("POST /api/v1/files", () => {
    const mockUser = {
      id: "test-user-id",
      isEmailVerified: true,
    };

    const mockDirectory = {
      id: "test-dir-id",
      userId: "test-user-id",
      fullPath: "/",
      defaultPermissions: "private",
      defaultExpirationPolicy: "infinite",
    };

    const mockFile = {
      id: "test-file-id",
      userId: "test-user-id",
      directoryId: "test-dir-id",
      status: "reserved",
      filename: "test.txt",
      fullPath: "/test.txt",
      permissions: "private",
      expirationPolicy: "infinite",
      mimeType: "text/plain",
      sizeBytes: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue({
        user: {id: "test-user-id"},
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.directory.upsert as jest.Mock).mockResolvedValue(mockDirectory);
      (prisma.file.create as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.update as jest.Mock).mockResolvedValue(mockFile);
    });

    it("should create a file record and return upload URL", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "test.txt",
          mimeType: "text/plain",
          sizeBytes: 1024,
          fullPath: "/test.txt",
          expirationPolicy: "infinite",
          permissions: "private",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("test-file-id");
      expect(data.filename).toBe("test.txt");
      expect(data.uploadUrl).toContain("http://localhost:9004");
      expect(data.uploadUrl).toContain("test/infinite/test-user-id/test-file-id");
      expect(data.status).toBe("reserved");

      // Verify file was created in database
      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: "test-file-id",
            userId: "test-user-id",
            filename: "test.txt",
            permissions: "private",
            status: "reserved",
          }),
        }),
      );

      // Verify R2 locator was updated
      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {id: "test-file-id"},
          data: expect.objectContaining({
            r2Locator: "test/infinite/test-user-id/test-file-id",
          }),
        }),
      );
    });

    it("should create nested directory structure", async () => {
      // Reset mocks before this test
      jest.clearAllMocks();
      nanoIdCounter = 0;

      const mockSubDirectory = {
        id: "test-subdir-id",
        userId: "test-user-id",
        fullPath: "/docs/projects",
        defaultPermissions: "private",
        defaultExpirationPolicy: "infinite",
      };

      (prisma.directory.upsert as jest.Mock)
        .mockResolvedValueOnce({...mockDirectory, fullPath: "/docs"})
        .mockResolvedValueOnce(mockSubDirectory);

      const request = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "document.pdf",
          fullPath: "/docs/projects/document.pdf",
          permissions: "public",
        }),
      });

      const response = await POST(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(prisma.directory.upsert).toHaveBeenCalledTimes(2);

      // Check /docs directory creation
      expect(prisma.directory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_fullPath: {
              userId: "test-user-id",
              fullPath: "/docs",
            },
          },
        }),
      );

      // Check /docs/projects directory creation
      expect(prisma.directory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_fullPath: {
              userId: "test-user-id",
              fullPath: "/docs/projects",
            },
          },
        }),
      );
    });

    it("should reject unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "test.txt",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject unverified email users", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isEmailVerified: false,
      });

      const request = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "test.txt",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Email verification required");
    });

    it("should handle validation errors", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          // Missing required filename
          mimeType: "text/plain",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation error");
      expect(data.details).toBeDefined();
    });

    it("should set expiration date for non-infinite policies", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "temp.txt",
          expirationPolicy: "7d",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expirationPolicy: "7d",
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe("GET /api/v1/files", () => {
    const mockFiles = [
      {
        id: "file1",
        filename: "test1.txt",
        fullPath: "/test1.txt",
        mimeType: "text/plain",
        sizeBytes: BigInt(1024),
        permissions: "private",
        status: "validated",
        expirationPolicy: "infinite",
        expiresAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        directory: {fullPath: "/"},
      },
      {
        id: "file2",
        filename: "test2.txt",
        fullPath: "/docs/test2.txt",
        mimeType: "text/plain",
        sizeBytes: BigInt(2048),
        permissions: "public",
        status: "validated",
        expirationPolicy: "30d",
        expiresAt: new Date("2024-02-01"),
        createdAt: new Date("2024-01-02"),
        updatedAt: new Date("2024-01-02"),
        directory: {fullPath: "/docs"},
      },
    ];

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue({
        user: {id: "test-user-id"},
      });

      (prisma.file.findMany as jest.Mock).mockResolvedValue(mockFiles);
      (prisma.file.count as jest.Mock).mockResolvedValue(2);
    });

    it("should list files for authenticated user", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/files");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.files).toHaveLength(2);
      expect(data.files[0].id).toBe("file1");
      expect(data.files[0].sizeBytes).toBe(1024); // BigInt converted to number
      expect(data.pagination.total).toBe(2);
      expect(data.pagination.limit).toBe(10);
    });

    it("should apply filters", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/v1/files?filter~permissions=public&filter~status=validated",
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "test-user-id",
            permissions: "public",
            status: "validated",
          }),
        }),
      );
    });

    it("should handle pagination", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/files?limit=5&offset=10");

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it("should handle ordering", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/files?order_by=filename%2Basc");

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            filename: "asc",
          },
        }),
      );
    });

    it("should reject unauthorized requests", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/files");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});
