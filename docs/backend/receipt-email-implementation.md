# 접수 완료 이메일

2026-09-16. 결제 검증이 만든 entry_received outbox를 별도 작업으로 발송한다. 실제 메일 발송이나 서비스 가입은 하지 않았다.

## 구현

접수 received, 결제 succeeded, 접수번호/확정시각 존재, Better Auth emailVerified=true인 계정만 발송 대상으로 고른다. participant/guardian 입력에 적힌 임의 주소로 보내지 않는다. 최초 대상 선정 시 계정 이메일·발신 주소·EN/KO 접수 안내·접수번호·UTC 시각을 고정한다. 메일에는 작품이나 보호자 개인정보를 넣지 않는다.

행 잠금과 2분 lease로 작업을 선점하고 DB 트랜잭션 밖에서 전송한다. 재시도는 고정된 본문과 동일 멱등 키를 사용한다. 실패해도 접수 확정은 유지하며 최대 12회, 30초부터 최대 15분 간격으로 재시도한다. 최초 시도 후 23시간이 지나면 stalled로 멈춘다. Resend의 [멱등 키 유효기간은 24시간](https://resend.com/docs/dashboard/emails/idempotency-keys)이므로 오래된 미확인 요청을 자동 재발송하지 않는다.

email_state=sent 및 delivered_at은 **메일 공급자가 요청을 수락했다는 뜻**이다. 받은편지함 도착 확인은 아니다. 반송/스팸/배달 웹훅과 운영 알림, stalled 수동 확인 화면은 아직 없다. pending/stalled 데이터는 DB에 남는다. 메일 장애는 접수번호나 주문을 되돌리지 않는다.

미확인 이메일은 대기한다. 기존 비밀번호 가입의 이메일 소유 확인 기능은 아직 연결하지 않았으므로, 이를 완료하거나 신뢰할 수 있는 인증 제공자가 검증한 계정이 있어야 실제 발송 대상이 된다. 관리자 DB에서 임의로 emailVerified를 켜는 것을 해결책으로 삼지 않는다.

## 설정 및 실행

`012_receipt_email.sql`을 마이그레이션 목록에 등록했다. 실제 DB 적용은 미실행이다.

- GYCA_EMAIL_PROVIDER=resend
- RESEND_API_KEY: 서버 전용 비밀 설정
- RECEIPT_EMAIL_FROM: 발신 도메인 확인을 마친 단일 이메일 주소
- RECEIPT_EMAIL_ENABLED=true
- RECEIPT_EMAIL_TOKEN: 32자 이상 전용 무작위 내부 실행 토큰

내부 POST `/api/internal/notifications/receipts`, JSON `{}`, Authorization Bearer 전용 토큰으로 1건씩 처리한다. 응답에 수신자나 메일 내용을 포함하지 않는다. 기본은 비활성이다. 실제 스케줄러와 도메인 DNS·발송 계정은 준비되지 않았다.

키/발신 계정 변경 시 기존 대기 발송을 먼저 확인해야 한다. 특히 다른 Resend 계정으로 옮기면 공급자의 멱등 기록이 공유되지 않을 수 있어 그대로 재시도하면 안 된다. 자동 계정 이동·운영 중 공급자 교체 기능은 없다.

## 검증

로컬 PGlite와 대체 HTTP 전송으로 수신 대상 조건, 성공 단건 처리, 실패 시 접수 유지, 고정 본문/키, 재시도 기한·횟수, lease 재선점과 오래된 완료 배제, 내부 토큰을 확인했다. 실제 Resend API·받은편지함 검증은 아니다.
