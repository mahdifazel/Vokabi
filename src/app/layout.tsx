import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

// Self-hosted rather than next/font/google: that fetches the files during
// `next build`, so a bad moment at Google's end fails the build and takes the
// deploy with it. See src/app/fonts/README.md for what these files are and
// how to regenerate them. One variable file per family covers every weight.
const nunito = localFont({
  src: "./fonts/Nunito-Variable.woff2",
  variable: "--font-nunito",
  weight: "200 1000",
  display: "swap",
});

// display face for titles and the wordmark; body text stays Nunito
const baloo = localFont({
  src: "./fonts/Baloo2-Variable.woff2",
  variable: "--font-baloo",
  weight: "400 800",
  display: "swap",
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
