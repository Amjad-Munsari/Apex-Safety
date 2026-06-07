import type { Metadata } from "next"
import { SignFlow } from "@/components/sign/sign-flow"

export const metadata: Metadata = {
  title: "Sign your proposal — 888 Safety & Training",
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <SignFlow token={token} />
}
