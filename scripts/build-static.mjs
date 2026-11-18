import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const ROOT = process.cwd();
const OUT_DIRS = [
  path.join(ROOT, 'netlify-static'),
  path.join(ROOT, 'public')
];

async function ensureDirs() {
  for (const base of OUT_DIRS) {
    await fs.mkdir(path.join(base, 'css'), { recursive: true });
    await fs.mkdir(path.join(base, 'js'), { recursive: true });
    await fs.mkdir(path.join(base, 'data'), { recursive: true });
  }
}

function shortHash(bufOrStr) {
  return crypto.createHash('sha256').update(bufOrStr).digest('hex').slice(0, 8);
}

async function buildCss() {
  const srcDir = path.join(ROOT, 'css');
  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.css'));
  const hashes = {};
  let rawBytes = 0;
  let minBytes = 0;

  for (const file of files) {
    const raw = await fs.readFile(path.join(srcDir, file), 'utf8');
    rawBytes += Buffer.byteLength(raw);
    const result = await esbuild.transform(raw, {
      loader: 'css',
      minify: true,
      legalComments: 'none'
    });
    const outCode = result.code;
    minBytes += Buffer.byteLength(outCode);
    hashes[file] = shortHash(outCode);
    for (const base of OUT_DIRS) {
      await fs.writeFile(path.join(base, 'css', file), outCode, 'utf8');
    }
  }
  return { hashes, rawBytes, minBytes };
}

async function buildJs() {
  const srcDir = path.join(ROOT, 'js');
  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.js'));
  const hashes = {};
  let rawBytes = 0;
  let minBytes = 0;

  for (const file of files) {
    const raw = await fs.readFile(path.join(srcDir, file), 'utf8');
    rawBytes += Buffer.byteLength(raw);
    const result = await esbuild.transform(raw, {
      loader: 'js',
      minify: true,
      target: 'es2020',
      legalComments: 'none'
    });
    const outCode = result.code;
    minBytes += Buffer.byteLength(outCode);
    hashes[file] = shortHash(outCode);
    for (const base of OUT_DIRS) {
      await fs.writeFile(path.join(base, 'js', file), outCode, 'utf8');
    }
  }
  return { hashes, rawBytes, minBytes };
}

async function buildData() {
  const dataDir = path.join(ROOT, 'public', 'data');
  let rawBytes = 0;
  let minBytes = 0;
  try {
    const files = await fs.readdir(dataDir);
    for (const file of files) {
      const srcPath = path.join(dataDir, file);
      const stat = await fs.stat(srcPath);
      if (!stat.isFile()) continue;
      if (file.endsWith('.json')) {
        const raw = await fs.readFile(srcPath, 'utf8');
        rawBytes += Buffer.byteLength(raw);
        let compact = raw;
        try {
          compact = JSON.stringify(JSON.parse(raw));
        } catch {}
        minBytes += Buffer.byteLength(compact);
        await fs.writeFile(path.join(ROOT, 'netlify-static', 'data', file), compact, 'utf8');
      } else {
        await fs.copyFile(srcPath, path.join(ROOT, 'netlify-static', 'data', file));
      }
    }
  } catch {}
  return { rawBytes, minBytes };
}

function minifyHtmlSafe(html) {
  // Collapse inter-tag whitespace & strip HTML comments outside <script>/<style> blocks
  const preserved = [];
  const tokenPrefix = '___AUTUMN_PRESERVE_';
  let masked = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const idx = preserved.length;
    preserved.push(match);
    return `${tokenPrefix}${idx}___`;
  });

  masked = masked
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\n[ \t]+/g, '\n')
    .trim();

  return masked.replace(new RegExp(`${tokenPrefix}(\\d+)___`, 'g'), (_, i) => preserved[Number(i)]);
}

async function buildHtmlAndHeaders(cssHashes, jsHashes) {
  let html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const rawBytes = Buffer.byteLength(html);

  for (const [file, hash] of Object.entries(cssHashes)) {
    html = html.replaceAll(`./css/${file}`, `./css/${file}?v=${hash}`);
  }
  for (const [file, hash] of Object.entries(jsHashes)) {
    html = html.replaceAll(`./js/${file}`, `./js/${file}?v=${hash}`);
  }

  // Minify inline <script> blocks in <head> with esbuild safely
  const scriptMatches = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  for (const m of scriptMatches) {
    const full = m[0];
    const body = m[1];
    if (!body || !body.trim()) continue;
    try {
      const res = await esbuild.transform(body, { loader: 'js', minify: true, target: 'es2020' });
      const openTag = full.slice(0, full.indexOf('>') + 1);
      html = html.replace(full, `${openTag}${res.code.trim()}</script>`);
    } catch {}
  }

  const outHtml = minifyHtmlSafe(html);
  const minBytes = Buffer.byteLength(outHtml);
  await fs.writeFile(path.join(ROOT, 'netlify-static', 'index.html'), outHtml, 'utf8');

  const headersContent = `/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(self), camera=(), microphone=()

/
  Cache-Control: public, max-age=0, must-revalidate

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/css/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable

/data/*.json
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
`;
  await fs.writeFile(path.join(ROOT, 'netlify-static', '_headers'), headersContent, 'utf8');

  const staticNetlifyToml = `[build]
  publish = "."
  command = "echo 'Static multi-file minified build ready (index.html, css/, js/, data/)'"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(self), camera=(), microphone=()"

[[headers]]
  for = "/"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/css/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/js/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/data/*.json"
  [headers.values]
    Cache-Control = "public, max-age=86400, stale-while-revalidate=604800"
`;
  await fs.writeFile(path.join(ROOT, 'netlify-static', 'netlify.toml'), staticNetlifyToml, 'utf8');

  return { rawBytes, minBytes };
}

async function main() {
  await ensureDirs();
  const cssStats = await buildCss();
  const jsStats = await buildJs();
  const dataStats = await buildData();
  const htmlStats = await buildHtmlAndHeaders(cssStats.hashes, jsStats.hashes);

  const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log('[build-static] CSS :', fmt(cssStats.rawBytes), '->', fmt(cssStats.minBytes));
  console.log('[build-static] JS  :', fmt(jsStats.rawBytes), '->', fmt(jsStats.minBytes));
  console.log('[build-static] JSON:', fmt(dataStats.rawBytes), '->', fmt(dataStats.minBytes));
  console.log('[build-static] HTML:', fmt(htmlStats.rawBytes), '->', fmt(htmlStats.minBytes));
}

main().catch((err) => {
  console.error('[build-static] failed:', err);
  process.exit(1);
});
