import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const buildDir = path.join(rootDir, '.next');
const logDir = path.join(rootDir, 'logs');
const errorLogPath = path.join(logDir, 'error.log');

const port = process.env.PORT || '3002';
const host = process.env.HOSTNAME || '0.0.0.0';

const logError = (message, err) => {
  const timestamp = new Date().toISOString();
  const detail =
    err instanceof Error
      ? `${err.name}: ${err.message}\n${err.stack || ''}`
      : err
        ? String(err)
        : '';
  const line = `[${timestamp}] ${message}${detail ? `\n${detail}` : ''}\n\n`;

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(errorLogPath, line, 'utf-8');
  } catch {
    console.error('Failed to write to error.log', line);
  }
};

if (!fs.existsSync(nextBin)) {
  logError('Next.js binary not found. Run npm install in the project root.');
  console.error(`Missing Next.js binary at ${nextBin}`);
  process.exit(1);
}

if (!fs.existsSync(buildDir)) {
  logError('Production build not found. Run npm run build before starting the service.');
  console.error(`Missing build output at ${buildDir}`);
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  logError('uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  logError('unhandledRejection', reason);
});

const child = spawn(process.execPath, [nextBin, 'start', '-H', host, '-p', port], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    PORT: port,
    HOSTNAME: host,
  },
});

child.on('error', (err) => {
  logError('Failed to start Next.js process', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    logError(`Next.js process terminated by signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});

console.log(`Interview Coach starting on http://${host}:${port}`);
