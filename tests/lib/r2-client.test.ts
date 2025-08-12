import {R2Client} from "../../src/lib/r2-client";
import {MockR2Server} from "../mocks/r2-server";
// Jest globals are available without import in this project

describe("R2Client", () => {
  let mockServer: MockR2Server;
  let r2Client: R2Client;
  const testPort = 9001;
  const testBucket = "test-bucket";

  beforeAll(async () => {
    mockServer = new MockR2Server(testPort, testBucket);
    await mockServer.start();

    // Create R2 client pointing to mock server
    r2Client = new R2Client({
      accountId: "test-account",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucketName: testBucket,
      endpoint: `http://localhost:${testPort}`,
    });
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.clear();
  });

  describe("getUploadUrl", () => {
    it("should generate presigned upload URL with correct object key", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
        contentType: "image/jpeg",
      };

      const result = await r2Client.getUploadUrl(params);

      expect(result.uploadUrl).toContain(testBucket);
      expect(result.objectKey).toBe("test/30d/user123/file456");
      expect(result.uploadUrl).toContain("X-Amz-Signature");
    });

    it("should use default expiration time", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "infinite",
        userId: "user123",
        fileId: "file456",
      };

      const result = await r2Client.getUploadUrl(params);
      expect(result.uploadUrl).toBeTruthy();
    });

    it("should use custom expiration time", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "7d",
        userId: "user123",
        fileId: "file456",
        expiresIn: 1800, // 30 minutes
      };

      const result = await r2Client.getUploadUrl(params);
      expect(result.uploadUrl).toBeTruthy();
    });
  });

  describe("getDownloadUrl", () => {
    beforeEach(async () => {
      // Upload a test file first
      const uploadParams = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
      };

      const {uploadUrl} = await r2Client.getUploadUrl(uploadParams);

      // Simulate file upload to mock server
      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: "test file content",
        headers: {"Content-Type": "text/plain"},
      });

      expect(response.ok).toBe(true);
    });

    it("should generate presigned download URL", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
      };

      const downloadUrl = await r2Client.getDownloadUrl(params);

      expect(downloadUrl).toContain(testBucket);
      expect(downloadUrl).toContain("test/30d/user123/file456");
      expect(downloadUrl).toContain("X-Amz-Signature");
    });

    it("should work with custom expiration", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
        expiresIn: 7200, // 2 hours
      };

      const downloadUrl = await r2Client.getDownloadUrl(params);
      expect(downloadUrl).toBeTruthy();
    });
  });

  describe("getObjectInfo", () => {
    beforeEach(async () => {
      // Upload a test file first
      const uploadParams = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
      };

      const {uploadUrl} = await r2Client.getUploadUrl(uploadParams);

      const testContent = "test file content for metadata";
      await fetch(uploadUrl, {
        method: "PUT",
        body: testContent,
        headers: {"Content-Type": "text/plain"},
      });
    });

    it("should return object metadata when object exists", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
      };

      const info = await r2Client.getObjectInfo(params);

      expect(info.exists).toBe(true);
      expect(info.size).toBe(30); // Length of test content
      expect(info.contentType).toBe("text/plain");
      expect(info.lastModified).toBeInstanceOf(Date);
    });

    it("should return exists: false when object does not exist", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "nonexistent",
      };

      const info = await r2Client.getObjectInfo(params);

      expect(info.exists).toBe(false);
      expect(info.size).toBeUndefined();
      expect(info.contentType).toBeUndefined();
    });
  });

  describe("deleteObject", () => {
    beforeEach(async () => {
      // Upload a test file first
      const uploadParams = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
      };

      const {uploadUrl} = await r2Client.getUploadUrl(uploadParams);

      await fetch(uploadUrl, {
        method: "PUT",
        body: "test file content",
        headers: {"Content-Type": "text/plain"},
      });
    });

    it("should delete existing object", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
      };

      // Verify object exists
      expect(mockServer.hasObject("test/30d/user123/file456")).toBe(true);

      // Delete object
      await r2Client.deleteObject(params);

      // Verify object is deleted
      expect(mockServer.hasObject("test/30d/user123/file456")).toBe(false);
    });

    it("should not throw when deleting non-existent object", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "nonexistent",
      };

      await expect(r2Client.deleteObject(params)).resolves.not.toThrow();
    });
  });

  describe("parseObjectKey", () => {
    it("should parse valid object key correctly", () => {
      const r2Client = new R2Client({
        accountId: "test",
        accessKeyId: "test",
        secretAccessKey: "test",
        bucketName: "test",
      });

      const result = r2Client.parseObjectKey("production/30d/user123/file456");

      expect(result).toEqual({
        env: "production",
        lifecyclePolicy: "30d",
        userId: "user123",
        fileId: "file456",
      });
    });

    it("should return null for invalid object key", () => {
      const r2Client = new R2Client({
        accountId: "test",
        accessKeyId: "test",
        secretAccessKey: "test",
        bucketName: "test",
      });

      expect(r2Client.parseObjectKey("invalid/key")).toBeNull();
      expect(r2Client.parseObjectKey("")).toBeNull();
      expect(r2Client.parseObjectKey("too/few/parts")).toBeNull();
      expect(r2Client.parseObjectKey("too/many/parts/here/extra")).toBeNull();
    });
  });

  describe("integration with mock server", () => {
    it("should perform full upload-download cycle", async () => {
      const params = {
        env: "test",
        lifecyclePolicy: "7d",
        userId: "user789",
        fileId: "file123",
        contentType: "application/json",
      };

      // Get upload URL
      const {uploadUrl, objectKey} = await r2Client.getUploadUrl(params);

      // Upload file
      const testData = JSON.stringify({message: "Hello, world!"});
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: testData,
        headers: {"Content-Type": "application/json"},
      });

      expect(uploadResponse.ok).toBe(true);

      // Verify object exists in mock server
      expect(mockServer.hasObject(objectKey)).toBe(true);

      // Get object info
      const info = await r2Client.getObjectInfo(params);
      expect(info.exists).toBe(true);
      expect(info.size).toBe(testData.length);
      expect(info.contentType).toBe("application/json");

      // Get download URL and fetch content
      const downloadUrl = await r2Client.getDownloadUrl(params);
      const downloadResponse = await fetch(downloadUrl);
      const downloadedContent = await downloadResponse.text();

      expect(downloadedContent).toBe(testData);

      // Clean up - delete object
      await r2Client.deleteObject(params);
      expect(mockServer.hasObject(objectKey)).toBe(false);
    });

    it("should handle multiple files with different lifecycle policies", async () => {
      const files = [
        {env: "test", lifecyclePolicy: "infinite", userId: "user1", fileId: "file1"},
        {env: "test", lifecyclePolicy: "30d", userId: "user1", fileId: "file2"},
        {env: "test", lifecyclePolicy: "7d", userId: "user2", fileId: "file3"},
      ];

      // Upload multiple files
      for (const file of files) {
        const {uploadUrl} = await r2Client.getUploadUrl(file);
        await fetch(uploadUrl, {
          method: "PUT",
          body: `Content for ${file.fileId}`,
          headers: {"Content-Type": "text/plain"},
        });
      }

      expect(mockServer.getObjectCount()).toBe(3);

      // Verify all files exist
      for (const file of files) {
        const info = await r2Client.getObjectInfo(file);
        expect(info.exists).toBe(true);
      }

      // Clean up
      for (const file of files) {
        await r2Client.deleteObject(file);
      }

      expect(mockServer.getObjectCount()).toBe(0);
    });
  });
});
