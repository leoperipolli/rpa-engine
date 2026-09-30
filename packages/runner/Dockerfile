FROM node:20-bookworm-slim AS builder
RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/backend/package.json ./packages/backend/
COPY packages/dashboard/package.json ./packages/dashboard/
COPY packages/runner/package.json ./packages/runner/

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY packages/types ./packages/types
COPY packages/runner ./packages/runner

RUN pnpm --filter @rpa/types build
RUN pnpm --filter @rpa/runner build
RUN pnpm --filter @rpa/runner deploy --prod /deploy

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_HEADLESS=true

COPY --from=builder /deploy .
COPY --from=builder /app/packages/runner/dist ./dist
COPY --from=builder /app/packages/types/dist ./node_modules/@rpa/types/dist

RUN node_modules/.bin/playwright install --with-deps chromium

CMD ["node", "dist/index.js"]
