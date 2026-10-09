"use client";

import LegalDocument, { type LegalDocumentData } from "@/components/site/LegalDocument";

// 개인정보처리방침. 사실관계(처리자 정보, 수집 항목, 위탁·이전 대상, 삭제 경로)는
// 코드와 운영 구성에 맞춘 것이며, 법적 문구의 최종 확정은 운영 주체의 검토를 거친다.
// 수정 시 effectiveDate 를 갱신할 것.

const ORG = {
  name: { ko: "글로벌 영 크리에이트 어워드 (GYCA)", en: "Global Young Create Awards (GYCA)" },
  ceo: { ko: "구민영", en: "Koo Min-young" },
  address: {
    ko: "서울특별시 강남구 압구정로 401, 55동 807호 (압구정동, 한양아파트)",
    en: "55-807, 401 Apgujeong-ro, Gangnam-gu, Seoul, Republic of Korea",
  },
  bizNo: "454-25-02305",
  email: "admin@gyca.org",
};

const doc: LegalDocumentData = {
  eyebrow: "Privacy",
  title: { ko: "개인정보처리방침", en: "Privacy Policy" },
  description: {
    ko: "GYCA는 참가자와 보호자의 개인정보를 공모 운영에 필요한 범위에서만 수집하고, 이 방침에 따라 보호합니다.",
    en: "GYCA collects personal data from participants and guardians only to the extent needed to run its competitions, and protects it as set out here.",
  },
  effectiveDate: "2026-10-09",
  sections: [
    {
      id: "controller",
      heading: { ko: "개인정보처리자", en: "Who is responsible" },
      body: {
        ko: [
          `이 방침은 ${ORG.name.ko}(이하 "GYCA")가 운영하는 웹사이트 gycaawards.com 및 관련 서비스에 적용됩니다.`,
          {
            list: [
              `사업자명: ${ORG.name.ko}`,
              `대표자: ${ORG.ceo.ko}`,
              `주소: ${ORG.address.ko}`,
              `사업자등록번호: ${ORG.bizNo}`,
              `개인정보 보호책임자 연락처: ${ORG.email}`,
            ],
          },
        ],
        en: [
          `This policy applies to the website gycaawards.com and related services operated by ${ORG.name.en} ("GYCA"), the data controller.`,
          {
            list: [
              `Business name: ${ORG.name.en}`,
              `Representative: ${ORG.ceo.en}`,
              `Address: ${ORG.address.en}`,
              `Business registration no.: ${ORG.bizNo}`,
              `Privacy officer: ${ORG.email}`,
            ],
          },
        ],
      },
    },
    {
      id: "data",
      heading: { ko: "수집하는 개인정보와 수집 방법", en: "What we collect and how" },
      body: {
        ko: [
          "GYCA는 다음 정보를 이용자가 직접 입력하거나 서비스 이용 과정에서 자동으로 수집합니다.",
          {
            list: [
              "계정: 이름, 이메일, 비밀번호(암호화 저장). 소셜 로그인(Google, Microsoft, Facebook, Kakao) 이용 시 해당 서비스가 제공하는 이름, 이메일, 프로필 사진, 계정 식별자.",
              "공모 접수: 참가자 이름(국문·영문), 생년월일, 거주 국가, 국적, 학교, 학년, 작품 제목·설명·창작자 소개, 출품 파일(이미지·PDF 등).",
              "보호자 동의: 미성년 참가자의 보호자 이름, 이메일, 동의 일시, 동의한 문서 버전.",
              "결제: 주문 내역, 결제 금액·수단·승인 결과. 카드번호 등 결제 정보는 결제대행사가 처리하며 GYCA 서버에 저장하지 않습니다.",
              "자동 수집: 접속 IP, 브라우저 종류, 접속 일시, 로그인 세션 쿠키, 서비스 이용 기록.",
            ],
          },
          "GYCA는 광고 추적 쿠키나 제3자 분석 쿠키를 사용하지 않으며, 로그인 상태 유지를 위한 필수 쿠키만 사용합니다.",
        ],
        en: [
          "We collect the following data, either because you enter it or automatically while you use the service.",
          {
            list: [
              "Account: name, email, password (stored hashed). With social sign-in (Google, Microsoft, Facebook, Kakao): the name, email, profile picture and account identifier that provider shares.",
              "Competition entries: participant name (native and English), date of birth, country of residence, nationality, school, grade, work title, description, creator bio, and the submitted files (images, PDFs, etc.).",
              "Guardian consent: for minors, the guardian's name, email, time of consent and the document version consented to.",
              "Payments: order history, amount, method and authorisation result. Card numbers and similar payment credentials are handled by our payment processor and never stored on GYCA servers.",
              "Automatically: IP address, browser type, access times, the login session cookie and usage logs.",
            ],
          },
          "We do not use advertising or third-party analytics cookies. The only cookie we set is the strictly necessary session cookie that keeps you signed in.",
        ],
      },
    },
    {
      id: "purpose",
      heading: { ko: "이용 목적과 법적 근거", en: "Why we use it and on what basis" },
      body: {
        ko: [
          {
            list: [
              "회원 식별, 로그인, 계정 보호 (계약 이행)",
              "공모 접수 관리, 자격 확인, 심사, 결과 통보 (계약 이행)",
              "참가비 결제, 영수증 발급, 환불 처리 (계약 이행 및 법령상 의무)",
              "미성년 참가자의 보호자 동의 확보 (법령상 의무)",
              "수상작·선정작의 전시, 도록, 홍보 매체 게재 (별도 동의)",
              "공지, 접수 안내, 결과 안내 이메일 발송 (계약 이행)",
              "부정 접수 방지, 보안 사고 대응, 분쟁 처리 (정당한 이익 및 법령상 의무)",
            ],
          },
          "GYCA는 수집 목적 외로 개인정보를 이용하지 않으며, 목적이 변경되면 별도 동의를 받습니다.",
        ],
        en: [
          {
            list: [
              "Identifying you, signing you in and protecting your account (performance of a contract)",
              "Managing entries, checking eligibility, judging and notifying results (performance of a contract)",
              "Taking entry fees, issuing receipts and processing refunds (contract and legal obligations)",
              "Obtaining guardian consent for minors (legal obligation)",
              "Exhibiting, publishing and promoting awarded or selected works (separate consent)",
              "Sending notices, entry and results emails (performance of a contract)",
              "Preventing fraud, handling security incidents and resolving disputes (legitimate interests and legal obligations)",
            ],
          },
          "We do not use personal data for purposes other than those listed. If a purpose changes, we ask for your consent again.",
        ],
      },
    },
    {
      id: "minors",
      heading: { ko: "아동·청소년의 개인정보", en: "Children and young people" },
      body: {
        ko: [
          "GYCA 공모는 청소년을 대상으로 합니다. 대한민국의 만 14세 미만, 유럽경제지역(EEA)의 만 16세 미만 등 각 지역 법령이 정한 연령 미만의 참가자는 보호자의 동의가 있어야 접수를 완료할 수 있습니다.",
          "보호자 동의는 참가자가 입력한 보호자 이메일로 발송되는 링크를 통해 받으며, 동의자의 이름, 동의 일시, 동의 문서 버전을 증빙으로 보관합니다. 보호자는 언제든지 동의를 철회할 수 있고, 철회 시 해당 접수는 더 이상 진행되지 않습니다.",
        ],
        en: [
          "GYCA competitions are aimed at young people. Participants below the age set by their local law (for example under 14 in Korea or under 16 in the European Economic Area) can only complete an entry with a guardian's consent.",
          "We obtain that consent through a link sent to the guardian's email address entered by the participant, and keep the guardian's name, time of consent and document version as evidence. A guardian may withdraw consent at any time, after which the entry will not proceed.",
        ],
      },
    },
    {
      id: "retention",
      heading: { ko: "보관 기간", en: "How long we keep it" },
      body: {
        ko: [
          {
            list: [
              "계정 정보: 회원 탈퇴 또는 삭제 요청 처리 시까지",
              "공모 접수 정보와 출품 파일: 각 공모의 접수 안내에 명시된 보관 정책에 따라, 심사·결과 발표·전시 종료 후 정해진 기간이 지나면 파기",
              "보호자 동의 및 결제 증빙: 각 공모의 보관 정책 및 관련 법령이 정한 기간 (전자상거래법상 계약·결제 기록 5년, 소비자 불만·분쟁 처리 기록 3년)",
              "접속 기록: 통신비밀보호법에 따라 3개월",
            ],
          },
          "보관 기간이 지난 정보는 복구할 수 없는 방법으로 삭제하거나 익명화합니다.",
        ],
        en: [
          {
            list: [
              "Account data: until you close your account or your deletion request is processed",
              "Entry data and submitted files: for the period stated in each competition's retention policy, after judging, results and any exhibition have ended",
              "Guardian consent and payment evidence: for the period required by each competition's retention policy and by law (Korean e-commerce law requires contract and payment records for 5 years and complaint/dispute records for 3 years)",
              "Access logs: 3 months under Korean telecommunications law",
            ],
          },
          "Data past its retention period is deleted irreversibly or anonymised.",
        ],
      },
    },
    {
      id: "processors",
      heading: { ko: "처리 위탁과 국외 이전", en: "Service providers and international transfers" },
      body: {
        ko: [
          "GYCA는 서비스 운영을 위해 다음 사업자에게 개인정보 처리를 위탁하며, 일부는 대한민국 외에 위치합니다. 위탁받는 사업자는 계약에 따라 지시된 목적으로만 정보를 처리합니다.",
          {
            list: [
              "Google Cloud (Google LLC, 서울 리전): 웹사이트 호스팅",
              "Supabase (Supabase Inc., AWS 서울 리전): 데이터베이스",
              "Amazon Web Services: 출품 파일 비공개 저장",
              "토스페이먼츠: 결제 처리",
              "Resend: 안내 이메일 발송",
              "Google, Microsoft, Meta(Facebook), 카카오: 소셜 로그인 인증 (이용자가 선택한 경우)",
            ],
          },
          "수상작 전시나 해외 연계 프로그램을 위해 참가자 정보를 해외 기관에 제공해야 하는 경우, 제공받는 자, 목적, 항목, 보관 기간을 사전에 알리고 별도 동의를 받습니다.",
        ],
        en: [
          "We use the following providers to run the service. Some are located outside the Republic of Korea. Each processes data only on our instructions under a contract.",
          {
            list: [
              "Google Cloud (Google LLC, Seoul region): website hosting",
              "Supabase (Supabase Inc., AWS Seoul region): database",
              "Amazon Web Services: private storage of submitted files",
              "Toss Payments: payment processing",
              "Resend: transactional email",
              "Google, Microsoft, Meta (Facebook), Kakao: social sign-in, only if you choose it",
            ],
          },
          "If participant data must be shared with an overseas partner for an exhibition or affiliated programme, we tell you in advance who receives it, why, which data and for how long, and ask for separate consent.",
        ],
      },
    },
    {
      id: "rights",
      heading: { ko: "이용자의 권리", en: "Your rights" },
      body: {
        ko: [
          "이용자(미성년자의 경우 법정대리인 포함)는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요구하고 동의를 철회할 수 있습니다.",
          {
            list: [
              "계정 정보 수정과 계정 삭제: 로그인 후 설정 페이지(/settings)",
              "접수 데이터의 삭제·파기 요청: 마이페이지(/mypage)의 개인정보 요청 기능. 심사·전시·법령상 보관 의무가 있는 정보는 그 기간이 끝난 뒤 처리됩니다.",
              `이메일 요청: ${ORG.email} (본인 확인 후 10일 이내 회신)`,
            ],
          },
          "EEA·영국 거주자는 GDPR에 따라 데이터 이동권, 처리 반대권, 감독기관 진정권을 추가로 갖습니다. 대한민국 거주자는 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972)에 도움을 요청할 수 있습니다.",
        ],
        en: [
          "You (and, for minors, your legal guardian) may at any time access, correct or delete your personal data, restrict its processing and withdraw consent.",
          {
            list: [
              "Edit your account or delete it: the Settings page (/settings) after signing in",
              "Request deletion of entry data: the privacy request tool on My Page (/mypage). Data we must keep for judging, exhibition or legal reasons is processed once that period ends.",
              `By email: ${ORG.email} (we reply within 10 days after verifying your identity)`,
            ],
          },
          "If you live in the EEA or the UK you also have the GDPR rights to data portability, to object to processing and to lodge a complaint with your supervisory authority. Residents of Korea may contact the Personal Information Infringement Report Center (privacy.kisa.or.kr, 118) or the Personal Information Dispute Mediation Committee (kopico.go.kr).",
        ],
      },
    },
    {
      id: "security",
      heading: { ko: "안전성 확보 조치", en: "How we protect it" },
      body: {
        ko: [
          {
            list: [
              "모든 통신은 HTTPS로 암호화되고, 비밀번호는 복호화할 수 없는 방식으로 저장됩니다.",
              "출품 파일은 외부에서 직접 접근할 수 없는 비공개 저장소에 두고, 기간이 제한된 서명 링크로만 열람합니다.",
              "개인정보 접근 권한은 운영에 필요한 최소 인원에게만 부여하고, 권한 부여·변경 내역을 기록합니다.",
              "심사 과정에서는 참가자 신원을 가린 블라인드 자료만 심사위원에게 제공합니다.",
            ],
          },
        ],
        en: [
          {
            list: [
              "All traffic is encrypted with HTTPS and passwords are stored in a non-reversible form.",
              "Submitted files live in private storage that cannot be reached directly from the internet and are opened only through time-limited signed links.",
              "Access to personal data is limited to the minimum staff needed to run the service, and every grant or change of access is logged.",
              "Judges receive blinded materials with the participant's identity removed.",
            ],
          },
        ],
      },
    },
    {
      id: "changes",
      heading: { ko: "방침의 변경", en: "Changes to this policy" },
      body: {
        ko: [
          "이 방침을 변경할 때는 시행 7일 전(이용자 권리에 중대한 영향이 있는 변경은 30일 전)부터 웹사이트 공지사항에 변경 내용과 시행일을 게시합니다.",
          `문의: ${ORG.email}`,
        ],
        en: [
          "When we change this policy we post the changes and their effective date in the website notices at least 7 days in advance, or 30 days for changes that materially affect your rights.",
          `Questions: ${ORG.email}`,
        ],
      },
    },
  ],
};

export default function PrivacyPage() {
  return <LegalDocument doc={doc} />;
}
