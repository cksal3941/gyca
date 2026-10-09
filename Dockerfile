# Cloud Run 배포용 Dockerfile (Next.js standalone 출력 사용)

FROM node:24-alpine AS base

# 1단계: 의존성 설치
FROM base AS deps
WORKDIR /app
RUN npm install -g pnpm@11.22.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS production-deps
WORKDIR /app
RUN npm install -g pnpm@11.22.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# 2단계: 빌드
FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@11.22.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build --webpack
# Keep complete production dependencies instead of the partial file-traced dependency tree.
RUN rm -rf /app/.next/standalone/node_modules

FROM builder AS migration
ENV NODE_ENV=production
USER node
CMD ["node", "scripts/migrate-all.mjs"]

# 3단계: 실행 (standalone 출력만 복사한 최소 이미지)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=production-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/inspect-upload.mjs ./scripts/inspect-upload.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/deployment-check.mjs ./scripts/deployment-check.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/run-scheduled-jobs.mjs ./scripts/run-scheduled-jobs.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/lib/scheduled-jobs.mjs ./scripts/lib/scheduled-jobs.mjs
USER nextjs

# Cloud Run이 PORT 환경변수를 주입하며 standalone server.js가 이를 읽음
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["node", "server.js"]
