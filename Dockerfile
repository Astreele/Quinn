# ---- Builder Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY drizzle.config.ts ./

# Build TypeScript
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Set node environment
ENV NODE_ENV=production

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port (if needed for future webhooks/health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Start the application
CMD ["node", "dist/index.js"]

# ---- Migration Runner Stage ----
FROM node:20-alpine AS migration

WORKDIR /app

# Copy package files and install ALL dependencies (including dev for drizzle-kit)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and config needed for migrations
COPY tsconfig.json ./
COPY src/ ./src/
COPY drizzle.config.ts ./
