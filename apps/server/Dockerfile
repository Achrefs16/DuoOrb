FROM node:22-bookworm-slim

WORKDIR /app

# Install openssl for Prisma engine on Debian
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy workspace package manifests
COPY package*.json ./
COPY packages/game-core/package*.json ./packages/game-core/
COPY packages/protocol/package*.json ./packages/protocol/
COPY apps/server/package*.json ./apps/server/

# Install monorepo dependencies. Scripts are skipped here on purpose: the
# root postinstall builds the workspace packages, but their sources are
# only copied below. The explicit builds further down cover it.
RUN npm install --ignore-scripts

# Copy source trees
COPY packages/game-core ./packages/game-core
COPY packages/protocol ./packages/protocol
COPY apps/server ./apps/server

# Build game-core, protocol, generate Prisma client, and build server
RUN npm run build --workspace=@duoorb/game-core
RUN npm run build --workspace=@duoorb/protocol
RUN npm run db:generate --workspace=@duoorb/server
RUN npm run build --workspace=@duoorb/server

EXPOSE 4000

WORKDIR /app

# Apply committed migrations, then start.
#
# `migrate deploy` only replays the migrations in prisma/migrations and never
# drops or rewrites anything, so a bad deploy can be rolled back by deploying
# the previous image.
CMD ["sh", "-c", "npm run migrate:deploy --workspace=@duoorb/server && npm run start --workspace=@duoorb/server"]
