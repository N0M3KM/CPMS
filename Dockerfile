# ##############################################################################
# CPMS production image (multi-stage). One container serves the API and the built
# React client on one port. Build from the repository root: docker build -t cpms .
#
# Stage 1 (build)   installs all dependencies, compiles the server (tsc) and builds the client (Vite).
# Stage 2 (runtime) copies only what runs: compiled server, Prisma schema and migrations, the seed
#                   source, node_modules, and the built client. It runs as the non-root `node` user.
#
# Secrets (DATABASE_URL, SESSION_SECRET, seed passwords) are never baked into the image; they are
# injected at run time (Secret Manager on Cloud Run, .env for docker compose). See docs/labs/lab-05/deployment.md.
# The migration job runs from this same image: `npx prisma migrate deploy && npx tsx src/seed/run.ts`
# in /app/server, so the Prisma CLI and tsx stay in node_modules on purpose.
# ##############################################################################

FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
# Package files first so `npm ci` is cached until dependencies change. The Prisma schema is needed
# because the server's postinstall runs `prisma generate`.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
COPY server/prisma server/prisma
RUN npm ci
COPY . .
# Builds server/dist (tsc) and client/dist (Vite).
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app/server
RUN apk add --no-cache openssl
# The commit this image was built from, shown by GET /api/version. Set with --build-arg APP_COMMIT=<sha>.
ARG APP_COMMIT=unknown
ENV APP_COMMIT=$APP_COMMIT \
    NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Bangkok
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/src ./src
COPY --from=build /app/server/prisma ./prisma
# The server serves this directory by default in production (../client/dist relative to /app/server).
COPY --from=build /app/client/dist /app/client/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
