import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Comlabs CMS", template: "%s · Comlabs CMS" },
  description: "A multi-tenant, AI-native CMS with a REST API, an MCP server and a React SDK.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
