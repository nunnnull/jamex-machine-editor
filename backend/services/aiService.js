import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

export async function callPythonService(imagePath, mode = 'blur', blurStrength = 'medium', blurType = 'gaussian') {
  if (!AI_SERVICE_URL) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  const imageBuffer = await fs.readFile(imagePath);
  const filename = path.basename(imagePath);

  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;
  const body = buildMultipartBody(imageBuffer, filename, boundary);

  const base = AI_SERVICE_URL.endsWith('/remove-bg')
    ? AI_SERVICE_URL
    : `${AI_SERVICE_URL.replace(/\/+$/, '')}/remove-bg`;
  const url = `${base}?mode=${mode}&model=rmbg2&blur_strength=${blurStrength}&blur_type=${blurType}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI service returned ${response.status}: ${errorText}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

export async function callRemoveBg(imagePath, apiKey) {
  const key = apiKey || REMOVE_BG_API_KEY;
  if (!key) {
    throw new Error('remove.bg API key is not configured');
  }

  const imageBuffer = await fs.readFile(imagePath);

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': key,
    },
    body: buildRemoveBgForm(imageBuffer, path.basename(imagePath)),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`remove.bg API returned ${response.status}: ${errorText}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

function buildMultipartFormData(imageBuffer, filename, boundary) {
  return buildMultipartBody(imageBuffer, filename, boundary);
}

function buildMultipartBody(buffer, filename, boundary, fieldName = 'file') {
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const headerBuf = Buffer.from(header, 'utf-8');
  const footerBuf = Buffer.from(footer, 'utf-8');
  return Buffer.concat([headerBuf, buffer, footerBuf]);
}

function buildRemoveBgForm(buffer, filename) {
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;
  return buildMultipartBody(buffer, filename, boundary, 'image_file');
}
