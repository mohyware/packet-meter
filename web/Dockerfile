# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source files
COPY tsconfig*.json vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY public ./public
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY .env.example .env

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

RUN npm install -g serve

# Copy only the built files
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Serve the static files
CMD ["serve", "-s", "dist", "-l", "3000"]