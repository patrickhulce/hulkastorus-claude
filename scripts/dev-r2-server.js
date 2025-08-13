#!/usr/bin/env node

const {createServer} = require("http");
const {parse} = require("url");
const {Buffer} = require("buffer");
const crypto = require("crypto");

/**
 * Development Mock R2 server for local development
 * Implements S3-compatible API endpoints used by the R2Client
 */
class DevMockR2Server {
  constructor(port = 9000, bucketName = "hulkastorus-dev") {
    this.port = port;
    this.bucketName = bucketName;
    this.objects = new Map();
    this.server = createServer(this.handleRequest.bind(this));
  }

  async start() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🚀 Mock R2 server running on http://localhost:${this.port}`);
        console.log(`📦 Bucket: ${this.bucketName}`);
        console.log("💾 File storage: In-memory (will reset on restart)");
        resolve();
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  handleRequest(req, res) {
    const parsedUrl = parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    // Add CORS headers for development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-amz-*");

    if (method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

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

  handlePutObject(req, res, objectKey) {
    if (!objectKey) {
      this.sendError(res, 400, "InvalidRequest", "Object key is required");
      return;
    }

    const chunks = [];
    const contentType = req.headers["content-type"] || "application/octet-stream";

    console.log(`📤 Uploading: ${objectKey} (${contentType})`);

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const data = Buffer.concat(chunks);
      const etag = crypto.createHash("md5").update(data).digest("hex");

      const object = {
        key: objectKey,
        data,
        contentType,
        size: data.length,
        lastModified: new Date(),
        etag: `"${etag}"`,
      };

      this.objects.set(objectKey, object);

      console.log(`✅ Uploaded: ${objectKey} (${data.length} bytes)`);

      res.writeHead(200, {
        "Content-Type": "application/xml",
        ETag: object.etag,
      });

      res.end(`<?xml version="1.0" encoding="UTF-8"?>
<PutObjectResult>
    <ETag>${object.etag}</ETag>
</PutObjectResult>`);
    });

    req.on("error", (error) => {
      console.error("Error reading request body:", error);
      this.sendError(res, 400, "BadRequest", "Error reading request body");
    });
  }

  handleGetObject(req, res, objectKey) {
    if (!objectKey) {
      this.sendError(res, 400, "InvalidRequest", "Object key is required");
      return;
    }

    const object = this.objects.get(objectKey);
    if (!object) {
      this.sendError(res, 404, "NoSuchKey", `Object ${objectKey} does not exist`);
      return;
    }

    console.log(`📥 Downloading: ${objectKey} (${object.size} bytes)`);

    res.writeHead(200, {
      "Content-Type": object.contentType,
      "Content-Length": object.size,
      "Last-Modified": object.lastModified.toUTCString(),
      ETag: object.etag,
    });

    res.end(object.data);
  }

  handleHeadObject(req, res, objectKey) {
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

  handleDeleteObject(req, res, objectKey) {
    if (!objectKey) {
      this.sendError(res, 400, "InvalidRequest", "Object key is required");
      return;
    }

    this.objects.delete(objectKey);
    console.log(`🗑️  Deleted: ${objectKey}`);

    res.writeHead(204);
    res.end();
  }

  sendError(res, statusCode, code, message) {
    res.writeHead(statusCode, {"Content-Type": "application/xml"});
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
    <Code>${code}</Code>
    <Message>${message}</Message>
</Error>`);
  }
}

const DEV_R2_PORT = 9000;
const DEV_BUCKET_NAME = "hulkastorus-dev";

async function startDevR2Server() {
  console.log("🚀 Starting development R2 mock server...");

  const server = new DevMockR2Server(DEV_R2_PORT, DEV_BUCKET_NAME);

  try {
    await server.start();
    console.log("💡 This server will handle all file uploads for local development");
    console.log("🔄 Server will restart automatically when files change");

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down mock R2 server...");
      await server.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Shutting down mock R2 server...");
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start mock R2 server:", error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  startDevR2Server();
}

module.exports = {DevMockR2Server, startDevR2Server, DEV_R2_PORT, DEV_BUCKET_NAME};
