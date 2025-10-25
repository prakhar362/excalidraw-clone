 # ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies Stage ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# ---- Build Stage ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Environment variables can be passed at build time
# ARG NEXT_PUBLIC_API_URL
# ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# ---- Production Stage ----
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy production-ready files from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Expose port 3000
EXPOSE 3000

# Set the user to run the app (good security practice)
USER nextjs

# The command to start the Next.js server
CMD ["node", "server.js"]