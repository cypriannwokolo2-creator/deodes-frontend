# Deodes frontend — production image.
# Build-time NEXT_PUBLIC_* values are baked in via --build-arg (see
# ../deodes-backend/deploy/docker-compose.app.yml); server secrets
# (CIRCLE_*, ONRAMP_*) come from mounted env files at runtime, exactly
# like the current host process reads them from its working directory.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ARC_CHAIN_ID
ARG NEXT_PUBLIC_ARC_EXPLORER_URL
ARG NEXT_PUBLIC_ARC_NETWORK
ARG NEXT_PUBLIC_ARC_RPC_URL
ARG NEXT_PUBLIC_DEODES_CONTRACT_ID
ARG NEXT_PUBLIC_ONRAMP_ENABLED
ARG NEXT_PUBLIC_PASSKEY_RP_ID
ARG NEXT_PUBLIC_WS_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./
# next.config.mjs imports ./src at server startup (shared CSP module).
COPY --from=builder /app/src ./src
EXPOSE 1110
CMD ["npm", "run", "start"]
