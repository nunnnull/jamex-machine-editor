import { app, BrowserWindow, dialog, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let mainWindow = null;
let aiProcess = null;

function getStorageDir() {
  const userData = app.getPath('userData');
  return path.join(userData, 'storage');
}

function getPythonAiPath() {
  const appPath = isDev
    ? path.join(__dirname, '..')
    : process.resourcesPath;
  return path.join(appPath, 'jamex-ai.exe');
}

async function startPythonAi() {
  const aiPath = getPythonAiPath();
  try {
    await fs.access(aiPath);
  } catch {
    return;
  }

  const storageDir = getStorageDir();
  aiProcess = spawn(aiPath, [], {
    env: { ...process.env, STORAGE_DIR: storageDir },
    stdio: 'pipe',
  });

  aiProcess.stdout.on('data', (d) => console.log(`[AI] ${d}`));
  aiProcess.stderr.on('data', (d) => console.error(`[AI] ${d}`));
  aiProcess.on('exit', (code) => {
    console.log(`[AI] exited with code ${code}`);
    aiProcess = null;
  });

  console.log('[AI] Python AI sidecar started');
}

async function startBackend() {
  const storageDir = getStorageDir();
  process.env.UPLOAD_DIR = storageDir;
  process.env.PORT = '3001';

  if (!process.env.AI_SERVICE_URL) {
    process.env.AI_SERVICE_URL = 'http://localhost:8000';
  }

  // Import backend — it calls app.listen() at module scope
  await import('../backend/server.js');

  // Wait until the server is actually listening
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch('http://localhost:3001/api/health');
      if (resp.ok) {
        console.log('[backend] Server is ready');
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn('[backend] Server may not be ready — proceeding anyway');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Jamex - Machinery Background Remover',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'logo.png'),
  });

  mainWindow.loadURL('http://localhost:3001');

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startPythonAi();
  await startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (aiProcess) {
    aiProcess.kill();
    aiProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (aiProcess) {
    aiProcess.kill();
    aiProcess = null;
  }
});
