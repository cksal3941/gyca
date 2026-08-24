# MySlide (gyca)

Next.js 16 + Tailwind CSS 4 기반 웹사이트.
회원가입/로그인은 [Better Auth](https://better-auth.com) + PostgreSQL, UI는 [shadcn/ui](https://ui.shadcn.com)를 사용합니다.
프로덕션은 **Google Cloud Run**에 배포하고, DB는 **Supabase(PostgreSQL)**를 사용합니다.

---

## 1. 의존성 설치

### 필수 도구

| 도구 | 용도 | 설치 |
|---|---|---|
| Node.js 20+ | 런타임 | https://nodejs.org |
| pnpm 11 | 패키지 매니저 | `npm install -g pnpm` 또는 `corepack enable` |
| Docker | 로컬 개발용 DB | https://docker.com (Docker Desktop) |
| gcloud CLI | 배포 (Cloud Shell 사용 시 불필요) | https://cloud.google.com/sdk |

### 프로젝트 의존성 설치

```bash
pnpm install
```

---

## 2. 데이터베이스 설정

### 2-1. 로컬 개발용 DB (Docker PostgreSQL)

로컬 개발에는 Docker로 PostgreSQL을 띄웁니다:

```bash
docker run -d --name gyca-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gyca \
  -p 5432:5432 \
  postgres:16-alpine
```

컨테이너 관리:

```bash
docker start gyca-postgres    # 재부팅 후 다시 시작
docker stop gyca-postgres     # 중지
docker logs gyca-postgres     # 로그 확인
```

### 2-2. 환경변수 파일 생성

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다:

```bash
cp .env.example .env.local
```

```env
# .env.local (로컬 개발 기준)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gyca
BETTER_AUTH_SECRET=<openssl rand -hex 32 로 생성한 값>
BETTER_AUTH_URL=http://localhost:3000
```

시크릿 생성 명령:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2-3. 인증 테이블 마이그레이션

Better Auth가 사용하는 테이블(`user`, `session`, `account`, `verification`)을 생성합니다:

```bash
pnpm db:migrate
```

> 공식 `@better-auth/cli`는 설치된 better-auth 버전과 스키마가 어긋날 수 있어
> (`issuer` 컬럼 누락 등), 설치된 버전 기준으로 동작하는 `scripts/migrate.mjs`를 사용합니다.
> 이미 최신이면 "스키마가 이미 최신입니다"가 출력되고 아무것도 변경하지 않습니다.

### 2-4. 프로덕션 DB (Supabase)

1. https://supabase.com 에서 프로젝트 생성 (Region: **Northeast Asia (Seoul)** 권장)
2. 대시보드 상단 **Connect** 버튼 → **Session pooler** 탭의 URI 복사
   - ⚠️ **Direct connection은 IPv6 전용이라 Cloud Run에서 접속 불가.** 반드시 Session pooler(포트 5432)를 사용할 것.
   - 형태: `postgresql://postgres.xxxx:<비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`
3. 프로덕션 DB에 테이블 생성 (로컬에서 1회 실행):

```powershell
# PowerShell
$env:DATABASE_URL="<Supabase Session pooler URI>"; node scripts/migrate.mjs
```

```bash
# bash
DATABASE_URL="<Supabase Session pooler URI>" node scripts/migrate.mjs
```

4. 저장된 데이터는 Supabase 대시보드 → **Table Editor**에서 확인 (`user` 테이블 등)

---

## 3. 개발/테스트 커맨드

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 실행 → http://localhost:3000 |
| `pnpm build` | 프로덕션 빌드 (타입 검사 포함 — PR 전 필수 확인) |
| `pnpm start` | 빌드 결과물로 프로덕션 서버 실행 |
| `pnpm lint` | ESLint 검사 |
| `pnpm db:migrate` | `.env.local`의 DB에 인증 스키마 마이그레이션 |

### 인증 API 수동 테스트 (dev 서버 실행 중에)

```bash
# 회원가입
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"테스트","email":"test@example.com","password":"password1234"}'

# 로그인 (쿠키 저장)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password1234"}'

# 세션 확인
curl -b cookies.txt http://localhost:3000/api/auth/get-session
```

페이지: 로그인 `/login`, 회원가입 `/signup`

### 로컬에서 프로덕션 컨테이너 검증 (배포 전 권장)

```bash
docker build -t gyca-test .
docker run -d --name gyca-test -e PORT=8080 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/gyca" \
  -e BETTER_AUTH_SECRET=<시크릿> \
  -p 8080:8080 gyca-test
curl -i http://localhost:8080          # HTTP 200 확인
docker rm -f gyca-test                 # 정리
```

---

## 4. Google Cloud 배포 (Cloud Run)

### 4-1. 최초 1회 설정

Cloud Shell(https://shell.cloud.google.com) 기준:

```bash
git clone git@github.com:cksal3941/gyca.git && cd gyca
```

첫 배포 시 API 활성화를 물어보면 모두 `y`. 빌드 권한 오류
(`PERMISSION_DENIED: Build failed because the default service account is missing required IAM permissions`)가 나면:

```bash
gcloud projects add-iam-policy-binding <프로젝트ID> \
  --member="serviceAccount:<프로젝트번호>-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"
```

1분 정도 기다린 뒤 배포를 재시도합니다.

### 4-2. 최초 배포 (환경변수 포함)

```bash
gcloud run deploy gyca --source . --region asia-northeast3 --allow-unauthenticated \
  --set-env-vars 'DATABASE_URL=<Supabase Session pooler URI>,BETTER_AUTH_SECRET=<시크릿>'
```

배포가 끝나면 출력되는 서비스 URL(`https://gyca-xxxx.a.run.app`)을 환경변수로 등록:

```bash
gcloud run services update gyca --region asia-northeast3 \
  --update-env-vars 'BETTER_AUTH_URL=https://<서비스 URL>'
```

### 4-3. 이후 배포 (코드만 변경됐을 때)

환경변수는 유지되므로 배포 명령만 실행하면 됩니다:

```bash
cd ~/gyca && git pull
gcloud run deploy gyca --source . --region asia-northeast3
```

### 4-4. 운영 확인 명령

```bash
gcloud run services describe gyca --region asia-northeast3   # 상태/URL/환경변수 확인
gcloud run services logs read gyca --region asia-northeast3 --limit 50   # 컨테이너 로그
```

### 배포 구조 메모

- Cloud Run이 80/443 포트와 HTTPS 인증서를 자동 처리합니다. HTTP(80) 접속은 HTTPS(443)로 자동 리다이렉트됩니다.
- `Dockerfile`은 Next.js `output: "standalone"` 출력을 사용한 멀티스테이지 빌드입니다.
- `next.config.ts`의 `outputFileTracingIncludes`는 standalone 추적이 `@swc/helpers/esm`을
  누락해 컨테이너가 시작 직후 죽는 문제(Next 16.3.1 + pnpm)의 보정이므로 제거하지 말 것.
- 커스텀 도메인은 Cloud Run 콘솔 → "사용자 지정 도메인 매핑"에서 연결합니다.

---

## 5. 소셜 로그인 설정 (선택)

환경변수를 설정하면 자동으로 활성화됩니다 (`src/lib/auth.ts`).

### Google

1. [Google Cloud Console → API 및 서비스 → 사용자 인증 정보](https://console.cloud.google.com/apis/credentials)에서 OAuth 클라이언트 ID 생성 (웹 애플리케이션)
2. 승인된 리디렉션 URI에 등록:
   - `https://<서비스 URL>/api/auth/callback/google` (프로덕션)
   - `http://localhost:3000/api/auth/callback/google` (로컬)
3. 환경변수 추가: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Apple

1. Apple Developer Program 가입 필요 (연 $99)
2. Service ID 생성 후 콜백 등록: `https://<서비스 URL>/api/auth/callback/apple`
3. 환경변수 추가: `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`

Cloud Run에 환경변수 추가:

```bash
gcloud run services update gyca --region asia-northeast3 \
  --update-env-vars 'GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...'
```
