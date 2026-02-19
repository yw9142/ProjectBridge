import { SigningPageClient } from "./signing-page-client";

export default async function SigningPage({
  params,
}: {
  params: Promise<{ recipientToken: string }>;
}) {
  const { recipientToken: contractId } = await params;
  return <SigningPageClient contractId={contractId} />;
}
