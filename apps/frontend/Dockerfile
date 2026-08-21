FROM node:22-alpine AS base
WORKDIR /app

# --- deps: install with the full monorepo workspace context so @hpl/shared resolves.
# --ignore-scripts because the root "postinstall" builds @hpl/shared from source, which
# isn't copied in yet at this layer (only package.json, for Docker layer caching) — built
# explicitly in each downstream stage instead, right after `COPY . .`. ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install --workspaces --include-workspace-root --ignore-scripts

# --- dev: used by docker-compose, source is bind-mounted over this ---
FROM deps AS dev
COPY . .
RUN npm run build -w packages/shared
WORKDIR /app/apps/frontend
EXPOSE 3005
CMD ["npm", "run", "dev"]

# --- build: production build (used later once a hosting target is picked) ---
FROM deps AS build
COPY . .
RUN npm run build -w packages/shared
WORKDIR /app/apps/frontend
RUN npm run build

# --- prod: slim runtime image ---
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/apps/frontend/public ./public
COPY --from=build /app/apps/frontend/.next ./.next
COPY --from=build /app/apps/frontend/node_modules ./node_modules
COPY --from=build /app/apps/frontend/package.json ./package.json
EXPOSE 3005
CMD ["npm", "run", "start"]
