import type { Metadata } from "next";
import "./globals.css";
import FadeContent from "@/components/react-bits/FadeContent";

export const metadata: Metadata = {
  title: "Bridge PM",
  description: "Bridge PM Workspace",
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
