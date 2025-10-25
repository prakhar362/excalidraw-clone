# ---- Base Stage ----
# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# ---- Dependencies Stage ----
# Install dependencies first to leverage Docker cache
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# ---- Build Stage ----
# Build the TypeScript source code into JavaScript
FROM base AS builder
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
# This command compiles your ./src directory into ./dist
RUN npx tsc

# ---- Production Stage ----
# This is the final, small image that will be deployed
FROM base AS production
ENV NODE_ENV=production

# Copy production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --frozen-lockfile

# Copy the compiled JavaScript from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose the port your app runs on
EXPOSE 5000

# Command to run the application
# Assumes your entry point is dist/index.js
CMD ["node", "dist/index.js"]