import type { Metadata, Viewport } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  variable: "--font-frank",
  display: "swap",
});

export const metadata: Metadata = {
  title: "יונה — סוכנת סושיאל",
  description: "Social Swiss Army Knife — יצירת פוסטים ותמונות עם יונה",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f7f3ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable}`}>
      <body
        className="min-h-full antialiased"
        style={
          {
            "--font-body": "var(--font-heebo), Heebo, sans-serif",
            "--font-display": "var(--font-frank), Frank Ruhl Libre, serif",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
