import {test, expect} from "@playwright/test";
import {MockR2Server} from "../mocks/r2-server";

/**
 * E2E tests for R2 integration
 * These tests verify the mock R2 server works correctly in an end-to-end scenario
 */

let mockR2Server: MockR2Server;
let serverPort: number;

test.beforeAll(async ({}, testInfo) => {
  // Use different port for each worker to avoid conflicts
  serverPort = 9003 + testInfo.workerIndex;
  mockR2Server = new MockR2Server(serverPort, "hulkastorus-ugc");
  await mockR2Server.start();
});

test.afterAll(async () => {
  await mockR2Server.stop();
});

test.beforeEach(async () => {
  mockR2Server.clear();
});

test.describe("R2 Mock Server E2E", () => {
  test("should handle S3-compatible upload flow", async ({request}) => {
    const objectKey = "test/30d/user123/file456.jpg";
    const testContent = "fake image data";

    // Upload file
    const uploadResponse = await request.put(
      `http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`,
      {
        data: testContent,
        headers: {
          "Content-Type": "image/jpeg",
        },
      },
    );

    expect(uploadResponse.status()).toBe(200);

    // Verify ETag is returned
    const etag = uploadResponse.headers()["etag"];
    expect(etag).toBeTruthy();
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);

    // Verify object is stored
    expect(mockR2Server.hasObject(objectKey)).toBe(true);
  });

  test("should handle S3-compatible download flow", async ({request}) => {
    const objectKey = "test/7d/user789/document.pdf";
    const testContent = "fake PDF content";

    // Upload file first
    await request.put(`http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`, {
      data: testContent,
      headers: {
        "Content-Type": "application/pdf",
      },
    });

    // Download file
    const downloadResponse = await request.get(
      `http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`,
    );

    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()["content-type"]).toBe("application/pdf");
    expect(downloadResponse.headers()["content-length"]).toBe(testContent.length.toString());

    const downloadedContent = await downloadResponse.text();
    expect(downloadedContent).toBe(testContent);
  });

  test("should handle S3-compatible metadata requests", async ({request}) => {
    const objectKey = "production/infinite/user456/archive.zip";
    const testContent = "fake archive data";

    // Upload file first
    await request.put(`http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`, {
      data: testContent,
      headers: {
        "Content-Type": "application/zip",
      },
    });

    // Get metadata with HEAD request
    const headResponse = await request.head(
      `http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`,
    );

    expect(headResponse.status()).toBe(200);
    expect(headResponse.headers()["content-type"]).toBe("application/zip");
    expect(headResponse.headers()["content-length"]).toBe(testContent.length.toString());
    expect(headResponse.headers()["etag"]).toBeTruthy();
    expect(headResponse.headers()["last-modified"]).toBeTruthy();
  });

  test("should handle S3-compatible delete operations", async ({request}) => {
    const objectKey = "test/1d/user101/temp.txt";
    const testContent = "temporary content";

    // Upload file first
    await request.put(`http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`, {
      data: testContent,
      headers: {
        "Content-Type": "text/plain",
      },
    });

    // Verify file exists
    expect(mockR2Server.hasObject(objectKey)).toBe(true);

    // Delete file
    const deleteResponse = await request.delete(
      `http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`,
    );

    expect(deleteResponse.status()).toBe(204);

    // Verify file is deleted
    expect(mockR2Server.hasObject(objectKey)).toBe(false);
  });

  test("should handle multiple concurrent operations", async ({request}) => {
    const operations = [];

    // Upload multiple files concurrently
    for (let i = 0; i < 5; i++) {
      const objectKey = `test/30d/user${i}/file${i}.txt`;
      const content = `Content for file ${i}`;

      operations.push(
        request.put(`http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`, {
          data: content,
          headers: {
            "Content-Type": "text/plain",
          },
        }),
      );
    }

    const responses = await Promise.all(operations);

    // Verify all uploads succeeded
    responses.forEach((response) => {
      expect(response.status()).toBe(200);
    });

    // Verify all files are stored
    expect(mockR2Server.getObjectCount()).toBe(5);

    // Verify object keys are correct
    const keys = mockR2Server.getObjectKeys();
    for (let i = 0; i < 5; i++) {
      expect(keys).toContain(`test/30d/user${i}/file${i}.txt`);
    }
  });

  test("should follow ARCHITECTURE.md bucket layout", async ({request}) => {
    const testCases = [
      {
        env: "production",
        lifecyclePolicy: "infinite",
        userId: "user123",
        fileId: "important-file.pdf",
      },
      {
        env: "development",
        lifecyclePolicy: "7d",
        userId: "user456",
        fileId: "test-data.json",
      },
      {
        env: "staging",
        lifecyclePolicy: "30d",
        userId: "user789",
        fileId: "model.ckpt",
      },
    ];

    for (const testCase of testCases) {
      const objectKey = `${testCase.env}/${testCase.lifecyclePolicy}/${testCase.userId}/${testCase.fileId}`;
      const content = `Content for ${testCase.fileId}`;

      // Upload file
      const response = await request.put(
        `http://localhost:${serverPort}/hulkastorus-ugc/${objectKey}`,
        {
          data: content,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        },
      );

      expect(response.status()).toBe(200);
      expect(mockR2Server.hasObject(objectKey)).toBe(true);

      // Verify object key structure
      const storedObject = mockR2Server.getObject(objectKey);
      expect(storedObject?.key).toBe(objectKey);
      expect(storedObject?.data.toString()).toBe(content);
    }

    expect(mockR2Server.getObjectCount()).toBe(testCases.length);
  });

  test("should handle error cases gracefully", async ({request}) => {
    // Test 404 for non-existent object
    const getResponse = await request.get(
      `http://localhost:${serverPort}/hulkastorus-ugc/nonexistent/file.txt`,
    );
    expect(getResponse.status()).toBe(404);

    // Test 404 for HEAD on non-existent object
    const headResponse = await request.head(
      `http://localhost:${serverPort}/hulkastorus-ugc/nonexistent/file.txt`,
    );
    expect(headResponse.status()).toBe(404);

    // Test 404 for wrong bucket
    const wrongBucketResponse = await request.get(
      `http://localhost:${serverPort}/wrong-bucket/file.txt`,
    );
    expect(wrongBucketResponse.status()).toBe(404);

    // Test 405 for unsupported method
    const patchResponse = await request.patch(
      `http://localhost:${serverPort}/hulkastorus-ugc/test.txt`,
    );
    expect(patchResponse.status()).toBe(405);
  });
});
