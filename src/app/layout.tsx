import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Bebas_Neue, Quicksand, Manrope, DM_Serif_Display } from "next/font/google";
import LocaleProvider from "@/components/i18n/LocaleProvider";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  OG_LOCALE,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import "./globals.css";

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Extracted from reference site (myslide.org) via extract-design-system
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Serif titles — matches the reference site (myslide.org uses DM Serif Display)
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const l = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value) === "ko" ? "ko" : "en";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_TITLE[l], template: "%s | GYCA" },
    description: SITE_DESCRIPTION[l],
    applicationName: "GYCA",
    keywords: SITE_KEYWORDS,
    authors: [{ name: "GYCA", url: SITE_URL }],
    creator: "GYCA",
    publisher: "GYCA (Global Young Creators Award)",
    category: "education",
    openGraph: {
      type: "website",
      siteName: SITE_NAME[l],
      title: SITE_TITLE[l],
      description: SITE_DESCRIPTION[l],
      url: SITE_URL,
      locale: OG_LOCALE[l],
      alternateLocale: l === "ko" ? ["en_US"] : ["ko_KR"],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE[l],
      description: SITE_DESCRIPTION[l],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification: {
      google: "D-aLcR1qYRcrIWZeggeUgLlDDeq4emWHSnX-G5QGsko",
      other: {
        "naver-site-verification": "e07865ae34ae0ac597c5e2bf97cd64634d24f5a5",
      },
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  return (
    <html
      lang={locale}
      className={`${bebas.variable} ${quicksand.variable} ${manrope.variable} ${dmSerif.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/simple-line-icons/2.5.5/css/simple-line-icons.min.css"
        />
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd(), websiteJsonLd()]),
          }}
        />
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
