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
COPY packages/dashboard ./packages/dashboard

# URL pública da API: só exibida na página de integração, não é segredo
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @rpa/dashboard build
RUN pnpm --filter @rpa/dashboard deploy --prod /deploy

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /deploy .
COPY --from=builder /app/packages/dashboard/.next ./.next

EXPOSE 3001
CMD ["node_modules/.bin/next", "start", "--port", "3001"]
