import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchulWatch One – Schule. Einfach. Digital.",
  description: "Schulorganisation an einem Ort. Sicher, übersichtlich und für Schulen entwickelt.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
