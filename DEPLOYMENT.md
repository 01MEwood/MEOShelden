# MEOS:HELDEN — Deployment Guide

## Architektur

```
helden.meosapp.de (Port 3200)     helden-api.meosapp.de (Port 4200)
┌────────────────────┐            ┌────────────────────┐
│  React Frontend    │  ──API──►  │  Node.js Backend   │
│  (nginx, static)   │            │  (Express, Prisma) │
└────────────────────┘            └────────┬───────────┘
                                           │
                               ┌───────────┴───────────┐
                               │  PostgreSQL + pgvector │
                               │  (Supabase / VPS)     │
                               └───────────────────────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                   DataForSEO API    OpenAI API      Google SC API
```

## Voraussetzungen

- [ ] Hostinger VPS (31.97.122.6) mit Docker
- [ ] PostgreSQL mit pgvector Extension (Supabase oder VPS)
- [ ] DNS A-Records für helden.meosapp.de + helden-api.meosapp.de → 31.97.122.6
- [ ] Nginx Proxy Manager: Routing + SSL
- [ ] OpenAI API Key (bereits in MEOS:SEO vorhanden)
- [ ] DataForSEO Credentials (bereits in MEOS:SEO vorhanden)

## Schritt-für-Schritt

### 1. DNS (Hostinger DNS-Manager)

```
A   helden.meosapp.de       →  31.97.122.6
A   helden-api.meosapp.de   →  31.97.122.6
```

### 2. Datenbank vorbereiten

```sql
-- In Supabase SQL Editor oder psql:
CREATE DATABASE meos_helden;
\c meos_helden
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. .env erstellen

Kopiere `.env.example` → `.env` und fülle:
- DATABASE_URL (Supabase connection string)
- OPENAI_API_KEY (gleicher wie MEOS:SEO)
- DATAFORSEO_LOGIN + PASSWORD
- JWT_SECRET (neuer Wert)
- WP_USER + WP_APP_PASSWORD (WordPress Application Password erstellen)

### 4. Docker Images bauen + pushen

```bash
# Auf deinem Rechner (oder in Claude):
cd meos-helden

# Backend
docker build -t memario/meos-helden-backend:latest ./backend
docker push memario/meos-helden-backend:latest

# Frontend
docker build -t memario/meos-helden-frontend:latest \
  --build-arg VITE_API_URL=https://helden-api.meosapp.de \
  ./frontend
docker push memario/meos-helden-frontend:latest
```

### 5. Auf VPS deployen (Hostinger Docker Manager)

docker-compose.yml in den Hostinger Docker Manager einfügen:
- Frontend Container: memario/meos-helden-frontend:latest, Port 3200:80
- Backend Container: memario/meos-helden-backend:latest, Port 4200:4200
- Environment Variables aus .env setzen

### 6. Nginx Proxy Manager

Zwei Proxy Hosts anlegen:

**helden.meosapp.de:**
- Scheme: http
- Forward Hostname: localhost (oder container IP)
- Forward Port: 3200
- SSL: Let's Encrypt

**helden-api.meosapp.de:**
- Scheme: http
- Forward Hostname: localhost
- Forward Port: 4200
- SSL: Let's Encrypt
- Custom locations: Add websocket support if needed

### 7. Prisma Migration + pgvector

```bash
# Im Backend-Container:
npx prisma migrate deploy
psql -f prisma/pgvector.sql
```

### 8. Seeds ausführen

```bash
# User anlegen (gleiche wie MEOS:SEO)
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function seed() {
  await prisma.user.create({ data: {
    email: 'mario@schreinerhelden.de',
    password: await bcrypt.hash('meos2026!', 10),
    name: 'Mario Esch', role: 'admin'
  }});
  await prisma.user.create({ data: {
    email: 'melanie@schreinerhelden.de',
    password: await bcrypt.hash('marketing2026!', 10),
    name: 'Melanie', role: 'team'
  }});
  console.log('Users created');
}
seed();
"

# City Profiles
node seeds/seed-cities.js

# Knowledge Base (braucht ~60 Sekunden wegen Embeddings)
node seeds/seed-knowledge.js
```

### 9. Smoke Test

```bash
# Health Check
curl https://helden-api.meosapp.de/health
# → {"status":"ok","app":"meos-helden","version":"1.0.0"}

# Frontend
curl -s https://helden.meosapp.de | head -5
# → <!DOCTYPE html>...

# Login Test
curl -X POST https://helden-api.meosapp.de/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mario@schreinerhelden.de","password":"meos2026!"}'
# → {"success":true,"token":"..."}
```

### 10. MEOS:SEO Bridge-Button

In MEOS:SEO Frontend einen Link-Button hinzufügen:

```jsx
// In der MEOS:SEO Navigation (App.jsx):
<a href="https://helden.meosapp.de" target="_blank"
   className="px-4 py-2 bg-orange-500 text-white rounded-lg">
  🛡️ HELDEN öffnen
</a>
```

## Erste Pipeline testen

1. Öffne https://helden.meosapp.de
2. Login: mario@schreinerhelden.de / meos2026!
3. Tab: 🚀 Pipeline
4. Eingabe: Orts-LP, "schreiner stuttgart einbauschrank", Stadt: Stuttgart
5. Klick: 🛡️ HELDENFORMEL Pipeline starten
6. Warten: 30-90 Sekunden
7. Ergebnis: Content + Schema + Board-Review + Export-HTML

## Kosten-Übersicht

| Posten | Pro Seite | 28 Seiten |
|---|---|---|
| OpenAI Embeddings | $0.01 | $0.28 |
| OpenAI GPT-4o (Content) | $0.08 | $2.24 |
| OpenAI GPT-4o (Schema) | $0.02 | $0.56 |
| OpenAI GPT-4o (Board) | $0.06 | $1.68 |
| OpenAI GPT-4o (Export) | $0.03 | $0.84 |
| DataForSEO (SERP+KW) | $0.10 | $2.80 |
| **Gesamt** | **~$0.30** | **~$8.40** |

28 Seiten (18 Orts + 7 Produkte + 3 Pillar) = **unter 10 Dollar API-Kosten**.
