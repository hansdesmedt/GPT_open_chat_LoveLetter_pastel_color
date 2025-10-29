# Love Letter — Pastel GPT Share Viewer (Trellis API)

Schoon herbouwd zonder externe npm dependencies. De app:
- Vraagt om een publieke GPT gesprek URL (share link)
- Probeert berichten te extraheren uit de HTML (`__NEXT_DATA__`)
- Valt terug op je Trellis OpenAI gateway om de HTML te laten parsen naar berichten
- Toont de conversatie in pastel complementaire kleuren

## Configuratie

Zet je sleutel en (optioneel) base URL via env vars:

- `CHATITP_API_KEY` — jouw Trellis/OpenAI API key
- `OPENAI_BASE_URL` — standaard: `https://api.trellis.inthepocket.net/`

Zie `.env.example`.

## Gebruik

- Start lokaal: `node server.js`
- Open: `http://localhost:3000`
- Plak een gedeelde/publieke GPT chat-URL (bv. `https://chat.openai.com/share/...`)
- Klik “Love Letter”

## Deploy opties

Kies één van onderstaande. Deze app heeft geen build stap en draait met `node server.js`.

### Docker (generiek)

- Build: `docker build -t loveletter:latest .`
- Run: `docker run -p 3000:3000 -e CHATITP_API_KEY=... loveletter:latest`

### Render.com

- Repo koppelen aan Render
- “Web Service” → Runtime Node
- Start command: `node server.js`
- Zet env vars: `CHATITP_API_KEY`, optioneel `OPENAI_BASE_URL`
- Alternatief: gebruik `render.yaml` (Blueprint deploy)

### Fly.io

- `fly launch` (bestaande `fly.toml` en `Dockerfile` gebruiken)
- `fly secrets set CHATITP_API_KEY=...`
- `fly deploy`

### Heroku

- `heroku create`
- `heroku config:set CHATITP_API_KEY=...`
- Push repo: `git push heroku main`
- Of gebruik container: `heroku container:push web && heroku container:release web`


## Opmerkingen

- De LLM-fallback stuurt maximaal ~150k tekens HTML ter parsing naar het model `gpt-4o-mini`. Pas dit gerust aan.
- De uitkomst is statisch (geen scripts) om CSP/analytics fouten te vermijden.
