import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bridge PM",
  description: "Bridge PM Workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

