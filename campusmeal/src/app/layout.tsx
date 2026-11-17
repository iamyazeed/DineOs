import type { Metadata } from "next";
import { JetBrains_Mono, Montserrat } from "next/font/google";
import { themeScript } from "@/components/layouts/theme-toggle";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-montserrat" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "DineOS — Campus Dining Operations", template: "%s · DineOS" },
  description: "Campus canteen operations: meal planning, attendance, kitchen preparation and table-wise distribution.",
  other: { "theme-color": "#0d382f" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${montserrat.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
