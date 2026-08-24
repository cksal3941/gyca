# Cloud Run 배포용 Dockerfile (Next.js standalone 출력 사용)

FROM node:22-alpine AS base

# 1단계: 의존성 설치
FROM base AS deps
WORKDIR /app
RUN npm install -g pnpm@11.22.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 2단계: 빌드
FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@11.22.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# 3단계: 실행 (standalone 출력만 복사한 최소 이미지)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public 폴더를 추가하면 아래 줄의 주석을 해제하세요
# COPY --from=builder /app/public ./public
USER nextjs

# Cloud Run이 PORT 환경변수를 주입하며 standalone server.js가 이를 읽음
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["node", "server.js"]
