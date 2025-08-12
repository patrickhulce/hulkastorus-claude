# Hulkastorus

Developer-focused cloud storage service that turns a drag-and-drop or single `curl` command into an immediately usable public URL.

This is a [Next.js](https://nextjs.org) project implementing the architecture defined in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Features

- **NextAuth Authentication** - JWT-based auth with protected routes
- **Cloudflare R2 Integration** - S3-compatible object storage with mock server for testing
- **Prisma ORM** - Type-safe database operations with PostgreSQL
- **Comprehensive Testing** - Unit tests, E2E tests with Playwright, and mock services

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use Neon)
- Cloudflare R2 account (optional for development)

### Environment Setup

1. Copy the environment template:

```bash
cp .env.example .env.local
```

2. Configure your environment variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/hulkastorus"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Cloudflare R2 (optional for development)
R2_ACCOUNT_ID="your-r2-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="hulkastorus-ugc"
```

### Development

1. Install dependencies:

```bash
pnpm install
```

2. Set up the database:

```bash
npx prisma migrate dev
```

3. Start the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3010](http://localhost:3010) to view the application.

## Testing

### Run All Tests

```bash
pnpm test
```

### Test Categories

```bash
# Unit tests only
pnpm run test:unit

# E2E tests with Playwright
npx playwright test

# R2 integration tests
npx playwright test tests/e2e/r2-integration.test.ts

# Lint and format
pnpm run test:lint
pnpm run test:format
```

### R2 Testing

The project includes a mock R2 server for testing S3-compatible operations without requiring actual Cloudflare R2 credentials. See [docs/R2_TESTING.md](./docs/R2_TESTING.md) for detailed testing instructions.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
