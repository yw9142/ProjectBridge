import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  fallback: ["Noto Sans KR", "Apple SD Gothic Neo", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Bridge Admin",
  description: "Bridge platform admin workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={pretendard.className}>{children}</body>
    </html>
  );
}
