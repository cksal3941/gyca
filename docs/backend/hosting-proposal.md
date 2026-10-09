# 10월 초 오픈용 인프라 제안

2026-09-16. 아직 계정이 없다는 사용자 답변에 따른 제안이다. 계정·유료 서비스·배포를 생성하지 않았다.

## 권장 구성

| 역할 | 제안 |
| --- | --- |
| Next.js 웹·API | Render Node Web Service |
| 접수·주문 DB | 같은 리전의 유료 Render PostgreSQL |
| 비공개 작품 파일 | AWS S3 |
| 파일 검사·결제 복구 | Render 별도 worker/cron 실행 구성 |
| 인증 | 현재 Better Auth 유지 |
| PG | 토스 우선 검토, EUR·해외 카드 계약 확인 전 활성화 금지 |

선정은 현재 코드를 기준으로 한 기술적 판단이다. Node 프로세스 기반 PDF/이미지 검사와 지속적인 복구 작업이 있으므로 웹과 작업 실행 환경을 같은 서비스군으로 관리하는 구성이 적합하다. Render는 [Next.js Node 서비스](https://render.com/docs/deploy-nextjs-app)와 [백그라운드 작업](https://render.com/docs/background-workers)을 지원한다.

DB는 웹과 같은 리전을 우선한다. Render 공식 문서는 같은 리전의 내부 연결을 권장하며 유료 DB에 시점 복구를 제공한다. [DB 생성·연결](https://render.com/docs/postgresql-creating-connecting), [백업](https://render.com/docs/postgresql-backups). 백업이 제공되어도 실제 복원 훈련은 별도로 한다.

작품은 앱 서버를 거치지 않고 권한 검증 후 저장소로 직접 업로드하도록 연결할 계획이다. S3는 [조건부 쓰기](https://docs.aws.amazon.com/us_en/AmazonS3/latest/userguide/conditional-writes.html)를 지원하므로 기존 객체 덮어쓰기 방지 계약에 맞추기 좋다. S3 공급자 어댑터와 다중 부분 업로드·재개 기능은 아직 구현해야 한다.

Vercel/Supabase도 검토했다. Vercel 함수는 [요청 본문 4.5MB 제한](https://vercel.com/docs/errors/function_payload_too_large)이 있어 파일 직접 업로드 구조가 필요하고, Supabase는 [재개 가능한 업로드](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)를 제공한다. 어느 구성에서도 파일 검사·결제 복구의 실행 구조까지 설계해야 한다. 이번에는 기존 Node/pg 기반을 유지하는 Render+S3를 우선 제안한다.

## 확정 전 입력

- 예산, 예상 참가 건수, 작품당 최대 크기·전체 저장량·피크 동시 접속.
- 기관 명의 계정 소유자, 결제 수단, 도메인 관리 계정.
- 참가국 분포 및 개인정보 보관·이전 정책을 검토한 리전 선택. 유럽 행사라는 이유만으로 특정 지역을 임의 확정하지 않는다.
- PG 계약 주체와 해외 카드 EUR 지원 여부.

월 비용은 인스턴스·DB·저장량·다운로드량·이메일·PG 수수료를 합쳐 산정해야 하므로 아직 견적을 확정하지 않는다. 가입 시점의 공식 요금과 위 사용량으로 검토한다.

## 실제 연결 순서

1. 기관 명의 계정과 테스트용 프로젝트 준비, 리전·요금제 확정.
2. DB 연결정보를 로컬 비밀 설정에 입력하고 인증 테이블부터 마이그레이션. 비밀번호를 채팅이나 인계 문서에 붙이지 않는다.
3. S3 비공개 버킷·접근 권한·업로드 CORS와 서버 공급자 구현 후 실제 파일 검증.
4. 실제 로그인으로 공모 등록→제출→토스 테스트 승인→접수 확인.
5. 복구·환불·백업 복원·부하 테스트 후 운영 전환.
