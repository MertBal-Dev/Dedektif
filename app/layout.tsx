import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Courier_Prime } from "next/font/google";
import "./globals.css";
import { GameProvider } from "@/features/GameContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

const courier = Courier_Prime({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Dedektif | AI Destekli Polisiye Macera",
  description: "Yapay zeka tarafından oluşturulan gizemleri çözün, katili bulun.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${courier.variable} antialiased`}
      >
        <GameProvider>
          {children}
        </GameProvider>
      </body>
    </html>
  );
}
