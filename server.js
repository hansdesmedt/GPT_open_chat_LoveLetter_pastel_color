// Zero-dependency Node server (Node 22+ required)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.trellis.inthepocket.net/').replace(/\/?$/, '/');
const CHATITP_API_KEY = process.env.CHATITP_API_KEY || process.env.OPENAI_API_KEY || '';

const mime = {
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
};

function pastelFromString(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const comp = (hue + 180) % 360;
  return { fg: `hsl(${hue} 45% 30%)`, bg: `hsl(${comp} 85% 92%)` };
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeout || 15000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(to);
  }
}

function extractNextDataMessages(html) {
  try {
    const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!m) return null;
    const json = JSON.parse(m[1]);
    const found = [];
    function visit(node) {
      if (!node) return;
      if (Array.isArray(node)) {
        if (
          node.length > 0 &&
          node.every((x) => x && typeof x === 'object' && 'role' in x && ('content' in x || 'parts' in x || 'message' in x))
        ) {
          found.push(node);
        }
        node.forEach(visit);
      } else if (typeof node === 'object') {
        for (const k of Object.keys(node)) visit(node[k]);
      }
    }
    visit(json);
    if (found.length === 0) return null;
    const messages = found.sort((a, b) => b.length - a.length)[0];
    return messages;
  } catch {
    return null;
  }
}

function renderMessagesHTML(messages, colors, originalUrl) {
  const { fg, bg } = colors;
  const items = messages
    .map((m) => {
      const role = escapeHtml(String(m.role || 'assistant'));
      let text = '';
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) text = m.content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n');
      else if (Array.isArray(m.parts)) text = m.parts.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n');
      else if (m.message && typeof m.message === 'string') text = m.message;
      const safe = escapeHtml(String(text || '')).replaceAll('\n', '<br>');
      return `<section class="msg ${role}"><header>${role}</header><div class="body">${safe}</div></section>`;
    })
    .join('\n');
  return `<!doctype html>
  <html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Love Letter — Pastel</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/style.css">
    <style>
      :root{--love-fg:${fg};--love-bg:${bg}}
      html,body{background:var(--love-bg)!important;color:var(--love-fg)!important}
      a{color: color-mix(in oklab, var(--love-fg) 70%, black)}
      .wrap{max-width:860px;margin:6vh auto;padding:20px}
      .banner{position:sticky;top:0;padding:10px 14px;background:var(--love-bg);border-bottom:1px solid rgba(0,0,0,0.06);z-index:9999}
      .ll{display:flex;flex-direction:column;gap:16px}
      .msg{background:transparent;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:12px 14px}
      .msg header{font-weight:700;opacity:.8;margin-bottom:6px}
    </style>
  </head>
  <body>
    <div class="banner"><strong>Love Letter:</strong> Pastelweergave — <a href="/">nieuwe link</a> — <a href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">origineel</a></div>
    <main class="wrap">
      <h1>Love Letter</h1>
      <div class="ll">${items}</div>
    </main>
  </body>
  </html>`;
}

function fallbackTextFromHtml(html) {
  try {
    // crude text extraction: keep contents of p/li/pre/h headings
    const blocks = [];
    const patterns = ['p', 'li', 'pre', 'blockquote', 'h1', 'h2', 'h3'];
    for (const tag of patterns) {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      let m;
      while ((m = re.exec(html))) {
        const txt = m[1].replace(/<[^>]+>/g, '').replace(/[\u00A0\t]+/g, ' ').trim();
        if (txt) blocks.push({ tag, txt });
      }
    }
    return blocks;
  } catch {
    return [];
  }
}

function renderFallbackHTML(blocks, colors, originalUrl) {
  const { fg, bg } = colors;
  const body = blocks.map((b) => `<section class="blk ${b.tag}">${escapeHtml(b.txt)}</section>`).join('\n');
  return `<!doctype html>
  <html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Love Letter — Fallback</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/style.css">
    <style>
      :root{--love-fg:${fg};--love-bg:${bg}}
      html,body{background:var(--love-bg)!important;color:var(--love-fg)!important}
      .wrap{max-width:860px;margin:6vh auto;padding:20px}
      .blk{padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;margin:8px 0;background:transparent}
      .banner{position:sticky;top:0;padding:10px 14px;background:var(--love-bg);border-bottom:1px solid rgba(0,0,0,0.06);z-index:9999}
    </style>
  </head>
  <body>
    <div class="banner"><strong>Love Letter:</strong> Minimale weergave — <a href="/">nieuwe link</a> — <a href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">origineel</a></div>
    <main class="wrap">
      <h1>Love Letter</h1>
      ${body || '<p>Kon de inhoud niet automatisch structureren.</p>'}
    </main>
  </body>
  </html>`;
}

async function llmExtractMessagesFromHtml(html, model = 'gpt-4o-mini') {
  if (!CHATITP_API_KEY) return null;
  try {
    const endpoint = new URL('v1/chat/completions', OPENAI_BASE_URL).toString();
    const sys = `Je krijgt HTML van een gedeelde GPT conversatie. Extraheer een JSON array van berichten in volgorde.
Returneer ALLEEN JSON met het schema: [{"role":"user|assistant","content":"tekst"}, ...].`;
    const user = `HTML START\n${html.slice(0, 150000)}\nHTML END`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${CHATITP_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // maybe it's a plain array string
      if (content.trim().startsWith('[')) parsed = JSON.parse(content);
    }
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sendCsp(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' data:; script-src 'none'; connect-src 'self'; img-src * data:; style-src 'self' 'unsafe-inline'; font-src * data:; frame-src 'none'; object-src 'none'; base-uri 'self';"
  );
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function indexHtml() {
  return `<!doctype html>
  <html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Love Letter — GPT Chat</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/style.css">
  </head>
  <body>
    <main class="container">
      <h1>Love Letter</h1>
      <p class="hint">Plak hier de publieke GPT gesprek URL (gedeelde/public share).</p>
      <form action="/love" method="get" class="form">
        <input type="url" name="url" placeholder="https://chat.openai.com/share/..." required pattern="https?://.+" aria-label="GPT publiek gesprek URL" />
        <button type="submit">Love Letter</button>
      </form>
      <p class="note">Tip: Gebruik een gedeelde/publieke chat-URL. Privé sessies werken niet.</p>
    </main>
  </body>
  </html>`;
}

async function serveStatic(req, res, pathname) {
  const p = pathname === '/style.css' ? path.join(__dirname, 'public/style.css')
    : pathname === '/favicon.svg' ? path.join(__dirname, 'public/favicon.svg')
    : path.join(__dirname, pathname);
  try {
    await stat(p);
    const ext = path.extname(p).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.end(await readFile(p));
  } catch {
    res.statusCode = 404;
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && u.pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === 'GET' && u.pathname === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(indexHtml());
      return;
    }
    if (req.method === 'GET' && (u.pathname === '/style.css' || u.pathname === '/favicon.svg')) {
      await serveStatic(req, res, u.pathname);
      return;
    }
    if (req.method === 'GET' && u.pathname === '/love') {
      const target = u.searchParams.get('url') || '';
      if (!/^https?:\/\//i.test(target)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<p>Ongeldige URL.</p>');
        return;
      }
      const colors = pastelFromString(target);
      try {
        const upstream = await fetchWithTimeout(target, {
          headers: { 'user-agent': 'LoveLetter/clean', accept: 'text/html,application/xhtml+xml' },
          redirect: 'follow',
          timeout: 15000,
        });
        if (!upstream.ok) throw new Error('upstream not ok');
        const ct = upstream.headers.get('content-type') || '';
        if (!ct.includes('text/html')) throw new Error('not html');
        const html = await upstream.text();

        // Try structured extraction first
        const messages = extractNextDataMessages(html);
        if (messages && messages.length) {
          const out = renderMessagesHTML(messages, colors, target);
          sendCsp(res);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(out);
          return;
        }

        // Try LLM fallback via Trellis
        const llmMsgs = await llmExtractMessagesFromHtml(html);
        if (llmMsgs && llmMsgs.length) {
          const out = renderMessagesHTML(llmMsgs, colors, target);
          sendCsp(res);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(out);
          return;
        }

        // Fallback simple text extraction
        const blocks = fallbackTextFromHtml(html);
        const out = renderFallbackHTML(blocks, colors, target);
        sendCsp(res);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(out);
        return;
      } catch (e) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<p>Kon de inhoud niet laden.</p><pre>${escapeHtml(e?.message || String(e))}</pre>`);
        return;
      }
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found');
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Love Letter running at http://localhost:${PORT}`);
});
