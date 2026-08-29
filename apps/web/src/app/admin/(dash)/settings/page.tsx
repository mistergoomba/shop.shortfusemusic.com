import { getSettings } from "@/lib/admin-data";
import { PageHeading } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store settings" };

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeading>Store settings</PageHeading>
      <SettingsForm
        initial={{
          storeName: settings.storeName,
          contactEmail: settings.contactEmail,
          shippingUsCents: settings.shippingUsCents,
          shippingCaCents: settings.shippingCaCents,
          shippingIntlCents: settings.shippingIntlCents,
          internationalShippingEnabled: settings.internationalShippingEnabled,
          freeShippingThresholdCents: settings.freeShippingThresholdCents,
        }}
      />
    </>
  );
}
