# ============================================
# MEOS:HELDEN — Single-Container Build
# Frontend (React/Vite) + Backend (Node/Express)
# Port: 3800
# ============================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
# Empty VITE_API_URL = same-origin (single container serves both)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Backend + serve built frontend
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ .
COPY --from=frontend-build /frontend/dist ./public

ENV PORT=3800
ENV NODE_ENV=production
EXPOSE 3800

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3800/health || exit 1

CMD ["node", "src/server.js"]
