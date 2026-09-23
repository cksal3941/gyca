# GYCA 디자인 시스템 (공통 UI 기준)

목표: 홈·공모 상세·접수·마이페이지가 같은 서비스로 보이도록 **재사용 가능한 기준**을 둔다.
화면마다 색·간격을 하드코딩하지 않고, 아래 토큰과 컴포넌트를 쓴다.

## 소스 오브 트루스 / 경계

- **토큰 단일 소스 = `src/app/globals.css`의 `@theme`** (색·폰트·컨테이너 폭). 중복 토큰 파일을 만들지 않는다. (`design-system/tokens.*`는 과거 추출 아티팩트이며 사용하지 않음.)
- **사이트 공통 UI = `src/components/ds/`** — 공개/접수/마이페이지 등 사이트 표면 담당.
- **`src/components/ui/*`(shadcn) = 인증 클러스터 전용**(login/signup/signout/settings). 두 시스템을 섞거나 중복 생성하지 않는다. 인증은 "사전 조율" 영역(Codex).

미리보기: **`/styleguide`** (내부 참고, 공개 내비 미노출).

## 1. 색상

`brand-blue #0b05e2`(액센트/링크), `brand-orange`(상태 강조), `ink-strong #111`·`ink #222`(본문),
`line #eee`(경계), `canvas`·`surface`(배경). 상태색: `success / info / warning / danger`(+ `*-soft` 배경).
→ 유틸: `text-*`, `bg-*`, `border-*`. **회색 본문 텍스트 지양**(ink 계열 사용). 상태는 색만으로 구분하지 않음(§상태 배지).

## 2. 타이포그래피 (한글·영문)

- `font-display` = Bebas Neue(라틴 대문자 디스플레이). 한글은 자동으로 Pretendard로 폴백.
- `font-title` = Bebas + Pretendard(제목; 한글·영문 혼용 안전). 제목은 `font-title font-bold`.
- `font-sans`(Pretendard) = 본문 기본. 최소 본문 **16px**.
- 크기: 제목 `clamp()`로 반응형, 본문 `text-[16px] leading-[1.7~1.9]`.

## 3. 간격 · 콘텐츠 최대 폭

- **섹션 폭 `max-w-page`(1400)** — 사이트 헤더·히어로를 제외한 모든 섹션 공통. 좁은 본문 `max-w-content`(1000). 사이트 헤더는 `max-w-[1570px]` 유지, 히어로는 full-bleed.
- 가로 `px-6` · 섹션 `py-16~24`.
- 간격은 Tailwind 4px 스케일(`gap-*`, `space-*`)만. 임의 픽셀 지양.

## 4. 버튼 · 링크 · 입력 필드 (`ds/`)

- `Button` — variant `primary`(검정)/`accent`(블루)/`outline`/`ghost`, size `sm`/`md`. `href`면 `Link`로 렌더. **긴 영문 라벨은 줄바꿈**(min-height 증가, 아이콘 shrink-0). `focus-visible` 링.
- `ArrowLink` — 화살표 링크(hover 이동, 포커스 링).
- `Field` + `TextInput`/`Textarea`/`Select` — **라벨(htmlFor/id)·도움말·오류를 `aria-describedby`로 연결**, 오류 시 `aria-invalid` + `role="alert"`. `controlClass`로 포커스 링·invalid 스타일 토큰화.

## 5. 오류 · 도움말 · 알림 · 상태 배지

- `Message` — `info/success/warning/danger`. **아이콘 + 텍스트로 의미 전달(색만 아님)**, `role=status|alert`.
- `StatusBadge` — `neutral/info/success/warning/danger`. **항상 라벨(+점) 표시** → 색맹 접근성.

## 6. 탭 · 단계 표시 · 모달

- `Tabs` — `tablist/tab/tabpanel` roles, `aria-selected`, roving tabindex, ←/→/Home/End 키보드.
- `Stepper` — 완료=체크, 현재=채움+`aria-current="step"`, 예정=번호. **색만으로 구분하지 않음.**
- `Modal` — radix Dialog(포커스 트랩·Esc·배경 클릭·`aria` 라벨링).

## 7. 헤더 · 푸터 · 로그인 후 메뉴

- 공개 헤더 = `components/Header`(고정 70px, 스크롤 시 반전, 중앙 내비 + `LocaleToggle` + Sign in/up, 모바일 드로어). 서브페이지는 `(site)/layout`이 동일 헤더/푸터 공유.
- 로그인 후 = `Header`의 `AccountMenu`(아바타 드롭다운: Settings/Sign out). 마이페이지 진입은 별도.
- 푸터 = `components/Footer`(기관 정보·SNS·법적 표기).

## 8. 영어 기본 · 한국어 전환 (i18n)

- 라우팅 변경 없음(언어별 URL 보류 — 인증 콜백·라우팅 영향, Codex 조율). 쿠키 기반.
- `@/lib/i18n`(타입·`t`/`tl`), `@/lib/i18n/server`(`getServerLocale`, 서버 컴포넌트), `LocaleProvider`+`useLocale`(클라이언트), `LocaleToggle`.
- 문구는 `{en, ko}`로 두고, 서버 컴포넌트는 `getServerLocale()`, 클라이언트는 `useLocale()`로 선택.

## 9. 필수 조건 준수

- 하드코딩 금지 → `ds/` 컴포넌트·토큰 사용.
- 전역 스타일 변경은 **additive**(상태색 토큰 추가만; 기존 값 불변 → 회귀 없음).
- 키보드 포커스·라벨·오류 연결·대비 → `Field`/`Button`/`Tabs`/`Modal`에 내장.
- 상태 = 색+라벨/아이콘.
- 반응형(360/768/1440) 확인 대상.
- 긴 영문 라벨 줄바꿈, 이미지 없을 때 gradient fallback으로 레이아웃 유지.

## 10. 남은 일 (점진 이관)

기존 페이지들은 아직 동일 패턴을 **인라인**으로 갖고 있다(시각적으로는 일치). 신규/수정 화면부터
`ds/` 컴포넌트로 이관해 인라인 하드코딩을 제거한다. 대표 화면 검증은 `/styleguide`의
"Sample · Home hero section"과 "Sample · Submit form segment" 참고.
