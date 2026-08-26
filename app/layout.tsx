import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrappy",
  description: "$20, one task. I do the work. You get the result.",
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
