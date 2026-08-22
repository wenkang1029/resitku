import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResitKu — Personal Expense & Tax Relief Tracker",
  description: "Track Malaysian personal expenses and tax relief allowances with ease.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans selection:bg-[#0052FF]/10 selection:text-[#0052FF]">
        {children}
      </body>
    </html>
  );
}
