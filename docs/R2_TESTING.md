# R2 Testing Guide

This document explains how to test Cloudflare R2 integration in Hulkastorus using the mock R2 server.

## Overview

Hulkastorus uses Cloudflare R2 for object storage following an S3-compatible API. For testing, we provide a mock R2 server that implements the essential S3 endpoints without requiring actual R2 credentials.

## Mock R2 Server

The mock R2 server is located at `tests/mocks/r2-server.ts` and provides:

- S3-compatible PUT, GET, HEAD, and DELETE operations
- Proper HTTP status codes and headers
- ETag generation and metadata handling
- In-memory storage for test isolation

### Bucket Layout

Following ARCHITECTURE.md, objects are stored with the key structure:

```
<env>/<lifecycle_policy>/<user_id>/<file_id>
```

Example keys:

- `production/infinite/user123/file456.pdf`
- `development/7d/user789/temp.jpg`
- `staging/30d/user101/model.ckpt`

## R2 Client

The R2 client (`src/lib/r2-client.ts`) provides:

### Methods

- `getUploadUrl()` - Generate presigned URL for uploading
- `getDownloadUrl()` - Generate presigned URL for downloading
- `getObjectInfo()` - Get object metadata
- `deleteObject()` - Delete an object
- `parseObjectKey()` - Parse object key components

### Configuration

Configure R2 via environment variables:

```bash
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="hulkastorus-ugc"
R2_ENDPOINT="http://localhost:9000"  # Optional, for testing
```

## Running Tests

### Unit Tests

```bash
# Run all R2-related unit tests
npm run test:unit -- tests/lib/r2-client.test.ts
npm run test:unit -- tests/lib/r2-config.test.ts
npm run test:unit -- tests/mocks/r2-server.test.ts
```

### E2E Tests

```bash
# Run R2 integration E2E tests
npx playwright test tests/e2e/r2-integration.test.ts
```

### Manual Testing

1. Start the mock R2 server:

```typescript
import {MockR2Server} from "./tests/mocks/r2-server";

const server = new MockR2Server(9000, "hulkastorus-ugc");
await server.start();
```

2. Configure R2 client to use mock server:

```typescript
import {R2Client} from "./src/lib/r2-client";

const client = new R2Client({
  accountId: "test-account",
  accessKeyId: "test-key",
  secretAccessKey: "test-secret",
  bucketName: "hulkastorus-ugc",
  endpoint: "http://localhost:9000",
});
```

3. Test upload/download cycle:

```typescript
// Get upload URL
const {uploadUrl, objectKey} = await client.getUploadUrl({
  env: "test",
  lifecyclePolicy: "30d",
  userId: "user123",
  fileId: "file456",
  contentType: "image/jpeg",
});

// Upload file
await fetch(uploadUrl, {
  method: "PUT",
  body: fileData,
  headers: {"Content-Type": "image/jpeg"},
});

// Get download URL
const downloadUrl = await client.getDownloadUrl({
  env: "test",
  lifecyclePolicy: "30d",
  userId: "user123",
  fileId: "file456",
});

// Download file
const response = await fetch(downloadUrl);
const downloadedData = await response.arrayBuffer();
```

## Test Scenarios

The test suite covers:

### Basic Operations

- Upload files with presigned URLs
- Download files with presigned URLs
- Get object metadata
- Delete objects

### Error Handling

- 404 for non-existent objects
- 404 for wrong bucket names
- 405 for unsupported HTTP methods
- 400 for malformed requests

### Concurrency

- Multiple simultaneous uploads
- Race conditions in object operations

### Bucket Layout Compliance

- Correct object key generation
- Parsing object keys back to components
- Support for all lifecycle policies

### Integration

- Full upload-download cycles
- Metadata consistency
- Binary data handling

## Lifecycle Policies

Supported lifecycle policies (from ARCHITECTURE.md):

- `infinite` - Never expires
- `180d` - 180 days
- `90d` - 90 days
- `30d` - 30 days
- `14d` - 14 days
- `7d` - 7 days
- `3d` - 3 days
- `2d` - 2 days
- `1d` - 1 day

## Troubleshooting

### Mock Server Issues

1. **Port conflicts**: Change the port in MockR2Server constructor
2. **Server won't start**: Check if port is already in use
3. **Tests fail**: Ensure `server.clear()` is called between tests

### R2 Client Issues

1. **Invalid signatures**: Check AWS SDK configuration
2. **Wrong endpoint**: Verify R2_ENDPOINT environment variable
3. **Bucket errors**: Ensure bucket name matches mock server configuration

### Common Patterns

```typescript
// Test setup pattern
let mockServer: MockR2Server;
let r2Client: R2Client;

beforeAll(async () => {
  mockServer = new MockR2Server(9001, "test-bucket");
  await mockServer.start();

  r2Client = new R2Client({
    accountId: "test",
    accessKeyId: "test",
    secretAccessKey: "test",
    bucketName: "test-bucket",
    endpoint: "http://localhost:9001",
  });
});

afterAll(async () => {
  await mockServer.stop();
});

beforeEach(() => {
  mockServer.clear();
});
```

This ensures clean test isolation and proper resource cleanup.
