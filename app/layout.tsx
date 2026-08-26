import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "zstd dictionary kit",
  description:
    "A Python CLI that trains a zstd dictionary and benches it on a holdout. $12 one-time download on Polar (SenWorks).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
