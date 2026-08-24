import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "ResitKu — Personal Expense & Tax Relief Tracker",
  description: "Track Malaysian personal expenses and tax relief allowances with ease.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ResitKu",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans selection:bg-[#0052FF]/10 selection:text-[#0052FF]">
        {children}
        <Toaster position="bottom-right" richColors closeButton duration={3500} />
      </body>
    </html>
  );
}

