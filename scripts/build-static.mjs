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
    await fs.mkdir(path.join(base, 'fragments'), { recursive: true });
    await fs.mkdir(path.join(base, 'data'), { recursive: true });
  }
}

function shortHash(bufOrStr) {
  return crypto.createHash('sha256').update(bufOrStr).digest('hex').slice(0, 8);
}

function collectTokensFromText(text) {
  const tokens = new Set();
  const re = /[^\s"'`<>{}()=;]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.add(m[0]);
  }
  return tokens;
}

// Balanced-brace CSS parser (handles @media, @supports, @layer, @keyframes, rules)
function parseCssBlocks(cssText) {
  const nodes = [];
  let i = 0;
  const len = cssText.length;

  function skipWsAndComments() {
    while (i < len) {
      if (/\s/.test(cssText[i])) {
        i++;
      } else if (cssText[i] === '/' && cssText[i + 1] === '*') {
        const end = cssText.indexOf('*/', i + 2);
        i = end === -1 ? len : end + 2;
      } else {
        break;
      }
    }
  }

  while (i < len) {
    skipWsAndComments();
    if (i >= len) break;

    const start = i;
    let inStr = null;
    while (i < len) {
      const ch = cssText[i];
      if (inStr) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === inStr) inStr = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inStr = ch;
        i++;
        continue;
      }
      if (ch === '/' && cssText[i + 1] === '*') {
        const end = cssText.indexOf('*/', i + 2);
        i = end === -1 ? len : end + 2;
        continue;
      }
      if (ch === '{' || ch === ';') break;
      i++;
    }

    if (i >= len) {
      const tail = cssText.slice(start).trim();
      if (tail) nodes.push({ type: 'raw', text: tail });
      break;
    }

    if (cssText[i] === ';') {
      const stmt = cssText.slice(start, i + 1).trim();
      if (stmt) nodes.push({ type: 'raw', text: stmt });
      i++;
      continue;
    }

    // Found '{'
    const header = cssText.slice(start, i).trim();
    i++; // consume '{'
    const bodyStart = i;
    let depth = 1;
    inStr = null;
    while (i < len && depth > 0) {
      const ch = cssText[i];
      if (inStr) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === inStr) inStr = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inStr = ch;
        i++;
        continue;
      }
      if (ch === '/' && cssText[i + 1] === '*') {
        const end = cssText.indexOf('*/', i + 2);
        i = end === -1 ? len : end + 2;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const body = cssText.slice(bodyStart, Math.max(bodyStart, i - 1));
    nodes.push({ type: 'block', header, body });
  }
  return nodes;
}

// Split comma-separated selectors respecting brackets/parens/quotes
function splitSelectors(selStr) {
  const out = [];
  let cur = '';
  let paren = 0;
  let bracket = 0;
  let inStr = null;
  for (let i = 0; i < selStr.length; i++) {
    const ch = selStr[i];
    if (inStr) {
      cur += ch;
      if (ch === '\\' && i + 1 < selStr.length) { cur += selStr[++i]; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; cur += ch; continue; }
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === ',' && paren === 0 && bracket === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function unescapeCssIdent(s) {
  return s.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_, esc) => {
    if (/^[0-9a-fA-F]+\s?$/.test(esc)) {
      return String.fromCodePoint(parseInt(esc.trim(), 16));
    }
    return esc;
  });
}

// Extract utility class names from a CSS selector like `.hover\:bg-\[\#eff8f2\]:hover`
function extractSelectorClasses(singleSel) {
  // Remove attribute selectors `[...]` and `:is(...)`/`:where(...)`? No, keep `.class` outside `[...]`
  const classes = [];
  let i = 0;
  let bracket = 0;
  while (i < singleSel.length) {
    const ch = singleSel[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '[') { bracket++; i++; continue; }
    if (ch === ']') { bracket = Math.max(0, bracket - 1); i++; continue; }
    if (ch === '.' && bracket === 0) {
      i++;
      let raw = '';
      while (i < singleSel.length) {
        const c = singleSel[i];
        if (c === '\\' && i + 1 < singleSel.length) {
          raw += c + singleSel[i + 1];
          i += 2;
          continue;
        }
        if (/[\s>+~:,.\[#)]/.test(c)) break;
        raw += c;
        i++;
      }
      if (raw) classes.push(unescapeCssIdent(raw));
      continue;
    }
    i++;
  }
  return classes;
}

function classifyTailwindCss(tailwindCss, criticalTokens, allTokens) {
  let keptCriticalRules = 0;
  let keptDeferredRules = 0;
  let prunedRules = 0;

  function processNodes(nodes) {
    const critParts = [];
    const defParts = [];

    for (const node of nodes) {
      if (node.type === 'raw') {
        critParts.push(node.text);
        continue;
      }
      const hdr = node.header;
      if (/^@keyframes\b|^@-webkit-keyframes\b|^@font-face\b/i.test(hdr)) {
        critParts.push(`${hdr}{${node.body}}`);
        keptCriticalRules++;
        continue;
      }
      if (/^@media\b|^@supports\b|^@layer\b/i.test(hdr)) {
        const inner = processNodes(parseCssBlocks(node.body));
        if (inner.crit.length) critParts.push(`${hdr}{${inner.crit.join('')}}`);
        if (inner.def.length) defParts.push(`${hdr}{${inner.def.join('')}}`);
        continue;
      }
      // Normal style rule: classify per comma-separated selector
      const sels = splitSelectors(hdr);
      const critSels = [];
      const defSels = [];
      for (const sel of sels) {
        const clsList = extractSelectorClasses(sel);
        if (clsList.length === 0) {
          critSels.push(sel);
          continue;
        }
        // Keep selector if all extracted classes appear in token set (typically 1 Tailwind class, or group/peer + child)
        const inCrit = clsList.every((c) => criticalTokens.has(c));
        if (inCrit) {
          critSels.push(sel);
        } else {
          const inAll = clsList.every((c) => allTokens.has(c));
          if (inAll) {
            defSels.push(sel);
          } else {
            prunedRules++;
          }
        }
      }
      if (critSels.length) {
        critParts.push(`${critSels.join(',')}{${node.body}}`);
        keptCriticalRules++;
      }
      if (defSels.length) {
        defParts.push(`${defSels.join(',')}{${node.body}}`);
        keptDeferredRules++;
      }
    }
    return { crit: critParts, def: defParts };
  }

  const parsed = parseCssBlocks(tailwindCss);
  const res = processNodes(parsed);
  return {
    criticalTw: res.crit.join(''),
    deferredTw: res.def.join(''),
    keptCriticalRules,
    keptDeferredRules,
    prunedRules
  };
}

// Split hand-authored rules: route pure Rich-Text Editor (.rte-*) & Running table (.running-*) rules to deferred
function splitCustomCss(customCss) {
  const nodes = parseCssBlocks(customCss);
  const crit = [];
  const def = [];
  for (const node of nodes) {
    if (node.type === 'raw') {
      crit.push(node.text);
      continue;
    }
    const hdr = node.header;
    const isDeferredOnly = /^\.(rte-|rich-editor|running-|runner-)/i.test(hdr) &&
      !hdr.includes(':root') && !hdr.includes('data-theme');
    if (isDeferredOnly) {
      def.push(`${hdr}{${node.body}}`);
    } else {
      crit.push(`${hdr}{${node.body}}`);
    }
  }
  return { criticalCustom: crit.join('\n'), deferredCustom: def.join('\n') };
}

async function gatherTokenSets() {
  const indexHtml = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const fragFiles = (await fs.readdir(path.join(ROOT, 'fragments'))).filter((f) => f.endsWith('.html'));
  const jsFiles = (await fs.readdir(path.join(ROOT, 'js'))).filter((f) => f.endsWith('.js'));

  const criticalChunks = [indexHtml];
  const allChunks = [indexHtml];

  for (const f of fragFiles) {
    allChunks.push(await fs.readFile(path.join(ROOT, 'fragments', f), 'utf8'));
  }
  const criticalJsSet = new Set(['app.js', 'charts-svg.js', 'um-atlas.js', 'analytics-matrix.js']);
  for (const f of jsFiles) {
    const content = await fs.readFile(path.join(ROOT, 'js', f), 'utf8');
    allChunks.push(content);
    if (criticalJsSet.has(f)) criticalChunks.push(content);
  }

  return {
    criticalTokens: collectTokensFromText(criticalChunks.join('\n')),
    allTokens: collectTokensFromText(allChunks.join('\n'))
  };
}

async function buildCss(tokenSets) {
  const srcDir = path.join(ROOT, 'css');
  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.css'));
  const hashes = {};
  let rawBytes = 0;
  let minBytes = 0;

  // Keep standard minified CSS in public/css/ (for Vite dev/dist fallback)
  let baseRaw = '';
  let m3Raw = '';
  for (const file of files) {
    const raw = await fs.readFile(path.join(srcDir, file), 'utf8');
    rawBytes += Buffer.byteLength(raw);
    if (file === 'autumn-base.css') baseRaw = raw;
    if (file === 'autumn-m3-sharp.css') m3Raw = raw;
    const result = await esbuild.transform(raw, {
      loader: 'css',
      minify: true,
      legalComments: 'none'
    });
    const outCode = result.code;
    hashes[file] = shortHash(outCode);
    await fs.writeFile(path.join(ROOT, 'public', 'css', file), outCode, 'utf8');
  }

  // Split autumn-base.css into custom CSS + precompiled Tailwind
  const twMarker = '/* Precompiled Tailwind v3.4.17 */';
  const markerIdx = baseRaw.indexOf(twMarker);
  const baseCustom = markerIdx >= 0 ? baseRaw.slice(0, markerIdx) : baseRaw;
  const twRaw = markerIdx >= 0 ? baseRaw.slice(markerIdx + twMarker.length) : '';

  const twSplit = classifyTailwindCss(twRaw, tokenSets.criticalTokens, tokenSets.allTokens);
  const customSplit = splitCustomCss(baseCustom + '\n' + m3Raw);

  const criticalMinRes = await esbuild.transform(
    `${customSplit.criticalCustom}\n${twSplit.criticalTw}`,
    { loader: 'css', minify: true, legalComments: 'none' }
  );
  const deferredMinRes = await esbuild.transform(
    `${customSplit.deferredCustom}\n${twSplit.deferredTw}`,
    { loader: 'css', minify: true, legalComments: 'none' }
  );

  const criticalCss = criticalMinRes.code.trim();
  const deferredCss = deferredMinRes.code.trim();
  const deferredHash = shortHash(deferredCss);

  for (const base of OUT_DIRS) {
    await fs.writeFile(path.join(base, 'css', 'autumn-deferred.css'), deferredCss, 'utf8');
  }

  minBytes = Buffer.byteLength(criticalCss) + Buffer.byteLength(deferredCss);
  return {
    hashes,
    rawBytes,
    minBytes,
    criticalCss,
    deferredHash,
    deferredBytes: Buffer.byteLength(deferredCss),
    criticalBytes: Buffer.byteLength(criticalCss),
    twStats: {
      keptCritical: twSplit.keptCriticalRules,
      keptDeferred: twSplit.keptDeferredRules,
      pruned: twSplit.prunedRules
    }
  };
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

function minifyHtmlSafe(html) {
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

async function buildFragments() {
  const srcDir = path.join(ROOT, 'fragments');
  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.html'));
  const hashes = {};
  let rawBytes = 0;
  let minBytes = 0;

  for (const file of files) {
    const raw = await fs.readFile(path.join(srcDir, file), 'utf8');
    rawBytes += Buffer.byteLength(raw);
    const min = minifyHtmlSafe(raw);
    minBytes += Buffer.byteLength(min);
    hashes[file] = shortHash(min);
    for (const base of OUT_DIRS) {
      await fs.writeFile(path.join(base, 'fragments', file), min, 'utf8');
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

async function buildHtmlAndHeaders(cssInfo, jsHashes, fragHashes) {
  let html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const rawBytes = Buffer.byteLength(html);

  // Build versioned asset manifest for lazy fragments & modules
  const assetsMap = {};
  for (const [file, hash] of Object.entries(fragHashes)) {
    assetsMap[`./fragments/${file}`] = `./fragments/${file}?v=${hash}`;
  }
  for (const [file, hash] of Object.entries(jsHashes)) {
    assetsMap[`./js/${file}`] = `./js/${file}?v=${hash}`;
  }
  const assetsScript = `<script>window.__autumnAssets=${JSON.stringify(assetsMap)};</script>`;

  // Replace blocking base + m3 CSS links with inlined Critical CSS + async non-blocking Deferred CSS
  const cssLinkRegex = /\s*<link\s+rel="stylesheet"\s+href="\.\/css\/autumn-base\.css">\s*<link\s+rel="stylesheet"\s+href="\.\/css\/autumn-m3-sharp\.css">/i;
  const criticalAndDeferredBlock = `\n  <style id="autumn-critical-css">${cssInfo.criticalCss}</style>` +
    `\n  <link rel="preload" as="style" href="./css/autumn-deferred.css?v=${cssInfo.deferredHash}" onload="this.onload=null;this.rel='stylesheet'">` +
    `\n  <noscript><link rel="stylesheet" href="./css/autumn-deferred.css?v=${cssInfo.deferredHash}"></noscript>` +
    `\n  ${assetsScript}`;

  if (cssLinkRegex.test(html)) {
    html = html.replace(cssLinkRegex, criticalAndDeferredBlock);
  } else {
    html = html.replace('</head>', `${criticalAndDeferredBlock}\n</head>`);
  }

  for (const [file, hash] of Object.entries(jsHashes)) {
    html = html.replaceAll(`./js/${file}`, `./js/${file}?v=${hash}`);
  }

  // Minify inline <script> blocks in <head> with esbuild safely (skip empty src scripts)
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

/fragments/*
  Cache-Control: public, max-age=31536000, immutable

/data/*.json
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
`;
  await fs.writeFile(path.join(ROOT, 'netlify-static', '_headers'), headersContent, 'utf8');

  const staticNetlifyToml = `[build]
  publish = "."
  command = "echo 'Static multi-file minified build ready (index.html, css/, js/, fragments/, data/)'"

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
  for = "/fragments/*"
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
  const tokenSets = await gatherTokenSets();
  const cssInfo = await buildCss(tokenSets);
  const jsStats = await buildJs();
  const fragStats = await buildFragments();
  const dataStats = await buildData();
  const htmlStats = await buildHtmlAndHeaders(cssInfo, jsStats.hashes, fragStats.hashes);

  const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log('[build-static] CSS  :', fmt(cssInfo.rawBytes), '->', fmt(cssInfo.minBytes),
    `(critical inlined: ${fmt(cssInfo.criticalBytes)}, deferred: ${fmt(cssInfo.deferredBytes)}, TW rules crit/def/pruned: ${cssInfo.twStats.keptCritical}/${cssInfo.twStats.keptDeferred}/${cssInfo.twStats.pruned})`);
  console.log('[build-static] JS   :', fmt(jsStats.rawBytes), '->', fmt(jsStats.minBytes));
  console.log('[build-static] FRAGS:', fmt(fragStats.rawBytes), '->', fmt(fragStats.minBytes));
  console.log('[build-static] JSON :', fmt(dataStats.rawBytes), '->', fmt(dataStats.minBytes));
  console.log('[build-static] HTML :', fmt(htmlStats.rawBytes), '->', fmt(htmlStats.minBytes));
}

main().catch((err) => {
  console.error('[build-static] failed:', err);
  process.exit(1);
});
