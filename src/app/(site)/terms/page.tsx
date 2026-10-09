"use client";

import LegalDocument, { type LegalDocumentData } from "@/components/site/LegalDocument";

// 이용약관. 공모별 세부 규정(자격, 일정, 참가비, 보관 기간)은 각 공모 안내가 우선하며,
// 이 약관은 모든 공모와 계정에 공통으로 적용되는 조건을 정한다. 수정 시 effectiveDate 갱신.

const ORG = {
  name: { ko: "글로벌 영 크리에이트 어워드 (GYCA)", en: "Global Young Create Awards (GYCA)" },
  email: "admin@gyca.org",
};

const doc: LegalDocumentData = {
  eyebrow: "Terms",
  title: { ko: "이용약관", en: "Terms of Service" },
  description: {
    ko: "GYCA 웹사이트와 공모전 참가에 적용되는 조건입니다. 계정을 만들거나 접수를 진행하면 이 약관에 동의한 것으로 봅니다.",
    en: "These terms govern the GYCA website and participation in its competitions. By creating an account or submitting an entry you agree to them.",
  },
  effectiveDate: "2026-10-09",
  sections: [
    {
      id: "scope",
      heading: { ko: "목적과 적용 범위", en: "Scope" },
      body: {
        ko: [
          `이 약관은 ${ORG.name.ko}(이하 "GYCA")가 운영하는 gycaawards.com(이하 "사이트")의 이용과 GYCA가 주최하는 공모전 참가에 적용됩니다.`,
          "각 공모의 접수 안내(자격, 부문, 일정, 참가비, 제출 형식, 보관 정책)는 이 약관의 일부이며, 안내와 약관이 충돌하면 해당 공모에 한해 접수 안내가 우선합니다.",
        ],
        en: [
          `These terms apply to the use of gycaawards.com (the "Site") operated by ${ORG.name.en} ("GYCA") and to participation in competitions GYCA organises.`,
          "Each competition's call for entries (eligibility, categories, schedule, fees, submission format and retention policy) forms part of these terms. Where the two conflict, the call for entries prevails for that competition.",
        ],
      },
    },
    {
      id: "accounts",
      heading: { ko: "계정", en: "Accounts" },
      body: {
        ko: [
          {
            list: [
              "접수를 위해서는 계정이 필요합니다. 이메일·비밀번호 또는 Google, Microsoft, Facebook, Kakao 계정으로 가입할 수 있으며, 같은 이메일의 소셜 로그인은 기존 계정에 연결됩니다.",
              "계정 정보는 정확하게 입력해야 하며, 타인의 정보로 계정을 만들거나 계정을 양도·공유할 수 없습니다.",
              "비밀번호와 로그인 상태는 이용자가 관리하며, 계정 도용이 의심되면 즉시 GYCA에 알려야 합니다.",
              "미성년자는 각 지역 법령이 정한 연령에 따라 보호자 동의가 있어야 접수를 완료할 수 있습니다. 보호자는 미성년자의 접수에 관해 이 약관을 함께 승낙합니다.",
            ],
          },
        ],
        en: [
          {
            list: [
              "You need an account to enter. You can sign up with email and password or with a Google, Microsoft, Facebook or Kakao account; a social sign-in with the same email is linked to your existing account.",
              "Account details must be accurate. You may not create an account with someone else's details or transfer or share your account.",
              "You are responsible for your password and signed-in sessions and must tell GYCA at once if you suspect misuse.",
              "Minors can complete an entry only with guardian consent as required by their local law. By consenting, the guardian also accepts these terms on the minor's behalf.",
            ],
          },
        ],
      },
    },
    {
      id: "entries",
      heading: { ko: "접수와 출품작", en: "Entries and submitted works" },
      body: {
        ko: [
          {
            list: [
              "참가자는 각 공모의 자격 요건(연령, 거주지, 부문 등)을 충족해야 하며, 허위 정보로 접수한 경우 심사 제외 및 수상 취소가 될 수 있습니다.",
              "출품작은 참가자 본인의 창작물이어야 합니다. 타인의 저작물·초상·상표를 허락 없이 사용하거나 표절한 작품은 실격됩니다.",
              "생성형 AI 등 도구의 사용 가능 여부와 고지 의무는 각 공모 안내에 따릅니다.",
              "접수 마감 후에는 출품작과 접수 정보를 변경할 수 없습니다. 마감 전 철회는 마이페이지에서 할 수 있습니다.",
              "GYCA는 제출 형식에 맞지 않거나 손상된 파일, 유해·불법 콘텐츠를 포함한 접수를 거부할 수 있습니다.",
            ],
          },
        ],
        en: [
          {
            list: [
              "Participants must meet each competition's eligibility rules (age, residence, category and so on). Entries made with false information may be excluded from judging and any award withdrawn.",
              "Submitted works must be the participant's own creation. Works that use others' copyrighted material, likeness or trademarks without permission, or that are plagiarised, are disqualified.",
              "Whether generative AI or similar tools may be used, and whether their use must be disclosed, is set by each call for entries.",
              "Entries and entry details cannot be changed after the deadline. Before the deadline you may withdraw an entry from My Page.",
              "GYCA may refuse entries that do not meet the submission format, that are corrupted, or that contain harmful or unlawful content.",
            ],
          },
        ],
      },
    },
    {
      id: "fees",
      heading: { ko: "참가비와 환불", en: "Fees and refunds" },
      body: {
        ko: [
          {
            list: [
              "참가비 금액, 통화, 결제 수단은 각 공모 안내에 표시되며, 결제는 결제대행사를 통해 처리됩니다.",
              "결제가 확인된 시점에 접수가 완료됩니다. 결제 확인 전의 접수는 '제출됨' 상태로 유지되며 심사 대상이 아닙니다.",
              "접수 마감 전 철회 시 참가비는 전액 환불됩니다. 마감 후에는 심사가 시작되므로 환불되지 않습니다. 다만 GYCA의 사유로 공모가 취소되거나 결제 오류가 있는 경우에는 전액 환불합니다.",
              "환불은 원래 결제 수단으로 처리되며, 결제대행사 사정에 따라 영업일 기준 3~10일이 걸릴 수 있습니다.",
            ],
          },
        ],
        en: [
          {
            list: [
              "Fee amounts, currency and payment methods are shown in each call for entries. Payments are processed by our payment provider.",
              "An entry is complete when payment is confirmed. Until then it stays in 'submitted' status and is not judged.",
              "If you withdraw before the deadline the fee is refunded in full. After the deadline judging begins and fees are non-refundable, except that GYCA refunds in full if it cancels the competition or a payment error occurred.",
              "Refunds go back to the original payment method and may take 3 to 10 business days depending on the provider.",
            ],
          },
        ],
      },
    },
    {
      id: "ip",
      heading: { ko: "저작권과 이용 허락", en: "Copyright and licence" },
      body: {
        ko: [
          "출품작의 저작권은 참가자에게 있습니다. GYCA는 출품작의 저작권을 취득하지 않습니다.",
          "참가자는 접수와 동시에 GYCA에 다음 범위의 비독점적, 무상의 이용을 허락합니다.",
          {
            list: [
              "심사, 자격 확인, 기록 보관을 위한 복제·저장",
              "수상작·선정작에 한해 전시, 도록, 웹사이트·SNS·보도자료 등 홍보 매체에 참가자 이름과 작품 정보를 함께 게재",
            ],
          },
          "전시·홍보 이용의 구체적 범위와 기간은 각 공모 안내에 명시하며, 참가자는 접수 과정에서 이에 별도로 동의합니다. 상업적 판매나 이 범위를 넘는 이용은 참가자와 별도로 협의합니다.",
        ],
        en: [
          "Copyright in a submitted work stays with the participant. GYCA does not acquire ownership of any work.",
          "By entering, the participant grants GYCA a non-exclusive, royalty-free licence to:",
          {
            list: [
              "reproduce and store the work for judging, eligibility checks and record keeping;",
              "for awarded or selected works only, display and reproduce the work with the participant's name and work details in exhibitions, catalogues, the website, social media and press materials.",
            ],
          },
          "The exact scope and duration of exhibition and promotional use is stated in each call for entries, and participants consent to it separately during entry. Commercial sale or any use beyond this scope is agreed with the participant individually.",
        ],
      },
    },
    {
      id: "judging",
      heading: { ko: "심사와 결과", en: "Judging and results" },
      body: {
        ko: [
          {
            list: [
              "심사는 참가자 신원을 가린 상태로 GYCA가 위촉한 심사위원이 진행하며, 심사 기준은 각 공모 안내에 공개합니다.",
              "심사 결과는 사이트와 이메일로 통보합니다. 심사 과정과 개별 점수는 공개하지 않으며, 결과에 대한 이의는 명백한 자격·절차 오류에 한해 결과 발표 후 14일 이내에 이메일로 접수합니다.",
              "수상 이후라도 자격 미달, 표절, 허위 정보가 확인되면 수상을 취소하고 상금·상장의 반환을 요구할 수 있습니다.",
            ],
          },
        ],
        en: [
          {
            list: [
              "Judging is carried out blind by judges appointed by GYCA, using the criteria published in each call for entries.",
              "Results are announced on the Site and by email. Deliberations and individual scores are not disclosed. Appeals are accepted by email within 14 days of the announcement and only for clear eligibility or procedural errors.",
              "If ineligibility, plagiarism or false information comes to light after an award, GYCA may withdraw the award and require the return of any prize or certificate.",
            ],
          },
        ],
      },
    },
    {
      id: "conduct",
      heading: { ko: "금지 행위와 이용 제한", en: "Prohibited conduct" },
      body: {
        ko: [
          "다음 행위는 금지되며, 위반 시 경고 없이 접수 취소, 계정 정지 또는 삭제가 될 수 있습니다.",
          {
            list: [
              "타인의 계정·정보 도용, 허위 정보 제출, 다중 계정을 이용한 중복 접수",
              "심사위원이나 운영진에 대한 부정한 청탁, 결과 조작 시도",
              "사이트의 정상 운영을 방해하는 자동화 접근, 취약점 악용, 과도한 요청",
              "다른 참가자나 운영진에 대한 괴롭힘, 혐오 표현, 불법 콘텐츠 게시",
            ],
          },
        ],
        en: [
          "The following is prohibited and may lead to cancellation of entries and suspension or deletion of the account without notice:",
          {
            list: [
              "using another person's account or details, submitting false information, or entering more than once through multiple accounts;",
              "attempting to influence judges or staff improperly or to manipulate results;",
              "automated access, exploitation of vulnerabilities or excessive requests that disrupt the Site;",
              "harassment, hate speech or unlawful content directed at other participants or staff.",
            ],
          },
        ],
      },
    },
    {
      id: "liability",
      heading: { ko: "책임의 한계", en: "Liability" },
      body: {
        ko: [
          {
            list: [
              "GYCA는 천재지변, 통신 장애, 결제대행사·호스팅 사업자의 장애 등 합리적으로 통제할 수 없는 사유로 발생한 손해에 책임지지 않습니다. 다만 그로 인해 접수가 불가능했던 경우 마감을 연장하는 등 합리적인 구제 조치를 취합니다.",
              "GYCA는 사이트를 사전 공지 후 변경·중단할 수 있으며, 긴급한 보안 조치는 사후 공지할 수 있습니다.",
              "참가자가 이 약관을 위반하여 제3자와 분쟁이 생기면 참가자가 책임지며, GYCA가 입은 손해를 배상해야 합니다.",
              "이 조항은 고의·중과실로 인한 책임이나 소비자 관련 법령이 배제를 허용하지 않는 책임을 제한하지 않습니다.",
            ],
          },
        ],
        en: [
          {
            list: [
              "GYCA is not liable for loss caused by events beyond its reasonable control such as natural disasters, network failures or outages at the payment or hosting provider. Where such an event prevented entries, GYCA takes reasonable remedial steps such as extending the deadline.",
              "GYCA may change or suspend the Site with prior notice; urgent security measures may be announced afterwards.",
              "If a participant's breach of these terms leads to a dispute with a third party, the participant is responsible and must compensate GYCA for any resulting loss.",
              "Nothing in this section limits liability for intent or gross negligence, or any liability that consumer law does not allow to be excluded.",
            ],
          },
        ],
      },
    },
    {
      id: "law",
      heading: { ko: "준거법과 분쟁 해결", en: "Governing law and disputes" },
      body: {
        ko: [
          "이 약관은 대한민국 법률에 따라 해석됩니다. 분쟁은 먼저 이메일 협의로 해결하도록 노력하며, 해결되지 않으면 서울중앙지방법원을 1심 관할 법원으로 합니다.",
          "대한민국 외 거주자가 자국 소비자 보호 법령에 따라 갖는 권리는 이 조항으로 제한되지 않습니다.",
        ],
        en: [
          "These terms are governed by the laws of the Republic of Korea. We try to resolve disputes by email first; failing that, the Seoul Central District Court has first-instance jurisdiction.",
          "If you live outside Korea, nothing in this section limits the rights you have under the consumer protection laws of your country.",
        ],
      },
    },
    {
      id: "changes",
      heading: { ko: "약관의 변경과 문의", en: "Changes and contact" },
      body: {
        ko: [
          "약관을 변경할 때는 시행 7일 전(이용자에게 불리한 변경은 30일 전)부터 사이트 공지사항에 게시합니다. 변경 후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다. 진행 중인 공모에는 접수 당시의 약관과 공모 안내가 적용됩니다.",
          `문의: ${ORG.email}`,
        ],
        en: [
          "Changes are posted in the Site notices at least 7 days before they take effect, or 30 days for changes unfavourable to users. Continuing to use the service after that date means you accept the new terms. Competitions already under way remain subject to the terms and call for entries in force when you entered.",
          `Contact: ${ORG.email}`,
        ],
      },
    },
  ],
};

export default function TermsPage() {
  return <LegalDocument doc={doc} />;
}
