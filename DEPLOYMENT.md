# Hackathon demo deployment

This project is packaged for one VPS using Docker Compose:

```text
Internet (HTTPS) -> Caddy -> React frontend
                          -> /api/* -> FastAPI
                                         -> persistent SQLite + graph data
```

The database and graph data live in the `criminalnet_data` Docker volume. The
seeded demo accounts are intentionally retained:

| Username | Password |
| --- | --- |
| `admin` | `admin123` |
| `investigator1` | `password123` |
| `investigator2` | `password123` |

Use those only for the hackathon demonstration. Do not load real case data.

## First deployment on the VPS

1. Point the domain's DNS A record to the VPS public IP. Open ports `80` and
   `443`; restrict SSH (`22`) to your team's IP addresses where possible.
2. Install Docker Engine and the Docker Compose plugin on Ubuntu 24.04.
3. Clone this repository and create the server configuration:

   ```bash
   cp .env.example .env
   openssl rand -hex 32
   nano .env
   ```

   Set `DOMAIN`, `CADDY_EMAIL`, and paste the generated value into
   `SECRET_KEY`. Keep `.env` private.
4. Start the demo:

   ```bash
   docker compose up -d --build
   docker compose logs -f caddy api
   ```

5. Open `https://YOUR_DOMAIN/api/health` to verify the API, then sign in at the
   site using one of the demo accounts above.

Caddy automatically obtains and renews the TLS certificate once DNS and ports
80/443 are reachable. It removes `/api` before sending requests to FastAPI,
which matches the frontend's existing `/api` client paths.

## Resetting demo data

The demo data persists across redeployments. To reset it completely:

```bash
docker compose down -v
docker compose up -d
```

Run `docker compose exec api python seed.py` only if you need to repopulate a
running empty database. It preserves existing investigator accounts.

## Updating during the hackathon

```bash
git pull
docker compose up -d --build
docker compose ps
```

Do not use `--reload` on the VPS. The demo intentionally uses one Uvicorn
worker because its SQLite database is file-based; Caddy serves the frontend and
HTTPS.
