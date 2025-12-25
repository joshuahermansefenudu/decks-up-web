import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"

const LAST_UPDATED = "December 24, 2025"

export default function TermsPage() {
  return (
    <PageContainer className="max-w-2xl">
      <Stack className="gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            DecksUp! — Terms & Conditions (Web)
          </h1>
          <p className="text-sm text-black/70">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Acceptance of Terms
          </h2>
          <p className="text-sm text-black/80">
            By accessing or using DecksUp! (the “Game”), you agree to these
            Terms & Conditions. If you do not agree, please do not use the Game.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Use of the Game
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! is a free, browser-based social guessing game provided for
            entertainment purposes. You agree to use the Game in a lawful and
            respectful manner.
          </p>
          <p className="text-sm text-black/80">You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
            <li>Abuse, disrupt, or attempt to interfere with the Game</li>
            <li>Exploit bugs or attempt to manipulate gameplay</li>
            <li>Use the Game for unlawful or harmful activities</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            No Accounts or User Data
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! does not require user accounts, logins, or the submission
            of personal information. Gameplay is provided without user
            registration.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Advertising
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! displays third-party advertisements. We are not responsible
            for the content, accuracy, or practices of third-party advertisers.
          </p>
          <p className="text-sm text-black/80">
            Interactions with advertisers are solely between you and the
            advertiser.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Intellectual Property
          </h2>
          <p className="text-sm text-black/80">
            All content associated with DecksUp!, including but not limited to:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
            <li>Game mechanics</li>
            <li>Decks and card content</li>
            <li>Text, visuals, and branding</li>
          </ul>
          <p className="text-sm text-black/80">
            are the property of DecksUp! and may not be copied, modified,
            distributed, or used without permission.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Availability and Changes
          </h2>
          <p className="text-sm text-black/80">
            DecksUp! is provided on an “as is” and “as available” basis. We do
            not guarantee uninterrupted access, bug-free operation, or
            continuous availability.
          </p>
          <p className="text-sm text-black/80">
            We reserve the right to modify, suspend, or discontinue the Game at
            any time without notice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Limitation of Liability
          </h2>
          <p className="text-sm text-black/80">
            To the maximum extent permitted by law, DecksUp! shall not be liable
            for any damages arising from:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
            <li>Use or inability to use the Game</li>
            <li>Errors, interruptions, or bugs</li>
            <li>Third-party advertisements or links</li>
          </ul>
          <p className="text-sm text-black/80">
            Use of the Game is at your own risk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            External Links
          </h2>
          <p className="text-sm text-black/80">
            The Game may contain links to third-party websites or services.
            DecksUp! is not responsible for the content or practices of those
            external sites.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Changes to These Terms
          </h2>
          <p className="text-sm text-black/80">
            These Terms & Conditions may be updated from time to time. Changes
            will be posted on this page with a revised date.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Governing Law
          </h2>
          <p className="text-sm text-black/80">
            These Terms are governed by the laws of the applicable jurisdiction
            where DecksUp! operates.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold uppercase tracking-wide">
            Contact
          </h2>
          <p className="text-sm text-black/80">
            For questions regarding these Terms & Conditions, please contact:
          </p>
          <p className="text-sm font-semibold text-black">
            business@decksupcard.com
          </p>
        </section>
      </Stack>
    </PageContainer>
  )
}
