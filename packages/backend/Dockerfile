FROM node:20-alpine AS builder
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
COPY packages/backend ./packages/backend

RUN pnpm --filter @rpa/types build
RUN pnpm --filter @rpa/backend build
RUN pnpm --filter @rpa/backend deploy --prod /deploy

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /deploy .
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/types/dist ./node_modules/@rpa/types/dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
