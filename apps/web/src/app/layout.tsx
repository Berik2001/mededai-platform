import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import HeaderNav from "./HeaderNav";

export const metadata: Metadata = {
  title: "Платформа медицинского образования на основе ИИ",
  description: "Изучайте клиническое мышление с помощью случаев и наставничества на основе ИИ.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-bold text-brand-700">
                MedEd<span className="text-slate-900">AI</span>
              </Link>
              <HeaderNav />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
            Только для образовательных целей — не заменяет клиническое суждение.
          </footer>
        </div>
      </body>
    </html>
  );
}
