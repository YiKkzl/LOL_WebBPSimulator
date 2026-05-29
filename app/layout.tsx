import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOL BP模拟器",
  description: "英雄联盟 BP 模拟器，支持竞技征召、全局 BP 和多角色协作。",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
