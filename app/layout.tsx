import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hot Take Protocol — GenLayer Multiplayer Debate Game",
  description:
    "5-player debate game powered by GenLayer's Intelligent Contracts. Submit hot takes, vote on the best arguments, and let AI validators decide the winner. Fast, fun, and replayable.",
  keywords: [
    "GenLayer",
    "debate game",
    "AI validators",
    "multiplayer",
    "hot takes",
    "blockchain game",
    "intelligent contracts",
  ],
  authors: [{ name: "Temmygabriel" }],
  openGraph: {
    title: "Hot Take Protocol",
    description:
      "5-player debate game where AI validators pick the best hot takes. Fast, fun, and powered by GenLayer.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hot Take Protocol",
    description:
      "5-player debate game where AI validators pick the best hot takes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F5F7FA" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
