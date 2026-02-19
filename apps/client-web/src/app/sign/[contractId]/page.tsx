import { SigningPageClient } from "./signing-page-client";

export default async function SigningPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <SigningPageClient contractId={contractId} />;
}

