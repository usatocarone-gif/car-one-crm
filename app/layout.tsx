import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car One CRM",
  description: "Controllo commerciale giornaliero Car One",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
