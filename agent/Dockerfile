# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY src ./src
COPY tsconfig.json ./tsconfig.json

# build: tsc → dist/  +  cp -r src/knowledge dist/knowledge
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
