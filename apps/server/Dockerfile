# Stage 1: Build native Rust analyzer
FROM rust:alpine AS rust-builder
WORKDIR /build/packages/analyzer-rust
RUN apk add --no-cache musl-dev
COPY packages/analyzer-rust/Cargo.* ./
COPY packages/analyzer-rust/build.rs ./
COPY packages/analyzer-rust/src ./src
RUN cargo build --release
RUN cp target/release/libduoorb_analyzer.so duoorb-analyzer.node

# Stage 2: Node.js server runtime
FROM node:22-alpine

WORKDIR /app

# Install openssl and libc compatibility for Prisma engine on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy workspace package manifests
COPY package*.json ./
COPY packages/game-core/package*.json ./packages/game-core/
COPY packages/protocol/package*.json ./packages/protocol/
COPY packages/analyzer-rust/package*.json ./packages/analyzer-rust/
COPY apps/server/package*.json ./apps/server/

# Install monorepo dependencies. Scripts are skipped here on purpose: the
# root postinstall builds the workspace packages, but their sources are
# only copied below. The explicit builds further down cover it.
RUN npm install --ignore-scripts

# Copy source trees and compiled Rust binary
COPY packages/game-core ./packages/game-core
COPY packages/protocol ./packages/protocol
COPY packages/analyzer-rust ./packages/analyzer-rust
COPY --from=rust-builder /build/packages/analyzer-rust/duoorb-analyzer.node ./packages/analyzer-rust/duoorb-analyzer.node
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
