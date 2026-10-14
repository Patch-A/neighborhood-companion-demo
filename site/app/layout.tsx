import type { Metadata } from "next";
import "./globals.css";
import AppSurface from "@/components/app-surface";
import "./family.css";

export const metadata: Metadata = {
  title: "�����а� �� �ͼ��˻�����ʽ˵��",
  description: "��Ϥ��Ƭ��̶�ͼ�����������˴������⡢���ջ�Ӧ��",
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
