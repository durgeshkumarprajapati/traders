import { SettingsForm } from "@/components/admin/settings-form";
import { loadAdminCatalogue } from "@/features/catalogue/server";

export const metadata = {
  title: "Business Settings | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const catResult = await loadAdminCatalogue();

  if (!catResult.ok) {
    return (
      <div className="rounded-md border border-error/40 bg-error/10 p-6 text-error">
        <h2 className="text-title-lg font-bold">Settings Unavailable</h2>
        <p className="mt-1 text-body-md">
          Google Sheets settings could not be loaded ({catResult.error}). Please verify credentials
          and spreadsheet connectivity.
        </p>
      </div>
    );
  }

  const { settings } = catResult.snapshot;

  return <SettingsForm initialSettings={settings} />;
}
