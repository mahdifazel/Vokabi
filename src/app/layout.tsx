import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

// display face for titles and the wordmark; body text stays Nunito
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vokabi - German Vocabulary Trainer",
  description:
    "Learn German words with native pronunciation, practice speaking, and organize your vocabulary.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vokabi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0f1a" },
  ],
};

const themeScript = `
(function () {
  try {
    var s = JSON.parse(localStorage.getItem("vokabi.settings") || "{}");
    var t = s.theme || "dark";
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${nunito.variable} ${baloo.variable} font-sans antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
