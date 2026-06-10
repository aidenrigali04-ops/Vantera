import type { Metadata } from "next";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vantera",
  description: "Automated sales intelligence for service businesses — nurture, sell, and deliver under your brand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
