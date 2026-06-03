import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "皖志愿",
  description: "安徽普通类本科批志愿填报辅助工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
