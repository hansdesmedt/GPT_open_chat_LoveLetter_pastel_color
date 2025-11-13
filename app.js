import express from 'express';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const PORT = process.env.PORT || 3000;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.trellis.inthepocket.net/').replace(/\/?$/, '/');
const CHATITP_API_KEY = process.env.CHATITP_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const DEBUG_ENV = process.env.DEBUG_LOVELETTER === '1';
const MAX_HTML = parseInt(process.env.MAX_HTML || '200000', 10);
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || '';

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

function generateLoveLetterTheme() {
  // ColorHunt-inspired pink/pastel palettes
  const palettes = [
    { fg: '#C63C51', bg: '#FFF6F6', accent: '#68D2E8', accent2: '#D7F9FF' },
    { fg: '#D91656', bg: '#FFF4F4', accent: '#3ABEF9', accent2: '#E1F7FF' },
    { fg: '#C70039', bg: '#FFF5F7', accent: '#00D9FF', accent2: '#CCF5FF' },
    { fg: '#EE4E4E', bg: '#FFFCFC', accent: '#88D66C', accent2: '#E8FFE0' },
    { fg: '#FF6969', bg: '#FFF9F9', accent: '#6FDCE3', accent2: '#DFF6F8' },
    { fg: '#E11D48', bg: '#FFF1F2', accent: '#06B6D4', accent2: '#CFFAFE' },
    { fg: '#F43F5E', bg: '#FFF1F2', accent: '#14B8A6', accent2: '#CCFBF1' },
    { fg: '#BE123C', bg: '#FFF1F2', accent: '#0EA5E9', accent2: '#E0F2FE' },
    { fg: '#EC4899', bg: '#FCE7F3', accent: '#22D3EE', accent2: '#CFFAFE' },
    { fg: '#DB2777', bg: '#FCE7F3', accent: '#06B6D4', accent2: '#CFFAFE' },
    { fg: '#D946EF', bg: '#FAE8FF', accent: '#2DD4BF', accent2: '#CCFBF1' },
    { fg: '#C026D3', bg: '#FAE8FF', accent: '#14B8A6', accent2: '#CCFBF1' },
  ];
  return palettes[Math.floor(Math.random() * palettes.length)];
}

function generateToiletRollTheme() {
  // ColorHunt-inspired brown/earthy palettes
  const palettes = [
    { fg: '#5F4E4E', bg: '#FDF6F0', accent: '#B4A091', accent2: '#F5EBE0' },
    { fg: '#654321', bg: '#FFF8F0', accent: '#C19A6B', accent2: '#F5E6D3' },
    { fg: '#7C6A5D', bg: '#FFFBF5', accent: '#D4A574', accent2: '#F5E8DC' },
    { fg: '#8B7355', bg: '#FFF9F0', accent: '#D4B896', accent2: '#F5EFE6' },
    { fg: '#6B4423', bg: '#FFF8F3', accent: '#B8956A', accent2: '#F5E9DC' },
    { fg: '#86775F', bg: '#FFFCF7', accent: '#C9B99E', accent2: '#F5F0E8' },
    { fg: '#6F5E53', bg: '#FFFAF5', accent: '#C4A878', accent2: '#F5EBDD' },
    { fg: '#7A6550', bg: '#FFFBF6', accent: '#D2B48C', accent2: '#F5EEE6' },
    { fg: '#5C4B42', bg: '#FFF9F4', accent: '#BCA38A', accent2: '#F5EBE0' },
    { fg: '#6D5D4F', bg: '#FFFCF8', accent: '#C7AD8F', accent2: '#F5EFE7' },
  ];
  return palettes[Math.floor(Math.random() * palettes.length)];
}

function heartsBgCss() {
  const stickers = ['💗','💖','💘','💞','✨','💫','🎀','🌸','🦄','😻','🌺','🌷','🌹','💐','🦋','🧚','💕','💓','💝','🎉','🌈','⭐','🌟','💎'];
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

function toiletRollBgCss() {
  const stickers = ['🧻','💩','🚽','🧼','🪠','📜','🗞️','📰','🚿','🛁','🪥','🧽','🪣','🧴','🪒','🧹','🗑️','💨'];
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
async function chooseMultipleGifs(theme = 'spice girls hearts', count = 8) {
  const fallback = [
    'https://media.giphy.com/media/l0Exk8EUzSLsrErEQ/giphy.gif',
    'https://media.giphy.com/media/3o7aCUU6Qy5oS01qkM/giphy.gif',
    'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif',
    'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
    'https://media.giphy.com/media/l0IykYQb7F9Yxgqsg/giphy.gif',
  ];
  try {
    if (!GIPHY_API_KEY) {
      // Return random fallbacks
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(fallback[Math.floor(Math.random() * fallback.length)]);
      }
      return result;
    }
    const endpoint = new URL('https://api.giphy.com/v1/gifs/search');
    endpoint.searchParams.set('api_key', GIPHY_API_KEY);
    endpoint.searchParams.set('q', theme);
    endpoint.searchParams.set('limit', '30');
    endpoint.searchParams.set('rating', 'pg');
    const r = await fetch(endpoint);
    if (!r.ok) {
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(fallback[Math.floor(Math.random() * fallback.length)]);
      }
      return result;
    }
    const j = await r.json();
    const arr = j.data || [];
    if (!arr.length) {
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(fallback[Math.floor(Math.random() * fallback.length)]);
      }
      return result;
    }
    // Shuffle and pick count GIFs
    const shuffled = arr.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, arr.length));
    return picked.map(gif =>
      gif.images?.downsized_small?.mp4 ||
      gif.images?.fixed_width?.url ||
      gif.images?.downsized?.url ||
      gif.images?.original?.url ||
      fallback[Math.floor(Math.random() * fallback.length)]
    );
  } catch {
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(fallback[Math.floor(Math.random() * fallback.length)]);
    }
    return result;
  }
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
  res.set('Content-Security-Policy', "default-src 'self' data:; script-src 'unsafe-inline'; connect-src 'self'; img-src * data:; style-src 'self' 'unsafe-inline'; font-src * data:; frame-src 'none'; object-src 'none'; base-uri 'self';");
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
}

async function renderMessagesHTML(messages, colors, originalUrl, debugLines = null, theme = 'loveletter') {
  const { fg, bg, accent, accent2 } = colors;

  // Fetch multiple GIFs based on theme
  const gifTheme = theme === 'toiletroll' ? 'toilet paper bathroom funny' : 'pink hearts sparkles love';
  const gifUrls = await chooseMultipleGifs(gifTheme, 8);

  // Create scattered GIF elements
  const positions = [
    { top: '5%', left: '5%', size: '220px', rotate: '-8deg' },
    { top: '10%', right: '8%', size: '180px', rotate: '12deg' },
    { top: '40%', left: '3%', size: '200px', rotate: '5deg' },
    { top: '35%', right: '5%', size: '190px', rotate: '-10deg' },
    { top: '65%', left: '7%', size: '210px', rotate: '15deg' },
    { top: '70%', right: '10%', size: '195px', rotate: '-7deg' },
    { top: '85%', left: '15%', size: '175px', rotate: '9deg' },
    { top: '90%', right: '12%', size: '185px', rotate: '-12deg' },
  ];

  const gifElements = gifUrls.map((url, idx) => {
    const pos = positions[idx] || positions[0];
    const posStyle = pos.top ? `top:${pos.top};` : '';
    const leftStyle = pos.left ? `left:${pos.left};` : '';
    const rightStyle = pos.right ? `right:${pos.right};` : '';
    return `<div class="bg-gif" style="${posStyle}${leftStyle}${rightStyle}width:${pos.size};height:${pos.size};transform:rotate(${pos.rotate});background-image:url('${url}')"></div>`;
  }).join('');

  const filtered = messages.filter((m) => {
    const r = String(m.role || '').toLowerCase();
    return r === 'user' || r === 'assistant';
  });

  if (debugLines) {
    debugLines.push(`renderMessagesHTML: ${messages.length} total, ${filtered.length} after role filter`);
    filtered.forEach((m, i) => {
      const contentPreview = String(m.content || '').slice(0, 50);
      debugLines.push(`msg[${i}]: role=${m.role}, content=${contentPreview}...`);
    });
  }

  const items = filtered.map((m, idx) => {
      let text = '';
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) text = m.content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n');
      else if (Array.isArray(m.parts)) text = m.parts.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n\n');
      else if (m.message && typeof m.message === 'string') text = m.message;
      const safe = escapeHtml(String(text || '')).replaceAll('\n', '<br>');
      return `<section class="msg talk" data-msg-id="${idx}">
        <button class="hide-msg-btn" onclick="toggleMessage(${idx})" title="Hide this message">×</button>
        <div class="body">${safe}</div>
      </section>`;
    })
    .join('\n');
  const debugBlock = debugLines && debugLines.length
    ? `<details style="margin-top:12px"><summary>Debug info</summary><pre>${escapeHtml(debugLines.join('\n'))}</pre></details>`
    : '';

  const isToiletRoll = theme === 'toiletroll';
  const title = isToiletRoll ? 'Toilet Role' : 'Love Letter';
  const bgCss = isToiletRoll ? toiletRollBgCss() : heartsBgCss();
  const icon1 = isToiletRoll ? '🧻' : '✨';
  const icon2 = isToiletRoll ? '💩' : '💞';
  const borderStyle = isToiletRoll ? '3px solid var(--accent)' : '3px dotted var(--accent)';
  const shadowColor = isToiletRoll ? 'rgba(139, 115, 85, 0.25)' : 'rgba(255, 0, 120, 0.18)';
  const bgPattern = isToiletRoll
    ? 'repeating-linear-gradient(0deg, rgba(139, 115, 85, 0.08) 0 2px, transparent 2px 20px)'
    : 'repeating-linear-gradient(45deg, color-mix(in oklab, var(--accent) 30%, white) 0 12px, transparent 12px 24px)';

  return `<!doctype html>
  <html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — Pastel</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/style.css">
    <style>
      :root{--love-fg:${fg};--love-bg:${bg};--accent:${accent};--accent2:${accent2};--bubble:color-mix(in oklab, var(--accent2) 70%, white)}
      html,body{background-color:var(--love-bg)!important;background-image: ${bgCss}, ${bgPattern}; background-size: 100px 100px, auto; background-repeat: repeat, repeat; color:var(--love-fg)!important;font-size:19px;line-height:1.75;min-height:100vh}
      body{position:relative}
      .bg-gif{position:fixed;background-size:cover;background-position:center;border-radius:16px;opacity:1;z-index:0;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.15)}
      a{color: color-mix(in oklab, var(--love-fg) 70%, black)}
      .wrap{position:relative; z-index:1; max-width:920px;margin:6vh auto;padding:20px}
      .ll{display:flex;flex-direction:column;gap:22px}
      .msg{position:relative;border-radius:22px;padding:18px 20px;font-size:1.2rem;max-width:78%; background: linear-gradient(135deg, var(--bubble), color-mix(in oklab, var(--bubble) 85%, white)); border:${borderStyle}; box-shadow: 0 3px 0 ${shadowColor}, inset 0 0 0 2px rgba(255,255,255,0.7)}
      .msg.talk:nth-child(odd){align-self:flex-start; transform: rotate(-1.5deg)}
      .msg.talk:nth-child(even){align-self:flex-end; transform: rotate(1.5deg)}
      .msg.talk:nth-child(odd)::before{content:'${icon1}'; position:absolute; top:-12px; left:-12px; font-size:18px}
      .msg.talk:nth-child(even)::before{content:'${icon2}'; position:absolute; top:-12px; right:-12px; font-size:18px}
      h1{font-size:2.8rem;margin-bottom:22px; text-shadow: 0 2px 0 color-mix(in oklab, var(--accent) 50%, white)}

      .print-btn{position:fixed;top:20px;right:20px;padding:12px 20px;background:var(--accent);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;font-size:1rem;display:flex;align-items:center;gap:8px}
      .print-btn:hover{filter:brightness(1.1);transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,0.2)}
      .print-btn:active{transform:translateY(0)}

      .hide-msg-btn{position:absolute;top:8px;right:8px;width:28px;height:28px;border:2px solid var(--accent);background:rgba(255,255,255,0.9);color:var(--accent);border-radius:50%;font-size:22px;line-height:1;cursor:pointer;opacity:0;transition:opacity .2s ease;display:flex;align-items:center;justify-content:center;padding:0;font-weight:bold}
      .msg:hover .hide-msg-btn{opacity:1}
      .hide-msg-btn:hover{background:var(--accent);color:white;transform:scale(1.1)}
      .msg.hidden{display:none!important}

      @media print {
        .print-btn,.hide-msg-btn,.bg-gif{display:none!important}
        html,body{background-image:none!important}
        .wrap{margin:0;padding:10px;max-width:100%}
        .msg{page-break-inside:avoid;transform:none!important;max-width:100%;box-shadow:none;border-width:2px}
        .msg.hidden{display:none!important}
        .msg::before{display:none}
        h1{font-size:2rem;page-break-after:avoid}
        details{display:none}
        @page{margin:1.5cm}
      }
    </style>
  </head>
  <body>
    ${gifElements}
    <button class="print-btn" onclick="window.print()">
      <span>🖨️</span>
      <span>Print / Save PDF</span>
    </button>

    <main class="wrap">
      <h1>${title}</h1>
      <div class="ll">${items}</div>
      ${debugBlock}
    </main>

    <script>
      function toggleMessage(id) {
        const msg = document.querySelector('.msg[data-msg-id="' + id + '"]');
        if (msg) {
          msg.classList.toggle('hidden');
        }
      }
    </script>
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
    let content = data.choices?.[0]?.message?.content || '';
    debugLines && debugLines.push(`LLM content preview: ${content.slice(0, 200)}`);

    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    try {
      const parsed = JSON.parse(content);
      // If it's an object with a messages array, extract that
      let messages = Array.isArray(parsed) ? parsed : parsed.messages || parsed.conversation || Object.values(parsed);
      if (!Array.isArray(messages)) {
        debugLines && debugLines.push('LLM content was not an array or object with messages');
        return null;
      }
      debugLines && debugLines.push(`LLM parsed messages: ${messages.length}`);
      return messages;
    } catch (e) {
      debugLines && debugLines.push(`LLM JSON parse error: ${e.message}`);
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

        <div class="theme-selector">
          <label>Kies een thema:</label>
          <div class="theme-options">
            <label class="theme-option">
              <input type="radio" name="theme" value="loveletter" checked />
              <span>💗 Love Letter</span>
            </label>
            <label class="theme-option">
              <input type="radio" name="theme" value="toiletroll" />
              <span>🧻 Toilet Role</span>
            </label>
          </div>
        </div>

        <button type="submit">Generate</button>
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
  const theme = req.query.theme?.toString() || 'loveletter';
  const DEBUG = DEBUG_ENV || req.query.debug === '1';
  const debugLines = [];
  const dbg = (k, v) => {
    const line = `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`;
    debugLines.push(line);
    // eslint-disable-next-line no-console
    console.log('[love]', line);
  };
  const colors = theme === 'toiletroll' ? generateToiletRollTheme() : generateLoveLetterTheme();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(target, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
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
                dbg('share.endpoint.roles', msgs.map(m => m.role).join(', '));
                const out = await renderMessagesHTML(msgs, colors, target, DEBUG ? debugLines : null, theme);
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
      const out = await renderMessagesHTML(messages, colors, target, DEBUG ? debugLines : null, theme);
      sendCsp(res);
      res.type('html').send(out);
      return;
    }

    // Try LLM fallback via Trellis
    const llmMsgs = await llmExtractMessagesFromHtml(html, LLM_MODEL, debugLines);
    if (llmMsgs && llmMsgs.length) {
      const out = await renderMessagesHTML(llmMsgs, colors, target, DEBUG ? debugLines : null, theme);
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
