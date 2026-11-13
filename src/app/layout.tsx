import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HN Smart Jobs Explorer | Ask HN: Who is hiring?",
  description:
    "Smartly fetch, parse, search, and filter job postings from Hacker News 'Who is hiring?' threads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-orange-100 selection:text-orange-900">
        {children}
      </body>
    </html>
  );
}

