FROM node:20-alpine AS base

WORKDIR /app

# Install dev dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Development dependencies for build
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY scripts ./scripts
COPY drizzle.config.ts ./
COPY .env.example .env

RUN npm run build
RUN mkdir -p ./data
# Seed the database
RUN npm run db:generate && npm run db:push && npm run db:seed

# Runtime image 
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy production dependencies
COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/data ./data
COPY .env.example .env

EXPOSE 8080

CMD ["node", "dist/server.js"]