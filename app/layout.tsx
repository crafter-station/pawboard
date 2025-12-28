import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pawboard.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Pawboard",
  description: "Where ideas land on their feet",
  openGraph: {
    title: "Pawboard",
    description: "Where ideas land on their feet",
    url: siteUrl,
    siteName: "Pawboard",
    images: [
      {
        url: `${siteUrl}/Pawboard_OG.jpg`,
        width: 1200,
        height: 630,
        alt: "Pawboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pawboard",
    description: "Where ideas land on their feet",
    images: [`${siteUrl}/Pawboard_OG.jpg`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
