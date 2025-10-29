## Quick context

This repo renders a "Love Letter" pastel view of a public GPT share URL. There are two server entrypoints included:

- `server.js` — zero-dependency, minimal Node (ESM) HTTP server (uses only built-in Node 22+ APIs).
- `app.js` — Express-based implementation with extra helpers (JSDOM parsing, GIF proxy, debug endpoints).

Both implement the same core flow: accept a public GPT share URL -> fetch the upstream HTML -> try structured extraction (OpenAI/Next.js `__NEXT_DATA__` or direct share API endpoints) -> fall back to LLM extraction via a Trellis/OpenAI gateway -> fallback text extraction -> render static pastel HTML and return with strict CSP.

## Key files to inspect when changing behavior

- `server.js` — simpler, good for quick edits when adding small features without installing deps. See: fetchWithTimeout, extractNextDataMessages, llmExtractMessagesFromHtml, renderMessagesHTML.
- `app.js` — fuller Express version. Look here for JSDOM-based extraction, share-API probing, GIF proxy (`/gif`), health endpoint (`/health`) and debug features.
- `public/` — static assets (CSS, favicon). `public/style.css` controls visual presentation.
- `package.json` — shows Node engine requirement and which server is the npm script target (`main: app.js`, scripts use `node app.js`).

## Runtime & workflows

- Node version: requires Node 22+ (see `engines` in `package.json`).
- Start (default): `node app.js` (package.json scripts `start`/`dev` map to `app.js`). `server.js` can be run directly when you want a zero-dep variant: `node server.js`.
- No build step. Tests: none provided.

## Important environment variables

- `CHATITP_API_KEY` or `OPENAI_API_KEY` — required for LLM fallback (Trellis/OpenAI gateway).
- `OPENAI_BASE_URL` or `OPENAI_API_BASE` — override Trellis/OpenAI gateway base URL (default: `https://api.trellis.inthepocket.net/`).
- `PORT` — http port (default 3000).
- `LLM_MODEL` (in `app.js`) — model used for HTML->messages (default `gpt-4o-mini`).
- `MAX_HTML` (in `app.js`) — maximum HTML chars to send to LLM fallback.
- `DEBUG_LOVELETTER` — set to `1` to enable verbose debug blocks in responses. You can also append `?debug=1` to requests when using `app.js`.
- `GIPHY_API_KEY` — optional; used by `app.js` when selecting animated backgrounds.

## Data flow and extraction strategy (implementation notes for agents)

1. Fetch upstream URL with a timeout (~15s). If content-type is not HTML, abort with 502.
2. Try to parse `__NEXT_DATA__` (OpenAI/ChatGPT share pages) for message arrays first — both servers implement this (see `extractNextDataMessages` in `server.js` and `extractMessagesFromNextData` in `app.js`).
3. If the URL looks like an OpenAI "share" link, `app.js` tries several direct backend-share endpoints (`/backend-api/share/:id`, `/api/share/:id`, etc.) to retrieve JSON mappings.
4. If structured extraction fails, call the LLM fallback (`llmExtractMessagesFromHtml`) using the Trellis/OpenAI gateway. HTML is trimmed to `MAX_HTML` (node default 150k-ish in code). Response MUST be a JSON array [{role, content},...].
5. If LLM fails, do a DOM/text fallback (extract p, li, headings, pre blocks) and render a readable static HTML page.

## Rendering & security

- Output HTML is intentionally script-free and served with a strict Content-Security-Policy. Avoid adding inline scripts or external analytics without updating CSP in `sendCsp`.
- Visuals: `renderMessagesHTML` / CSS inlined per-response plus `public/style.css`. `app.js` adds optional GIF backgrounds proxied via `/gif`.

## Local debugging tips

- Use `DEBUG_LOVELETTER=1 node app.js` to surface debug info in responses and console logs.
- To test share-probing logic, use an example OpenAI share URL: `https://chat.openai.com/share/<id>` and observe the app attempting direct share API endpoints first.
- If LLM fallback is not working, confirm `CHATITP_API_KEY` is present and `OPENAI_BASE_URL` points to a reachable Trellis/OpenAI gateway.

## Quick change map (where to change common knobs)

- change timeout: `fetchWithTimeout` (server.js) and controller timeout in `app.js` (both use ~15000ms)
- change LLM model / max HTML: `LLM_MODEL` and `MAX_HTML` in `app.js` (or adjust constants in `server.js`'s llmExtractMessagesFromHtml)
- change CSP: `sendCsp` in both files

## Minimal examples for agents

- Start express server: `node app.js` (or `npm start`)
- Start zero-dep server: `node server.js`
- Health check (express): `GET /health` returns `{ ok: true }`

If any of the above is unclear or you'd like more examples (end-to-end request traces, suggested unit tests, or a recommended development Docker setup), tell me which area to expand and I'll update this file. 
