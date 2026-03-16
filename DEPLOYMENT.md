# MEOS:HELDEN v2.0 — Deployment Guide

## Architektur-Änderung: Prisma → Raw SQL

v2.0 hat Prisma komplett entfernt. Alle DB-Zugriffe laufen über `pg` (node-postgres) mit Raw SQL.
Damit entfällt die Prisma-Schema-Synchronisation und die Tabellen können direkt in Supabase verwaltet werden.

## Voraussetzungen

- Supabase PostgreSQL mit pgvector Extension
- Docker Hub Account: `mariomeosv40`
- Hostinger VPS: 31.97.122.6

## 1. Datenbank initialisieren

Im Supabase SQL Editor ausführen (einmalig, idempotent):

```sql
-- Datei: backend/init-db.sql
-- Erstellt alle Tabellen + search_weighted() Funktion
-- SAFE: Nutzt IF NOT EXISTS überall
```

Kopiere den Inhalt von `backend/init-db.sql` in den Supabase SQL Editor und führe ihn aus.

## 2. Admin-User anlegen

Nach dem ersten Start:

```bash
curl -X POST http://31.97.122.6:3800/api/auth/init \
  -H "Content-Type: application/json" \
  -d '{"email":"mario@schreinerhelden.de","password":"DEIN_PASSWORT","name":"Mario Esch"}'
```

## 3. Docker Image bauen und pushen

Auf deinem Windows-PC in PowerShell:

```powershell
cd C:\Users\Video\MEOShelden
git pull
docker build -t mariomeosv40/meoshelden:latest .
docker push mariomeosv40/meoshelden:latest
```

## 4. Auf Hostinger deployen

Im Hostinger Docker Manager → YAML einfügen:

```yaml
version: '3.8'
services:
  meoshelden:
    image: mariomeosv40/meoshelden:latest
    container_name: meoshelden
    pull_policy: always
    ports:
      - "3800:3800"
    environment:
      - PORT=3800
      - DATABASE_URL=postgresql://postgres.bpdjdxjvncmnwfbdoqka:PASSWORT@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
      - OPENAI_API_KEY=sk-...
      - DATAFORSEO_LOGIN=...
      - DATAFORSEO_PASSWORD=...
      - JWT_SECRET=meos-helden-2026
      - GSC_SITE_URL=https://schreinerhelden.de/
      - WP_URL=https://schreinerhelden.de
    restart: unless-stopped
```

## 5. Embeddings generieren

Nach dem Deploy mit den 70 Chunks ohne Embeddings:

1. Login auf http://31.97.122.6:3800
2. Tab "🧠 Wissen" → Button "🧠 Embed All" klicken
3. Wartet im Hintergrund (~10-15 Sekunden pro Chunk, ~15 Min total)
4. Status-Anzeige zeigt Fortschritt

Oder via API:
```bash
TOKEN=$(curl -s -X POST http://31.97.122.6:3800/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mario@schreinerhelden.de","password":"..."}' | jq -r '.token')

curl -X POST http://31.97.122.6:3800/api/knowledge/embed-all \
  -H "Authorization: Bearer $TOKEN"

# Status prüfen:
curl http://31.97.122.6:3800/api/knowledge/embed-status \
  -H "Authorization: Bearer $TOKEN"
```

## 6. Health Checks

```
http://31.97.122.6:3800/health       → App + DB Status
http://31.97.122.6:3800/health/db    → Tabellen-Check (Zeigt welche Tabellen existieren + Row-Counts)
```

## Nginx Proxy Manager (optional)

Falls du helden.meosapp.de konfigurieren willst:

- Proxy Host: helden.meosapp.de → 127.0.0.1:3800
- SSL: Let's Encrypt
- Websockets: On

## Port-Übersicht

| App | Interner Port | Externer Port |
|-----|---------------|---------------|
| MEOS:HELDEN | 3800 | 3800 |
| MEOS:SEO | 3000/4000 | 3000/4000 |
| MEOS:Visio | 3100 | 3100 |
