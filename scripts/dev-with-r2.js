#!/usr/bin/env node

const { spawn } = require('child_process');
const { join } = require('path');

// ANSI color codes for better logging
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

async function startDevServers() {
  log(colors.cyan, 'DEV', '🚀 Starting development environment with mock R2 server...');
  
  // Start mock R2 server
  log(colors.blue, 'R2', '📦 Starting mock R2 server...');
  const r2Server = spawn('node', ['scripts/dev-r2-server.js'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  // Start Next.js dev server with development environment
  log(colors.green, 'NEXT', '⚡ Starting Next.js development server...');
  const nextServer = spawn('next', ['dev'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { 
      ...process.env, 
      NODE_ENV: 'development',
      // Load development environment variables
      R2_ENDPOINT: 'http://localhost:9000',
      R2_ACCOUNT_ID: 'hulkastorus-dev',
      R2_ACCESS_KEY_ID: 'dev-access-key',
      R2_SECRET_ACCESS_KEY: 'dev-secret-key',
      R2_BUCKET_NAME: 'hulkastorus-dev'
    }
  });

  // Handle R2 server output
  r2Server.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      log(colors.blue, 'R2', message);
    }
  });

  r2Server.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      log(colors.red, 'R2', message);
    }
  });

  // Handle Next.js server output
  nextServer.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      log(colors.green, 'NEXT', message);
    }
  });

  nextServer.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      log(colors.yellow, 'NEXT', message);
    }
  });

  // Handle process exits
  r2Server.on('exit', (code) => {
    if (code !== 0) {
      log(colors.red, 'R2', `❌ Mock R2 server exited with code ${code}`);
    }
  });

  nextServer.on('exit', (code) => {
    if (code !== 0) {
      log(colors.red, 'NEXT', `❌ Next.js server exited with code ${code}`);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log(colors.cyan, 'DEV', '🛑 Shutting down development servers...');
    r2Server.kill('SIGTERM');
    nextServer.kill('SIGTERM');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log(colors.cyan, 'DEV', '🛑 Shutting down development servers...');
    r2Server.kill('SIGTERM');
    nextServer.kill('SIGTERM');
    process.exit(0);
  });

  // Wait a moment for servers to start, then show status
  setTimeout(() => {
    log(colors.cyan, 'DEV', '✅ Development environment ready!');
    log(colors.cyan, 'DEV', '');
    log(colors.cyan, 'DEV', '📋 Services:');
    log(colors.cyan, 'DEV', '   • Next.js: http://localhost:3000');
    log(colors.cyan, 'DEV', '   • Mock R2: http://localhost:9000');
    log(colors.cyan, 'DEV', '');
    log(colors.cyan, 'DEV', '💡 File uploads will be stored in memory');
    log(colors.cyan, 'DEV', '🔄 Both servers will auto-reload on changes');
    log(colors.cyan, 'DEV', '');
  }, 3000);
}

// Only run if this file is executed directly
if (require.main === module) {
  startDevServers().catch((error) => {
    log(colors.red, 'DEV', `❌ Failed to start development servers: ${error.message}`);
    process.exit(1);
  });
}