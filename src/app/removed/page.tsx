import Link from "next/link"

import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"

export default async function RemovedPage({
  searchParams,
}: {
  searchParams?: Promise<{ code?: string }>
}) {
  const sp = searchParams ? await searchParams : undefined
  const code = sp?.code

  return (
    <PageContainer>
      <Stack className="gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Removed From Lobby
          </h1>
          <p className="text-sm text-black/70">
            You were removed from the game lobby by the host.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Session ended</CardTitle>
            <CardDescription>
              {code ? `Lobby code: ${code}` : "Your lobby access has ended."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PrimaryButton asChild className="w-full">
              <Link href="/">Return Home</Link>
            </PrimaryButton>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  )
}
