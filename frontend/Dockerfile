# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies Stage ----
# Install all dependencies to build the project
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# ---- Build Stage ----
# Build the Next.js application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Production Stage ----
# This is the final image, containing only what's needed for production
FROM base AS production
ENV NODE_ENV=production

# Copy package.json and install ONLY production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --frozen-lockfile

# Copy the built application and public assets from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose the port the app runs on
EXPOSE 3000

# The command to start the application in production
CMD ["npm", "start"]