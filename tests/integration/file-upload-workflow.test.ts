import {POST as createFile} from "../../src/app/api/v1/files/route";
import {PUT as updateFileStatus} from "../../src/app/api/v1/files/[id]/status/route";
import {GET as downloadFile} from "../../src/app/api/v1/files/[id]/download/route";
import {GET as publicDownload} from "../../src/app/d/[pseudo_id]/route";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {startMockR2Server, stopMockR2Server} from "../mocks/r2-server";

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
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

// Mock nanoid
jest.mock("@/lib/nanoid", () => ({
  generateNanoId: jest.fn().mockReturnValueOnce("test-file-id").mockReturnValueOnce("test-dir-id"),
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
        endpoint: "http://localhost:9008",
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

describe("File Upload Workflow Integration", () => {
  beforeAll(async () => {
    _mockServerPort = await startMockR2Server(9008);
  });

  afterAll(async () => {
    await stopMockR2Server();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup common mocks
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auth = jest.mocked(require("@/lib/auth").auth);
    auth.mockResolvedValue({
      user: {id: "test-user-id"},
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "test-user-id",
      isEmailVerified: true,
    });

    (prisma.directory.upsert as jest.Mock).mockResolvedValue({
      id: "test-dir-id",
      userId: "test-user-id",
      fullPath: "/",
      defaultPermissions: "private",
      defaultExpirationPolicy: "infinite",
    });
  });

  describe("Complete file upload and download workflow", () => {
    it("should handle the complete workflow: create -> upload -> validate -> download", async () => {
      const fileContent = "Hello, world! This is a test file.";

      // Step 1: Create file record and get upload URL
      const mockCreatedFile = {
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
        r2Locator: "test/infinite/test-user-id/test-file-id",
      };

      (prisma.file.create as jest.Mock).mockResolvedValue(mockCreatedFile);
      (prisma.file.update as jest.Mock).mockResolvedValue(mockCreatedFile);

      const createRequest = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "test.txt",
          mimeType: "text/plain",
          permissions: "private",
        }),
      });

      const createResponse = await createFile(createRequest);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(200);
      expect(createData.uploadUrl).toContain("http://localhost:9008");
      expect(createData.id).toBe("test-file-id");
      expect(createData.status).toBe("reserved");

      // Step 2: Upload file to R2 using the upload URL
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {getR2Client} = jest.requireActual("@/lib/r2-config");
      const r2Client = getR2Client();
      await r2Client.putObject({
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "test-user-id",
        fileId: "test-file-id",
        body: fileContent,
        contentType: "text/plain",
      });

      // Step 3: Update file status to validate upload
      const mockValidatedFile = {
        ...mockCreatedFile,
        status: "validated",
        sizeBytes: BigInt(fileContent.length),
      };

      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockCreatedFile);
      (prisma.file.update as jest.Mock).mockResolvedValue(mockValidatedFile);

      const statusRequest = new NextRequest(
        "http://localhost:3000/api/v1/files/test-file-id/status",
        {
          method: "PUT",
          body: JSON.stringify({
            status: "uploaded",
          }),
        },
      );

      const statusResponse = await updateFileStatus(statusRequest, {
        params: Promise.resolve({id: "test-file-id"}),
      });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusData.status).toBe("validated");
      expect(statusData.sizeBytes).toBe(fileContent.length);

      // Step 4: Download file (authenticated download)
      (prisma.file.findUnique as jest.Mock).mockResolvedValue({
        ...mockValidatedFile,
        user: {id: "test-user-id"},
      });

      const downloadRequest = new NextRequest(
        "http://localhost:3000/api/v1/files/test-file-id/download",
      );

      const downloadResponse = await downloadFile(downloadRequest, {
        params: Promise.resolve({id: "test-file-id"}),
      });

      expect(downloadResponse.status).toBe(307); // Redirect
      const downloadLocation = downloadResponse.headers.get("Location");
      expect(downloadLocation).toContain("http://localhost:9008");
      expect(downloadLocation).toContain("test/infinite/test-user-id/test-file-id");

      // Verify we can actually download the content
      const actualContent = await r2Client.getObject({
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "test-user-id",
        fileId: "test-file-id",
      });
      expect(actualContent.body).toBe(fileContent);
    });

    it("should handle public file workflow", async () => {
      const fileContent = "This is a public file for everyone!";

      // Create public file
      const mockPublicFile = {
        id: "test-file-id",
        userId: "test-user-id",
        directoryId: "test-dir-id",
        status: "validated",
        filename: "public.txt",
        fullPath: "/public.txt",
        permissions: "public",
        expirationPolicy: "infinite",
        mimeType: "text/plain",
        sizeBytes: BigInt(fileContent.length),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        r2Locator: "test/infinite/test-user-id/test-file-id",
        user: {id: "test-user-id"},
      };

      // Upload file to R2
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {getR2Client} = jest.requireActual("@/lib/r2-config");
      const r2Client = getR2Client();
      await r2Client.putObject({
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "test-user-id",
        fileId: "test-file-id",
        body: fileContent,
        contentType: "text/plain",
      });

      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockPublicFile);

      // Test public download without authentication
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue(null); // No authentication

      const publicRequest = new NextRequest("http://localhost:3000/d/test-file-id");

      const publicResponse = await publicDownload(publicRequest, {
        params: Promise.resolve({pseudo_id: "test-file-id"}),
      });

      expect(publicResponse.status).toBe(307); // Redirect
      const publicLocation = publicResponse.headers.get("Location");
      expect(publicLocation).toContain("http://localhost:9008");

      // Verify content is accessible
      const actualContent = await r2Client.getObject({
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "test-user-id",
        fileId: "test-file-id",
      });
      expect(actualContent.body).toBe(fileContent);
    });

    it("should reject access to private files from unauthorized users", async () => {
      const mockPrivateFile = {
        id: "test-file-id",
        userId: "file-owner-id", // Different user
        status: "validated",
        permissions: "private",
        r2Locator: "test/infinite/file-owner-id/test-file-id",
        user: {id: "file-owner-id"},
      };

      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockPrivateFile);

      // Try to download as different user
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const auth = jest.mocked(require("@/lib/auth").auth);
      auth.mockResolvedValue({
        user: {id: "different-user-id"},
      });

      const downloadRequest = new NextRequest(
        "http://localhost:3000/api/v1/files/test-file-id/download",
      );

      const downloadResponse = await downloadFile(downloadRequest, {
        params: Promise.resolve({id: "test-file-id"}),
      });
      const downloadData = await downloadResponse.json();

      expect(downloadResponse.status).toBe(404);
      expect(downloadData.error).toBe("File not found");

      // Also test public download route
      const publicRequest = new NextRequest("http://localhost:3000/d/test-file-id");

      const publicResponse = await publicDownload(publicRequest, {
        params: Promise.resolve({pseudo_id: "test-file-id"}),
      });
      const publicData = await publicResponse.json();

      expect(publicResponse.status).toBe(404);
      expect(publicData.error).toBe("File not found");
    });

    it("should handle expired files", async () => {
      const mockExpiredFile = {
        id: "test-file-id",
        userId: "test-user-id",
        status: "validated",
        permissions: "public",
        expiresAt: new Date("2020-01-01"), // Past date
        r2Locator: "test/7d/test-user-id/test-file-id",
        user: {id: "test-user-id"},
      };

      (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockExpiredFile);

      const downloadRequest = new NextRequest(
        "http://localhost:3000/api/v1/files/test-file-id/download",
      );

      const downloadResponse = await downloadFile(downloadRequest, {
        params: Promise.resolve({id: "test-file-id"}),
      });
      const downloadData = await downloadResponse.json();

      expect(downloadResponse.status).toBe(404);
      expect(downloadData.error).toBe("File not found");
    });

    it("should handle file upload failure scenario", async () => {
      // Create file record
      const mockFile = {
        id: "test-file-id",
        userId: "test-user-id",
        directoryId: "test-dir-id",
        status: "reserved",
        r2Locator: "test/infinite/test-user-id/test-file-id",
        filename: "test.txt",
      };

      (prisma.file.findFirst as jest.Mock).mockResolvedValue(mockFile);

      // Try to validate without actually uploading to R2
      const statusRequest = new NextRequest(
        "http://localhost:3000/api/v1/files/test-file-id/status",
        {
          method: "PUT",
          body: JSON.stringify({
            status: "uploaded",
          }),
        },
      );

      const statusResponse = await updateFileStatus(statusRequest, {
        params: Promise.resolve({id: "test-file-id"}),
      });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(400);
      expect(statusData.error).toBe("File not found in storage");

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
  });

  describe("Directory creation workflow", () => {
    it("should create nested directory structure during file upload", async () => {
      const mockRootDir = {
        id: "root-dir-id",
        userId: "test-user-id",
        fullPath: "/docs",
      };

      const mockSubDir = {
        id: "sub-dir-id",
        userId: "test-user-id",
        fullPath: "/docs/projects",
      };

      const mockFile = {
        id: "test-file-id",
        userId: "test-user-id",
        directoryId: "sub-dir-id",
        status: "reserved",
        filename: "document.pdf",
        fullPath: "/docs/projects/document.pdf",
        permissions: "private",
      };

      (prisma.directory.upsert as jest.Mock)
        .mockResolvedValueOnce(mockRootDir)
        .mockResolvedValueOnce(mockSubDir);
      (prisma.file.create as jest.Mock).mockResolvedValue(mockFile);
      (prisma.file.update as jest.Mock).mockResolvedValue(mockFile);

      const createRequest = new NextRequest("http://localhost:3000/api/v1/files", {
        method: "POST",
        body: JSON.stringify({
          filename: "document.pdf",
          fullPath: "/docs/projects/document.pdf",
          permissions: "private",
        }),
      });

      const createResponse = await createFile(createRequest);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(200);
      expect(createData.fullPath).toBe("/docs/projects/document.pdf");

      // Verify both directories were created
      expect(prisma.directory.upsert).toHaveBeenCalledTimes(2);

      // Check /docs directory
      expect(prisma.directory.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            userId_fullPath: {
              userId: "test-user-id",
              fullPath: "/docs",
            },
          },
        }),
      );

      // Check /docs/projects directory
      expect(prisma.directory.upsert).toHaveBeenNthCalledWith(
        2,
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
  });
});
