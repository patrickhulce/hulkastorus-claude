import {MockR2Server} from "./r2-server";
// Jest globals are available without import in this project

describe("MockR2Server", () => {
  let server: MockR2Server;
  const testPort = 9002;
  const testBucket = "test-bucket";

  beforeAll(async () => {
    server = new MockR2Server(testPort, testBucket);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.clear();
  });

  describe("PUT operations", () => {
    it("should store object with PUT request", async () => {
      const objectKey = "test/file.txt";
      const content = "Hello, world!";

      const response = await fetch(`http://localhost:${testPort}/${testBucket}/${objectKey}`, {
        method: "PUT",
        body: content,
        headers: {"Content-Type": "text/plain"},
      });

      expect(response.status).toBe(200);
      expect(server.hasObject(objectKey)).toBe(true);

      const stored = server.getObject(objectKey);
      expect(stored?.data.toString()).toBe(content);
      expect(stored?.contentType).toBe("text/plain");
      expect(stored?.size).toBe(content.length);
    });

    it("should return ETag in response", async () => {
      const objectKey = "test/file.txt";
      const content = "Hello, world!";

      const response = await fetch(`http://localhost:${testPort}/${testBucket}/${objectKey}`, {
        method: "PUT",
        body: content,
        headers: {"Content-Type": "text/plain"},
      });

      expect(response.headers.get("etag")).toBeTruthy();
      expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it("should handle binary data", async () => {
      const objectKey = "test/binary.dat";
      const binaryData = new Uint8Array([0, 1, 2, 255, 254, 253]);

      const response = await fetch(`http://localhost:${testPort}/${testBucket}/${objectKey}`, {
        method: "PUT",
        body: binaryData,
        headers: {"Content-Type": "application/octet-stream"},
      });

      expect(response.status).toBe(200);
      expect(server.hasObject(objectKey)).toBe(true);

      const stored = server.getObject(objectKey);
      expect(stored?.data).toEqual(Buffer.from(binaryData));
      expect(stored?.contentType).toBe("application/octet-stream");
    });
  });

  describe("GET operations", () => {
    beforeEach(async () => {
      // Setup test object
      await fetch(`http://localhost:${testPort}/${testBucket}/test/file.txt`, {
        method: "PUT",
        body: "Test content",
        headers: {"Content-Type": "text/plain"},
      });
    });

    it("should retrieve stored object", async () => {
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/test/file.txt`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/plain");
      expect(response.headers.get("content-length")).toBe("12");

      const content = await response.text();
      expect(content).toBe("Test content");
    });

    it("should return 404 for non-existent object", async () => {
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/nonexistent.txt`);

      expect(response.status).toBe(404);
    });

    it("should include proper headers in response", async () => {
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/test/file.txt`);

      expect(response.headers.get("etag")).toBeTruthy();
      expect(response.headers.get("last-modified")).toBeTruthy();
      expect(response.headers.get("content-length")).toBe("12");
    });
  });

  describe("HEAD operations", () => {
    beforeEach(async () => {
      // Setup test object
      await fetch(`http://localhost:${testPort}/${testBucket}/test/file.txt`, {
        method: "PUT",
        body: "Test content",
        headers: {"Content-Type": "text/plain"},
      });
    });

    it("should return metadata without body", async () => {
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/test/file.txt`, {
        method: "HEAD",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/plain");
      expect(response.headers.get("content-length")).toBe("12");
      expect(response.headers.get("etag")).toBeTruthy();
      expect(response.headers.get("last-modified")).toBeTruthy();

      const content = await response.text();
      expect(content).toBe(""); // No body for HEAD request
    });

    it("should return 404 for non-existent object", async () => {
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/nonexistent.txt`, {
        method: "HEAD",
      });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE operations", () => {
    beforeEach(async () => {
      // Setup test object
      await fetch(`http://localhost:${testPort}/${testBucket}/test/file.txt`, {
        method: "PUT",
        body: "Test content",
        headers: {"Content-Type": "text/plain"},
      });
    });

    it("should delete existing object", async () => {
      expect(server.hasObject("test/file.txt")).toBe(true);

      const response = await fetch(`http://localhost:${testPort}/${testBucket}/test/file.txt`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);
      expect(server.hasObject("test/file.txt")).toBe(false);
    });

    it("should return 204 even for non-existent object", async () => {
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/nonexistent.txt`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);
    });
  });

  describe("error handling", () => {
    it("should return 404 for wrong bucket name", async () => {
      const response = await fetch(`http://localhost:${testPort}/wrong-bucket/test.txt`, {
        method: "GET",
      });

      expect(response.status).toBe(404);
    });

    it("should return 405 for unsupported methods", async () => {
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/test.txt`, {
        method: "PATCH",
      });

      expect(response.status).toBe(405);
    });

    it("should return 400 for invalid requests", async () => {
      // PUT without object key
      const response = await fetch(`http://localhost:${testPort}/${testBucket}/`, {
        method: "PUT",
        body: "content",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("helper methods", () => {
    it("should track object count correctly", async () => {
      expect(server.getObjectCount()).toBe(0);

      await fetch(`http://localhost:${testPort}/${testBucket}/file1.txt`, {
        method: "PUT",
        body: "content1",
      });

      expect(server.getObjectCount()).toBe(1);

      await fetch(`http://localhost:${testPort}/${testBucket}/file2.txt`, {
        method: "PUT",
        body: "content2",
      });

      expect(server.getObjectCount()).toBe(2);

      await fetch(`http://localhost:${testPort}/${testBucket}/file1.txt`, {
        method: "DELETE",
      });

      expect(server.getObjectCount()).toBe(1);
    });

    it("should list object keys correctly", async () => {
      await fetch(`http://localhost:${testPort}/${testBucket}/dir1/file1.txt`, {
        method: "PUT",
        body: "content1",
      });

      await fetch(`http://localhost:${testPort}/${testBucket}/dir2/file2.txt`, {
        method: "PUT",
        body: "content2",
      });

      const keys = server.getObjectKeys();
      expect(keys).toContain("dir1/file1.txt");
      expect(keys).toContain("dir2/file2.txt");
      expect(keys).toHaveLength(2);
    });

    it("should clear all objects", async () => {
      await fetch(`http://localhost:${testPort}/${testBucket}/file1.txt`, {
        method: "PUT",
        body: "content1",
      });

      await fetch(`http://localhost:${testPort}/${testBucket}/file2.txt`, {
        method: "PUT",
        body: "content2",
      });

      expect(server.getObjectCount()).toBe(2);

      server.clear();

      expect(server.getObjectCount()).toBe(0);
      expect(server.getObjectKeys()).toHaveLength(0);
    });
  });
});
