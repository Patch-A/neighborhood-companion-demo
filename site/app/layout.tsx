import type { Metadata } from "next";
import "./globals.css";
import AppSurface from "@/components/app-surface";
import "./family.css";

export const metadata: Metadata = {
  title: "邻里有伴 · 和家人换个方式说话",
  description: "熟悉照片与固定图卡，帮助家人传递心意、接收回应。",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><AppSurface /></body>
    </html>
  );
}
