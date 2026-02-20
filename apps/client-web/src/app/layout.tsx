import type { Metadata } from "next";
import localFont from "next/font/local";
import FadeContent from "@/components/react-bits/FadeContent";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  fallback: ["Noto Sans KR", "Apple SD Gothic Neo", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Bridge Client",
  description: "Bridge client workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={pretendard.className}>
        <FadeContent blur duration={640} threshold={0}>
          {children}
        </FadeContent>
      </body>
    </html>
  );
}
