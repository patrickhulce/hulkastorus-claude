import {PUT} from "./route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {startMockR2Server, stopMockR2Server} from "../../../../../../../tests/mocks/r2-server";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    file: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

// Mock R2 config to use controlled client
const mockGetObjectInfo = jest.fn();
jest.mock("@/lib/r2-config", () => {
  const originalModule = jest.requireActual("@/lib/r2-config");
  return {
    ...originalModule,
    currentEnv: "test", 
    getR2Client: () => ({
      parseObjectKey: jest.fn().mockReturnValue({
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "test-user-id", 
        fileId: "test-file-id"
      }),
      getObjectInfo: mockGetObjectInfo,
      putObject: jest.fn().mockResolvedValue(undefined),
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _mockServerPort: number;

describe("PUT /api/v1/files/:id/status", () => {
  beforeAll(async () => {
    _mockServerPort = await startMockR2Server(9005);
  });

  afterAll(async () => {
    await stopMockR2Server();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset R2 mock to default success state
    mockGetObjectInfo.mockResolvedValue({
      exists: true,
      size: 1024,
      contentType: "text/plain"
    });
  });

  const mockFile = {
    id: "test-file-id",
    userId: "test-user-id",
    status: "reserved",
    r2Locator: "test/infinite/test-user-id/test-file-id",
    filename: "test.txt",
    fullPath: "/test.txt",
    mimeType: "text/plain",
    sizeBytes: null,
    permissions: "private",
    expirationPolicy: "infinite",
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUpdatedFile = {
    ...mockFile,
    status: "validated",
    sizeBytes: BigInt(1024),
    mimeType: "text/plain",
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({
      user: {id: "test-user-id"},
    });

    (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);
    (prisma.file.update as jest.Mock).mockResolvedValue(mockUpdatedFile);
  });

  it("should validate uploaded file and update status", async () => {
    // Use default mock from beforeEach

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("test-file-id");
    expect(data.status).toBe("validated");
    expect(data.sizeBytes).toBe(1024); // Size from default mock

    // Verify file was updated in database
    expect(prisma.file.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {id: "test-file-id"},
        data: expect.objectContaining({
          status: "validated",
          sizeBytes: expect.any(BigInt),
        }),
      }),
    );
  });

  it("should mark file as failed if not found in R2", async () => {
    // Mock R2 to return file not found
    mockGetObjectInfo.mockResolvedValue({
      exists: false
    });

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT", 
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("File not found in storage");

    // Verify file was marked as failed
    expect(prisma.file.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {id: "test-file-id"},
        data: expect.objectContaining({
          status: "failed",
        }),
      }),
    );
  });

  it("should reject unauthorized requests", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should reject file not owned by user", async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("File not found or not in reserved status");
  });

  it("should reject file not in reserved status", async () => {
    // Mock to return no file (since route filters by status: "reserved")
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("File not found or not in reserved status");
  });

  it("should reject file without R2 locator", async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue({
      ...mockFile,
      r2Locator: null,
    });

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("File has no R2 locator");
  });

  it("should handle validation errors", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "invalid-status",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Validation error");
    expect(data.details).toBeDefined();
  });

  it("should preserve existing mime type if already set", async () => {
    // Mock R2 to return different content type than file has
    mockGetObjectInfo.mockResolvedValue({
      exists: true,
      size: 1024,
      contentType: "application/octet-stream" // Different from file's mimeType
    });

    (prisma.file.findFirst as jest.Mock).mockResolvedValue({
      ...mockFile,
      mimeType: "text/plain", // Already has mime type
    });

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});

    expect(response.status).toBe(200);

    // Should not override existing mime type
    expect(prisma.file.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          mimeType: "application/octet-stream",
        }),
      }),
    );
  });

  it("should update mime type if not previously set", async () => {
    // Mock R2 to return file exists with JSON content type
    mockGetObjectInfo.mockResolvedValue({
      exists: true,
      size: 17,
      contentType: "application/json"
    });

    (prisma.file.findFirst as jest.Mock).mockResolvedValue({
      ...mockFile,
      mimeType: null, // No mime type set
    });

    const request = new NextRequest("http://localhost:3000/api/v1/files/test-file-id/status", {
      method: "PUT",
      body: JSON.stringify({
        status: "uploaded",
      }),
    });

    const response = await PUT(request, {params: Promise.resolve({id: "test-file-id"})});

    expect(response.status).toBe(200);

    // Should update mime type from R2
    expect(prisma.file.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mimeType: "application/json",
        }),
      }),
    );
  });
});
