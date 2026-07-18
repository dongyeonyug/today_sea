import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘의 바다",
  description: "공식 해양 데이터로 물놀이·갯벌체험 안전을 판정하고 초보자 눈높이로 설명합니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
