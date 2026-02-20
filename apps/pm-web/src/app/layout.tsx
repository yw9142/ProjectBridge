import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import FadeContent from "@/components/react-bits/FadeContent";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  fallback: ["Noto Sans KR", "Apple SD Gothic Neo", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Bridge PM",
  description: "Bridge PM Workspace",
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
