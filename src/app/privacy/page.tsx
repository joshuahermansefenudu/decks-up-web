import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"

const LAST_UPDATED = "December 24, 2025"

export default function PrivacyPage() {
  return (
    <PageContainer className="max-w-2xl">
      <Stack className="gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            DecksUp! — Privacy Policy (Web + Ads)
          </h1>
          <p className="text-sm text-black/70">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Overview
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! is a browser-based social guessing game. We are committed
            to providing a fun experience while being transparent about how
            information is handled.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Information We Do Not Collect
          </h2>
          <p className="text-sm text-black/80">DecksUp! does not:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
            <li>Require user accounts or logins</li>
            <li>Collect names, email addresses, or passwords</li>
            <li>Store personal user profiles</li>
          </ul>
          <p className="text-sm text-black/80">
            You can play DecksUp! without creating an account or submitting
            personal details.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Information Collected Automatically
          </h2>
          <p className="text-sm text-black/80">
            When you use DecksUp!, certain non-personal information may be
            collected automatically, including:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
            <li>Browser type and version</li>
            <li>Device type and operating system</li>
            <li>General usage data (such as page interactions)</li>
          </ul>
          <p className="text-sm text-black/80">
            This information is used for basic functionality, performance, and
            understanding how the game is used.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Advertising and Third-Party Services
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! displays advertisements provided by third-party ad
            networks.
          </p>
          <p className="text-sm text-black/80">
            These third-party advertisers may use:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
            <li>Cookies</li>
            <li>Web beacons</li>
            <li>Similar technologies</li>
          </ul>
          <p className="text-sm text-black/80">
            to display ads and measure ad performance. These technologies may
            collect non-personal identifiers such as device information or
            anonymous usage data.
          </p>
          <p className="text-sm text-black/80">
            DecksUp! does not control these third-party technologies and does
            not receive personal information directly from advertisers.
          </p>
          <p className="text-sm text-black/80">
            Users may opt out of personalized advertising through their browser
            or device settings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Cookies
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! does not use cookies for user accounts or login purposes.
            Third-party advertising services may use cookies to serve relevant
            ads.
          </p>
          <p className="text-sm text-black/80">
            You can choose to disable cookies through your browser settings.
            Note that doing so may affect how ads are displayed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Children’s Privacy
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! does not knowingly collect personal information from
            children. However, third-party ad providers may collect information
            as governed by their own privacy policies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Data Sharing
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! does not sell or rent personal data. Any data collected
            through third-party advertising services is governed by the privacy
            policies of those providers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Changes to This Policy
          </h2>
          <p className="text-sm text-black/80">
            This Privacy Policy may be updated as DecksUp! evolves. Updates will
            be posted on this page with a revised date.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Contact
          </h2>
          <p className="text-sm text-black/80">
            If you have questions about this Privacy Policy, please contact:
          </p>
          <p className="text-sm font-semibold text-black">
            business@decksupcard.com
          </p>
        </section>
      </Stack>
    </PageContainer>
  )
}
