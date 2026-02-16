import { redirect } from "next/navigation";

export default async function TenantPmUsersRedirect({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/admin/tenants/${tenantId}`);
}