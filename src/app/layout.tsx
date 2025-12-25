import type { Metadata } from "next"
import Link from "next/link"
import { Bungee, Space_Grotesk } from "next/font/google"
import Script from "next/script"
import "./globals.css"

const displayFont = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
})

const bodyFont = Space_Grotesk({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "Decks Up!",
  description: "A playful, neon-brutalist party game for your phone.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-8332039790897527" />
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-2GV74H3YS1"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-2GV74H3YS1');
          `}
        </Script>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8332039790897527"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${displayFont.variable} ${bodyFont.variable} antialiased`}
      >
        {process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? (
          <Script
            async
            strategy="afterInteractive"
            // TODO: Replace the env value with your real AdSense client ID after deploy.
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <div className="mx-auto w-full max-w-md px-4 pb-4 text-center text-xs text-black/50">
            By playing DecksUp!, you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            &{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            . Ads help keep the game free.
          </div>
          <footer className="mx-auto w-full max-w-md px-4 pb-8 text-xs text-black/70">
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="underline">
                Privacy
              </Link>
              <Link href="/terms" className="underline">
                Terms
              </Link>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60">
              <span>For advertisement or info:</span>
              <a
                className="inline-flex items-center rounded-full border-2 border-black bg-offwhite px-3 py-1 text-xs font-semibold text-black shadow-[2px_2px_0_#000]"
                href="mailto:business@decksupcard.com"
              >
                business@decksupcard.com
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
