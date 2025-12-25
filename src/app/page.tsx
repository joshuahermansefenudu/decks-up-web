import Link from "next/link"

import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

export default function HomePage() {
  return (
    <PageContainer>
      <Stack className="gap-6">
        <header className="space-y-3">
          <Badge className="w-fit">mobile party game</Badge>
          <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
            Decks Up!
          </h1>
          <p className="text-base text-black/70">
            Create a quick lobby, snap your best cards, and get ready for chaos.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Start a round</CardTitle>
            <CardDescription>
              Create a new game or jump into one with a code.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <PrimaryButton asChild>
              <Link href="/create">Create Game</Link>
            </PrimaryButton>
            <SecondaryButton asChild>
              <Link href="/join">Join Game</Link>
            </SecondaryButton>
          </CardContent>
        </Card>

        <div className="sticker-card p-4 text-sm text-black/70">
          Gather 2+ friends on phones, upload a couple of photos, and get ready
          to play.
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to play</CardTitle>
            <CardDescription>Quick visual overview of the rules.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border-2 border-black bg-offwhite shadow-[4px_4px_0_#000]">
              <img
                src="/how-to-play.png"
                alt="How to play Decks Up"
                className="h-auto w-full object-contain"
                loading="lazy"
              />
            </div>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  )
}
