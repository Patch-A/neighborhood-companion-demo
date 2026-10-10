import type { Metadata } from "next";
import "./globals.css";
import CareApp from "@/components/care-app";

export const metadata: Metadata = {
  title: "邻里有伴 · 温暖日常",
  description: "看社区活动、准备家人文字卡、记录平安，让日常多一点陪伴。",
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
      <body className="antialiased"><CareApp /></body>
    </html>
  );
}
