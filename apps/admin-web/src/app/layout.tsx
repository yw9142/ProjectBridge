import type { Metadata } from "next";
import FadeContent from "@/components/react-bits/FadeContent";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bridge Admin",
  description: "Bridge platform admin workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <FadeContent blur duration={640} threshold={0}>
          {children}
        </FadeContent>
      </body>
    </html>
  );
}
