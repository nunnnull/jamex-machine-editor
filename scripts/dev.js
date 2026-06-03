import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const backendDir = path.join(ROOT, 'backend');

async function dev() {
  // Start backend
  console.log('Starting backend...');
  const backend = spawn('node', ['server.js'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, PORT: '3001' },
  });

  backend.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
    process.exit(code);
  });

  // Give backend a moment to start
  await new Promise((r) => setTimeout(r, 1500));

  // Launch Electron
  console.log('Starting Electron...');
  const electron = spawn(
    path.join(ROOT, 'node_modules', '.bin', 'electron'),
    [path.join(ROOT, 'electron', 'main.js'), '--dev'],
    { stdio: 'inherit', cwd: ROOT },
  );

  electron.on('exit', () => {
    backend.kill();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    backend.kill();
    electron.kill();
    process.exit(0);
  });
}

dev();
