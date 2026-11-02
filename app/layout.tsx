import type { Metadata } from "next";
import "./globals.css";
import "./mafia.css";
import "@fontsource-variable/cairo";
import "./game-theme.css";

export const metadata: Metadata = {
  title: "مافيا — الليلة فيها خيانة",
  description: "صحابك موجودين؟ الباقي علينا. لعبة مافيا عربية في نفس القعدة، بأدوار سرية وراوي تلقائي. من 4 لـ12 لاعب، من غير تحميل أو حساب.",
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
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
