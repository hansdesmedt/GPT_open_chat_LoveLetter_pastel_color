import express from 'express';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const PORT = process.env.PORT || 3000;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.trellis.inthepocket.net/').replace(/\/?$/, '/');
const CHATITP_API_KEY = process.env.CHATITP_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const DEBUG_ENV = process.env.DEBUG_LOVELETTER === '1';
const MAX_HTML = parseInt(process.env.MAX_HTML || '200000', 10);

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

function pastelFromString() {
  if (Math.random() < 0.7) return pickCuratedTheme();
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const hue = rand(330, 355); // pink/magenta core
  const comp = (hue + 180) % 360; // complementary accent
  const fgSat = rand(80, 95);
  const fgLight = rand(22, 34);
  const bgSat = rand(92, 98);
  const bgLight = rand(96, 99);
  const accentSat = rand(70, 90);
  const accentLight = rand(60, 80);
  const accent2Light = rand(85, 95);
  return {
    fg: `hsl(${hue} ${fgSat}% ${fgLight}%)`,
    bg: `hsl(${hue} ${bgSat}% ${bgLight}%)`,
    accent: `hsl(${comp} ${accentSat}% ${accentLight}%)`,
    accent2: `hsl(${comp} ${accentSat}% ${accent2Light}%)`,
  };
}

function heartsBgCss() {
  const stickers = ['💗','💖','💘','💞','✨','💫','🎀','🌸','🦄','😻'];
  function pick(n){
    const out=[]; const used=new Set();
    while(out.length<n){ const i=Math.floor(Math.random()*stickers.length); if(!used.has(i)){ used.add(i); out.push(stickers[i]); } }
    return out;
  }
  const [a,b,c,d] = pick(4);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>
    <rect width='100%' height='100%' fill='none'/>
    <text x='8' y='30' font-size='30'>${a}</text>
    <text x='66' y='25' font-size='24' transform='rotate(-12 66 25)'>${b}</text>
    <text x='32' y='78' font-size='28' transform='rotate(8 32 78)'>${c}</text>
    <text x='6' y='88' font-size='20' transform='rotate(-6 6 88)'>${d}</text>
  </svg>`;
  const encoded = encodeURIComponent(svg);
  return `url("data:image/svg+xml,${encoded}")`;
}
async function chooseGifUrl(theme = 'spice girls hearts') {
  const fallback = [
    'https://media.giphy.com/media/l0Exk8EUzSLsrErEQ/giphy.gif',
    'https://media.giphy.com/media/3o7aCUU6Qy5oS01qkM/giphy.gif',
    'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif',
    'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
    'https://media.giphy.com/media/l0IykYQb7F9Yxgqsg/giphy.gif',
  ];
  const key = process.env.GIPHY_API_KEY || '';
  try {
    if (!key) return fallback[Math.floor(Math.random() * fallback.length)];
    const endpoint = new URL('https://api.giphy.com/v1/gifs/search');
    endpoint.searchParams.set('api_key', key);
    endpoint.searchParams.set('q', theme);
    endpoint.searchParams.set('limit', '25');
    endpoint.searchParams.set('rating', 'pg');
    const r = await fetch(endpoint);
    if (!r.ok) return fallback[Math.floor(Math.random() * fallback.length)];
    const j = await r.json();
    const arr = j.data || [];
    if (!arr.length) return fallback[Math.floor(Math.random() * fallback.length)];
    const pick = arr[Math.floor(Math.random() * arr.length)];
    return (
      pick.images?.downsized_large?.url ||
      pick.images?.original?.url ||
      fallback[Math.floor(Math.random() * fallback.length)]
    );
  } catch {
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
}
function pickCuratedTheme() {
  const themes = [
    { fg: '#8a0a4f', bg: '#fff0f7', accent: '#21b5a3', accent2: '#c8fff5' },
    { fg: '#7a104c', bg: '#ffe6f3', accent: '#4cc9f0', accent2: '#dbf6ff' },
    { fg: '#9b0d64', bg: '#fff2f8', accent: '#5dd6b5', accent2: '#d9fff4' },
    { fg: '#a30a5c', bg: '#fff4fa', accent: '#7bd9ff', accent2: '#e6f9ff' },
    { fg: '#700b3f', bg: '#ffe9f4', accent: '#97f3e2', accent2: '#edfffb' },
  ];
  return themes[Math.floor(Math.random() * themes.length)];
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sendCsp(res) {
  res.set('Content-Security-Policy', "default-src 'self' data:; script-src 'none'; connect-src 'self'; img-src * data:; style-src 'self' 'unsafe-inline'; font-src * data:; frame-src 'none'; object-src 'none'; base-uri 'self';");
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
}

function renderMessagesHTML(messages, colors, originalUrl, debugLines = null) {
  const { fg, bg, accent, accent2 } = colors;
  
  const items = messages
    .filter((m) => {
      const r = String(m.role || '').toLowerCase();
      return r === 'user' || r === 'assistant';
    })
    .map((m) => {
      let text = '';
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) text = m.content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n');
      else if (Array.isArray(m.parts)) text = m.parts.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n');
      else if (m.message && typeof m.message === 'string') text = m.message;
      const safe = escapeHtml(String(text || '')).replaceAll('\n', '<br>');
      return `<section class="msg talk"><div class="body">${safe}</div></section>`;
    })
    .join('\n');
  const debugBlock = debugLines && debugLines.length
    ? `<details style="margin-top:12px"><summary>Debug info</summary><pre>${escapeHtml(debugLines.join('\n'))}</pre></details>`
    : '';
  return `<!doctype html>
  <html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Love Letter — Pastel</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/style.css">
    <style>
      :root{--love-fg:${fg};--love-bg:${bg};--accent:${accent};--accent2:${accent2};--bubble:color-mix(in oklab, var(--accent2) 70%, white)}
      html,body{background-color:var(--love-bg)!important;background-image: ${heartsBgCss()}, repeating-linear-gradient(45deg, color-mix(in oklab, var(--accent) 30%, white) 0 12px, transparent 12px 24px); background-size: 100px 100px, auto; background-repeat: repeat, repeat; color:var(--love-fg)!important;font-size:19px;line-height:1.75}
      a{color: color-mix(in oklab, var(--love-fg) 70%, black)}
      .wrap{position:relative; z-index:1; max-width:920px;margin:6vh auto;padding:20px}
      .ll{display:flex;flex-direction:column;gap:22px}
      .msg{position:relative;border-radius:22px;padding:18px 20px;font-size:1.2rem;max-width:78%; background: linear-gradient(135deg, var(--bubble), color-mix(in oklab, var(--bubble) 85%, white)); border:3px dotted var(--accent); box-shadow: 0 3px 0 rgba(255, 0, 120, 0.18), inset 0 0 0 2px rgba(255,255,255,0.7)}
      .msg.talk:nth-child(odd){align-self:flex-start; transform: rotate(-1.5deg)}
      .msg.talk:nth-child(even){align-self:flex-end; transform: rotate(1.5deg)}
      .msg.talk:nth-child(odd)::before{content:'✨'; position:absolute; top:-12px; left:-12px; font-size:18px}
      .msg.talk:nth-child(even)::before{content:'💞'; position:absolute; top:-12px; right:-12px; font-size:18px}
      h1{font-size:2.8rem;margin-bottom:22px; text-shadow: 0 2px 0 color-mix(in oklab, var(--accent) 50%, white)}
    </style>
  </head>
  <body>
    
    <main class="wrap">
      <h1>Love Letter</h1>
      <div class="ll">${items}</div>
      ${debugBlock}
    </main>
  </body>
  </html>`;
}

function fallbackTextFromDom(document) {
  const blocks = [];
  const sel = document.querySelector('main') || document.body;
  if (sel) {
    sel.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,pre,code,blockquote').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      let text = el.textContent || '';
      text = text.replace(/[\u00A0\t]+/g, ' ').replace(/\s+\n/g, '\n').trim();
      if (!text) return;
      blocks.push({ tag, text });
    });
  }
  return blocks;
}

function renderFallbackHTML(blocks, colors, originalUrl, debugLines = null) {
  const { fg, bg } = colors;
  const body = blocks.map((b) => `<section class="blk ${b.tag}">${escapeHtml(b.text).replaceAll('\n', '<br>')}</section>`).join('\n');
  const debugBlock = debugLines && debugLines.length
    ? `<details style="margin-top:12px"><summary>Debug info</summary><pre>${escapeHtml(debugLines.join('\n'))}</pre></details>`
    : '';
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
      html,body{background:var(--love-bg)!important;color:var(--love-fg)!important;font-size:18px;line-height:1.7}
      .wrap{max-width:900px;margin:6vh auto;padding:20px}
      .blk{padding:14px 16px;border:1px solid rgba(0,0,0,0.1);border-radius:14px;margin:10px 0;background:transparent;font-size:1.15rem}
      h1{font-size:2.3rem;margin-bottom:16px}
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>Love Letter</h1>
      ${body || '<p>Kon de inhoud niet automatisch structureren.</p>'}
      ${debugBlock}
    </main>
  </body>
  </html>`;
}

function extractMessagesFromNextData(dom, debugLines = null) {
  try {
    const { document } = dom.window;
    const nextDataEl = document.querySelector('script#__NEXT_DATA__');
    if (!nextDataEl) {
      debugLines && debugLines.push('No __NEXT_DATA__ script found');
      return null;
    }
    const json = JSON.parse(nextDataEl.textContent || 'null');
    if (!json) return null;
    // Strategy 1: explicit share mapping structure via common paths
    const mappingPaths = [
      ['props', 'pageProps', 'sharedConversationData'],
      ['props', 'pageProps', 'serverResponse'],
      ['props', 'pageProps', 'data'],
      ['state'],
    ];
    function getPath(obj, path) {
      return path.reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
    }
    function normalizeMapping(mapping) {
      const values = Object.values(mapping || {});
      const messages = values
        .map((n) => n && (n.message || (n.type === 'message' ? n : null)))
        .filter(Boolean)
        .map((msg) => {
          const role = msg.role || msg.author?.role || msg.author_role || 'assistant';
          let text = '';
          const c = msg.content || msg.message?.content || {};
          if (Array.isArray(c.parts)) text = c.parts.join('\n\n');
          else if (Array.isArray(msg.parts)) text = msg.parts.join('\n\n');
          else if (typeof c.text === 'string') text = c.text;
          else if (typeof c.value === 'string') text = c.value;
          else if (typeof c === 'string') text = c;
          else if (Array.isArray(c.content)) {
            text = c.content
              .map((p) => (typeof p === 'string' ? p : p?.text || p?.value || ''))
              .filter(Boolean)
              .join('\n\n');
          }
          return { role, content: text };
        });
      return messages.length ? messages.sort((a, b) => (a.create_time ?? 0) - (b.create_time ?? 0)) : null;
    }
    for (const p of mappingPaths) {
      const holder = getPath(json, p);
      if (holder && holder.mapping && typeof holder.mapping === 'object') {
        const msgs = normalizeMapping(holder.mapping);
        if (msgs && msgs.length) {
          debugLines && debugLines.push(`Found mapping at path: ${p.join('.')}, messages: ${msgs.length}`);
          return msgs;
        } else {
          debugLines && debugLines.push(`Mapping at path ${p.join('.')}, but no messages after normalize`);
        }
      }
    }

    // Strategy 2: any array of role+content objects
    const found = [];
    function visit(node) {
      if (!node) return;
      if (Array.isArray(node)) {
        const looksLikeMsgs =
          node.length > 0 &&
          node.every((x) => {
            if (!x || typeof x !== 'object') return false;
            const hasRole = 'role' in x || ('author' in x && typeof x.author === 'object' && 'role' in x.author);
            const hasContent =
              'content' in x ||
              'parts' in x ||
              ('message' in x && x.message && ('content' in x.message || 'parts' in x.message));
            return hasRole && hasContent;
          });
        if (looksLikeMsgs) found.push(node);
        node.forEach(visit);
      } else if (typeof node === 'object') {
        for (const k of Object.keys(node)) visit(node[k]);
      }
    }
    visit(json);
    if (found.length === 0) {
      debugLines && debugLines.push('No arrays resembling messages found in __NEXT_DATA__');
      return null;
    }
    // Normalize to {role, content}
    const best = found.sort((a, b) => b.length - a.length)[0];
    debugLines && debugLines.push(`Fallback messages array length: ${best.length}`);
    return best.map((m) => ({
      role: m.role || m.author?.role || 'assistant',
      content:
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
          ? m.content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n')
          : Array.isArray(m.parts)
          ? m.parts.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n')
          : m.message && m.message.content && Array.isArray(m.message.content)
          ? m.message.content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n')
          : '',
    }));
  } catch {
    return null;
  }
}

async function llmExtractMessagesFromHtml(html, model = LLM_MODEL, debugLines = null) {
  if (!CHATITP_API_KEY) return null;
  try {
    const endpoint = new URL('v1/chat/completions', OPENAI_BASE_URL).toString();
    const sys = `Je krijgt HTML van een gedeelde GPT conversatie. Extraheer een JSON array van berichten in volgorde. Returneer ALLEEN JSON met het schema: [{"role":"user|assistant","content":"tekst"}, ...].`;
    const sliceLen = Math.min(MAX_HTML, html.length);
    const user = `HTML START\n${html.slice(0, sliceLen)}\nHTML END`;
    debugLines && debugLines.push(`LLM request to ${endpoint} with model ${model}, html_len=${sliceLen}`);
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
    debugLines && debugLines.push(`LLM status: ${resp.status}`);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      debugLines && debugLines.push(`LLM error body: ${errText.slice(0, 400)}`);
      return null;
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) return null;
      debugLines && debugLines.push(`LLM parsed messages: ${parsed.length}`);
      return parsed;
    } catch {
      debugLines && debugLines.push('LLM content was not valid JSON array');
      return null;
    }
  } catch {
    return null;
  }
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
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
  </html>`);
});

app.get('/love', async (req, res) => {
  const target = req.query.url?.toString() || '';
  if (!/^https?:\/\//i.test(target)) {
    res.status(400).type('html').send('<p>Ongeldige URL.</p>');
    return;
  }
  const DEBUG = DEBUG_ENV || req.query.debug === '1';
  const debugLines = [];
  const dbg = (k, v) => {
    const line = `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`;
    debugLines.push(line);
    // eslint-disable-next-line no-console
    console.log('[love]', line);
  };
  const colors = pastelFromString(target);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(target, {
      headers: { 'user-agent': 'LoveLetter/express', accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    dbg('target', target);
    dbg('upstream.status', upstream.status);
    if (!upstream.ok) throw new Error(`Upstream status ${upstream.status}`);
    const ct = upstream.headers.get('content-type') || '';
    dbg('upstream.content-type', ct);
    if (!ct.includes('text/html')) throw new Error('Upstream is not HTML');
    const html = await upstream.text();
    dbg('upstream.html_len', html.length);

    const dom = new JSDOM(html);
    const u = new URL(target);

    // If it's a ChatGPT/OpenAI share link, try hitting the backend share API endpoints directly
    const host = u.hostname.toLowerCase();
    const isShareHost = host.endsWith('chatgpt.com') || host.endsWith('openai.com') || host.endsWith('shareg.pt');
    const isSharePath = /\/share\//.test(u.pathname) || host.endsWith('shareg.pt');
    if (isShareHost && isSharePath) {
      const idMatch = u.pathname.match(/\/share\/([^/?#]+)/);
      const shareId = idMatch ? idMatch[1] : u.pathname.split('/').filter(Boolean).pop();
      dbg('share.host', host);
      dbg('share.id', shareId || 'n/a');
      if (shareId) {
        const origin = `${u.protocol}//${u.host}`;
        const candidates = [
          `${origin}/backend-api/share/${shareId}`,
          `${origin}/api/share/${shareId}`,
          `${origin}/api/shared-conversations/${shareId}`,
          `${origin}/api/share/g/${shareId}`,
        ];
        for (const ep of candidates) {
          try {
            dbg('try.share.endpoint', ep);
            const r = await fetch(ep, {
              headers: {
                accept: 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                referer: target,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
              },
              redirect: 'follow',
            });
            dbg('share.endpoint.status', r.status);
            const rct = r.headers.get('content-type') || '';
            dbg('share.endpoint.content-type', rct);
            if (!r.ok) continue;
            const j = await r.json();
            // Try to find a mapping inside the response
            const stacks = [j];
            let mapping = null;
            while (stacks.length) {
              const cur = stacks.pop();
              if (cur && typeof cur === 'object') {
                if (cur.mapping && typeof cur.mapping === 'object') { mapping = cur.mapping; break; }
                for (const k of Object.keys(cur)) {
                  const v = cur[k];
                  if (v && typeof v === 'object') stacks.push(v);
                }
              }
            }
            if (mapping) {
              const nodes = Object.values(mapping)
                .map((n) => n && (n.message || (n.type === 'message' ? n : null)))
                .filter(Boolean)
                .sort((a, b) => (a.create_time ?? 0) - (b.create_time ?? 0));
              const msgs = nodes.map((msg) => {
                const role = msg.role || msg.author?.role || msg.author_role || 'assistant';
                let text = '';
                const c = msg.content || msg.message?.content || {};
                if (Array.isArray(c.parts)) text = c.parts.join('\n\n');
                else if (Array.isArray(msg.parts)) text = msg.parts.join('\n\n');
                else if (typeof c.text === 'string') text = c.text;
                else if (typeof c.value === 'string') text = c.value;
                else if (typeof c === 'string') text = c;
                else if (Array.isArray(c.content)) {
                  text = c.content
                    .map((p) => (typeof p === 'string' ? p : p?.text || p?.value || ''))
                    .filter(Boolean)
                    .join('\n\n');
                }
                return { role, content: text };
              });
              if (msgs.length) {
                dbg('share.endpoint.messages', msgs.length);
                const out = await renderMessagesHTML(msgs, colors, target, DEBUG ? debugLines : null);
                sendCsp(res);
                res.type('html').send(out);
                return;
              } else {
                dbg('share.endpoint.mappingFoundButNoMsgs', '1');
              }
            } else {
              dbg('share.endpoint.noMapping', '1');
            }
          } catch (e) {
            dbg('share.endpoint.error', e?.message || String(e));
          }
        }
      }
    }

    // Try Next.js/share mapping extraction first (OpenAI/chatGPT/share links)
    const messages = extractMessagesFromNextData(dom, debugLines);
    if (messages && messages.length) {
      const out = await renderMessagesHTML(messages, colors, target, DEBUG ? debugLines : null);
      sendCsp(res);
      res.type('html').send(out);
      return;
    }

    // Try LLM fallback via Trellis
    const llmMsgs = await llmExtractMessagesFromHtml(html, LLM_MODEL, debugLines);
    if (llmMsgs && llmMsgs.length) {
      const out = await renderMessagesHTML(llmMsgs, colors, target, DEBUG ? debugLines : null);
      sendCsp(res);
      res.type('html').send(out);
      return;
    }

    // DOM fallback
    const blocks = fallbackTextFromDom(dom.window.document);
    const out = renderFallbackHTML(blocks, colors, target);
    sendCsp(res);
    res.type('html').send(DEBUG ? renderFallbackHTML(blocks, colors, target, debugLines) : out);
  } catch (e) {
    const errMsg = e?.message || String(e);
    debugLines.push(`Error: ${errMsg}`);
    const body = DEBUG
      ? `<p>Kon de inhoud niet laden.</p><details><summary>Debug info</summary><pre>${escapeHtml(debugLines.join('\n'))}</pre></details>`
      : `<p>Kon de inhoud niet laden.</p><pre>${escapeHtml(errMsg)}</pre>`;
    res.status(502).type('html').send(body);
  }
});

// Proxy GIFs to avoid cross-origin and caching quirks
app.get('/gif', async (req, res) => {
  try {
    const u = req.query.u?.toString() || '';
    if (!/^https?:\/\//i.test(u)) return res.status(400).end('Bad URL');
    const r = await fetch(u, { redirect: 'follow' });
    const ct = r.headers.get('content-type') || 'image/gif';
    res.set('Content-Type', ct);
    const buf = await r.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (e) {
    res.status(502).end('GIF proxy failed');
  }
});

// Optional: quiet console warning
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.json({ version: 1, features: [] });
});

app.listen(PORT, () => {
  console.log(`Love Letter (Express) on http://localhost:${PORT}`);
});
