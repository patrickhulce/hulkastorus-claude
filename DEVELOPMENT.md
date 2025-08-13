# Development Guide

## Local Development with Mock R2 Storage

For local development, you can use a mock R2 server instead of connecting to real Cloudflare R2. This allows you to test file uploads without needing R2 credentials.

### Quick Start

```bash
# Start both Next.js and mock R2 server together
npm run dev:with-r2
```

This command will:

- ✅ Start the mock R2 server on `http://localhost:9000`
- ✅ Start Next.js development server on `http://localhost:3000`
- ✅ Configure environment variables automatically
- ✅ Show colored logs for both services
- ✅ Handle graceful shutdown with Ctrl+C

### Available Development Commands

```bash
# Standard Next.js development (requires real R2 credentials)
npm run dev

# Development with mock R2 server (recommended for local development)
npm run dev:with-r2

# Start only the mock R2 server
npm run dev:r2-only
```

### Mock R2 Server Features

- **S3-Compatible API**: Fully compatible with AWS S3/Cloudflare R2 SDK
- **In-Memory Storage**: Files are stored in memory (resets on restart)
- **CORS Enabled**: Works with browser uploads
- **Development Logging**: See all upload/download operations
- **Auto-Restart**: Restarts when code changes (with nodemon)

### Environment Configuration

When using `npm run dev:with-r2`, these environment variables are automatically set:

```bash
R2_ENDPOINT=http://localhost:9000
R2_ACCOUNT_ID=hulkastorus-dev
R2_ACCESS_KEY_ID=dev-access-key
R2_SECRET_ACCESS_KEY=dev-secret-key
R2_BUCKET_NAME=hulkastorus-dev
```

### File Upload Testing

1. Start the development environment:

   ```bash
   npm run dev:with-r2
   ```

2. Navigate to `http://localhost:3000/app/dashboard`

3. Upload files using:
   - Drag & drop onto the upload area
   - Click the upload area to browse files
   - Use the "Upload File" button

4. Files will be stored in the mock R2 server and displayed in the dashboard

### Logs and Debugging

The development setup provides colored logs for easy debugging:

- **🔵 [R2]**: Mock R2 server logs (uploads, downloads, errors)
- **🟢 [NEXT]**: Next.js development server logs
- **🔵 [DEV]**: General development environment status

### Production vs Development

| Feature       | Development (Mock R2) | Production (Real R2)     |
| ------------- | --------------------- | ------------------------ |
| Storage       | In-memory (temporary) | Persistent cloud storage |
| Configuration | Automatic             | Requires R2 credentials  |
| File Access   | Local only            | Global CDN               |
| Cost          | Free                  | Pay per usage            |
| Setup         | Zero configuration    | Requires R2 account      |

### Switching to Production

To use real Cloudflare R2 in development:

1. Create a `.env.local` file with your R2 credentials:

   ```bash
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=your-bucket-name
   ```

2. Use the standard development command:
   ```bash
   npm run dev
   ```

### Troubleshooting

**Mock R2 server fails to start:**

- Check if port 9000 is available
- Ensure Node.js and ts-node are installed
- Try starting only the R2 server: `npm run dev:r2-only`

**File uploads fail:**

- Check that both servers are running
- Verify the R2 endpoint in browser dev tools
- Check console logs for CORS or network errors

**TypeScript errors:**

- Run `npm run test:typecheck` to check for issues
- Ensure ts-node is installed: `npm install -D ts-node`

### Testing

The test suite uses its own mock R2 servers on different ports:

```bash
# Run all tests (includes file upload tests)
npm test

# Run only unit tests
npm run test:unit
```

Test files automatically start their own mock R2 servers on ports 9004-9008 to avoid conflicts with the development server.
