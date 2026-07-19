import type { Metadata } from "next";
import { TrackerProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrackBetter — Personal Monthly Tracker",
  description:
    "Track money, investments, habits, fitness and monthly progress in one private workspace."
};

const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem('trackbetter-theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
  }
})();`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <TrackerProvider>{children}</TrackerProvider>
      </body>
    </html>
  );
}
