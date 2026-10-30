# Production image for Covenant.
#   docker build -t covenant .
#   docker run -p 3000:3000 -e DATABASE_URL=postgres://… [-e ANTHROPIC_API_KEY=…] covenant
# On start it applies migrations and seeds the demo data if the database is
# empty, then serves the app on port 3000.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build \
 # The database script (migrate / seed), bundled so the image needs no dev tools.
 && npx esbuild scripts/db.ts --bundle --platform=node --format=cjs --target=node22 \
      --external:pg-native --outfile=dist/db.cjs

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/db/migrations ./db/migrations
COPY --from=build --chown=app:app /app/dist/db.cjs ./dist/db.cjs
USER app
EXPOSE 3000
CMD ["sh", "-c", "node dist/db.cjs setup && node server.js"]
