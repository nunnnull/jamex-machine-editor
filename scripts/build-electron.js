import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

async function build() {
  console.log('=== Jamex Electron Build ===\n');

  // Step 1: Build frontend
  console.log('--- Building frontend ---');
  run('npm run build', { cwd: path.join(ROOT, 'frontend') });

  // Step 2: Copy frontend dist to backend/dist/
  const frontendDist = path.join(ROOT, 'frontend', 'dist');
  const backendDist = path.join(ROOT, 'backend', 'dist');

  if (existsSync(backendDist)) {
    rmSync(backendDist, { recursive: true });
  }
  mkdirSync(backendDist, { recursive: true });
  cpSync(frontendDist, backendDist, { recursive: true });
  console.log('  Copied frontend dist -> backend/dist/');

  // Step 3: Run electron-builder
  console.log('\n--- Packaging Electron app ---');
  const args = process.argv.slice(2).join(' ');
  run(`npx electron-builder ${args}`);

  console.log('\n=== Build complete ===');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
