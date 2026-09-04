FROM node:22-alpine AS base
WORKDIR /app
# Puppeteer (used by QuotationPdfService) bundles a Chromium build that doesn't run on Alpine's
# musl libc — install the distro's own Chromium + shared libs instead and skip the download.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# --- deps: install with the full monorepo workspace context so @hpl/shared resolves.
# --ignore-scripts because the root "postinstall" builds @hpl/shared from source, which
# isn't copied in yet at this layer (only package.json, for Docker layer caching) — built
# explicitly in each downstream stage instead, right after `COPY . .`. ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install --workspaces --include-workspace-root --ignore-scripts

# --- dev: used by docker-compose, source is bind-mounted over this ---
FROM deps AS dev
COPY . .
RUN npm run build -w packages/shared
WORKDIR /app/apps/backend
# --ignore-scripts above also skipped Prisma's own postinstall (prisma generate) —
# generate explicitly, otherwise every Prisma-inferred type collapses to {}/unknown.
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

# --- build: production build (used later once a hosting target is picked) ---
# `nest build`'s type-checking pass can peak close to Node's default ~2GB heap ceiling on this
# monorepo — same issue documented in the main README for `nest start --watch` locally, just
# never fixed here since this stage went unused until a hosting target was picked.
FROM deps AS build
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY . .
RUN npm run build -w packages/shared
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

# --- prod: slim runtime image ---
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/prisma ./prisma
COPY --from=build /app/apps/backend/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/main.js"]
