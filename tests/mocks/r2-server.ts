import {createServer, Server} from "http";
import {parse} from "url";
import {Buffer} from "buffer";
import crypto from "crypto";

interface StoredObject {
  key: string;
  data: Buffer;
  contentType: string;
  size: number;
  lastModified: Date;
  etag: string;
}

/**
 * Mock R2 server for testing
 * Implements S3-compatible API endpoints used by the R2Client
 */
export class MockR2Server {
  private server: Server;
  private objects: Map<string, StoredObject> = new Map();
  private port: number;
  private bucketName: string;

  constructor(port = 9000, bucketName = "test-bucket") {
    this.port = port;
    this.bucketName = bucketName;
    this.server = createServer(this.handleRequest.bind(this));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`Mock R2 server running on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  clear(): void {
    this.objects.clear();
  }

  getEndpoint(): string {
    return `http://localhost:${this.port}`;
  }

  private handleRequest(req: any, res: any): void {
    const parsedUrl = parse(req.url, true);
    const path = parsedUrl.pathname!;
    const method = req.method;

    // Extract bucket and object key from path
    const pathParts = path.split("/").filter(Boolean);
    if (pathParts.length === 0) {
      this.sendError(res, 404, "NotFound", "No bucket specified");
      return;
    }

    const bucket = pathParts[0];
    const objectKey = pathParts.slice(1).join("/");

    if (bucket !== this.bucketName) {
      this.sendError(res, 404, "NoSuchBucket", `Bucket ${bucket} does not exist`);
      return;
    }

    try {
      switch (method) {
        case "PUT":
          this.handlePutObject(req, res, objectKey);
          break;
        case "GET":
          this.handleGetObject(req, res, objectKey);
          break;
        case "HEAD":
          this.handleHeadObject(req, res, objectKey);
          break;
        case "DELETE":
          this.handleDeleteObject(req, res, objectKey);
          break;
        default:
          this.sendError(res, 405, "MethodNotAllowed", `Method ${method} not allowed`);
      }
    } catch (error) {
      console.error("Error handling request:", error);
      this.sendError(res, 500, "InternalError", "Internal server error");
    }
  }

  private handlePutObject(req: any, res: any, objectKey: string): void {
    if (!objectKey) {
      this.sendError(res, 400, "InvalidRequest", "Object key is required");
      return;
    }

    const chunks: Buffer[] = [];
    const contentType = req.headers["content-type"] || "application/octet-stream";

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const data = Buffer.concat(chunks);
      const etag = crypto.createHash("md5").update(data).digest("hex");

      const object: StoredObject = {
        key: objectKey,
        data,
        contentType,
        size: data.length,
        lastModified: new Date(),
        etag: `"${etag}"`,
      };

      this.objects.set(objectKey, object);

      res.writeHead(200, {
        "Content-Type": "application/xml",
        ETag: object.etag,
      });

      res.end(`<?xml version="1.0" encoding="UTF-8"?>
<PutObjectResult>
    <ETag>${object.etag}</ETag>
</PutObjectResult>`);
    });

    req.on("error", (error: Error) => {
      console.error("Error reading request body:", error);
      this.sendError(res, 400, "BadRequest", "Error reading request body");
    });
  }

  private handleGetObject(req: any, res: any, objectKey: string): void {
    if (!objectKey) {
      this.sendError(res, 400, "InvalidRequest", "Object key is required");
      return;
    }

    const object = this.objects.get(objectKey);
    if (!object) {
      this.sendError(res, 404, "NoSuchKey", `Object ${objectKey} does not exist`);
      return;
    }

    res.writeHead(200, {
      "Content-Type": object.contentType,
      "Content-Length": object.size,
      "Last-Modified": object.lastModified.toUTCString(),
      ETag: object.etag,
    });

    res.end(object.data);
  }

  private handleHeadObject(req: any, res: any, objectKey: string): void {
    if (!objectKey) {
      this.sendError(res, 400, "InvalidRequest", "Object key is required");
      return;
    }

    const object = this.objects.get(objectKey);
    if (!object) {
      this.sendError(res, 404, "NoSuchKey", `Object ${objectKey} does not exist`);
      return;
    }

    res.writeHead(200, {
      "Content-Type": object.contentType,
      "Content-Length": object.size,
      "Last-Modified": object.lastModified.toUTCString(),
      ETag: object.etag,
    });

    res.end();
  }

  private handleDeleteObject(req: any, res: any, objectKey: string): void {
    if (!objectKey) {
      this.sendError(res, 400, "InvalidRequest", "Object key is required");
      return;
    }

    this.objects.delete(objectKey);

    res.writeHead(204);
    res.end();
  }

  private sendError(res: any, statusCode: number, code: string, message: string): void {
    res.writeHead(statusCode, {"Content-Type": "application/xml"});
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
    <Code>${code}</Code>
    <Message>${message}</Message>
</Error>`);
  }

  // Helper methods for testing
  hasObject(objectKey: string): boolean {
    return this.objects.has(objectKey);
  }

  getObject(objectKey: string): StoredObject | undefined {
    return this.objects.get(objectKey);
  }

  getObjectCount(): number {
    return this.objects.size;
  }

  getObjectKeys(): string[] {
    return Array.from(this.objects.keys());
  }
}

// Global server instance for tests
let globalMockServer: MockR2Server | null = null;

// Export helper functions for tests
export async function startMockR2Server(port: number): Promise<number> {
  if (globalMockServer) {
    await globalMockServer.stop();
  }

  globalMockServer = new MockR2Server(port, "test-bucket");
  await globalMockServer.start();
  return port;
}

export async function stopMockR2Server(): Promise<void> {
  if (globalMockServer) {
    await globalMockServer.stop();
    globalMockServer = null;
  }
}

export function getMockR2Server(): MockR2Server | null {
  return globalMockServer;
}
