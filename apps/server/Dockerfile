FROM node:22-alpine

WORKDIR /app

# Install openssl and libc compatibility for Prisma engine on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy workspace package manifests
COPY package*.json ./
COPY packages/game-core/package*.json ./packages/game-core/
COPY packages/protocol/package*.json ./packages/protocol/
COPY apps/server/package*.json ./apps/server/

# Install monorepo dependencies
RUN npm install

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

# Sync database schema and start server
CMD ["sh", "-c", "npm run db:push --workspace=@duoorb/server && npm run start --workspace=@duoorb/server"]
