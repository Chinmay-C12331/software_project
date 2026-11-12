# Multi-stage Dockerfile for College Course Registration System (Team-7)
FROM node:22-slim AS builder

# Install build dependencies required for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/registration.db

# Copy built assets, node_modules, and server source
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server

# Create persistent volume mount directory for SQLite database
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["npm", "start"]
