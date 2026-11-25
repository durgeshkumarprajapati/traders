import { WhatsAppSettingsView } from "@/components/admin/whatsapp-settings-view";
import { getWhatsAppProviderConfig } from "@/features/whatsapp/provider";
import { getWhatsAppSettings, listWhatsAppLogs } from "@/features/whatsapp/server/service";

export const metadata = {
  title: "WhatsApp Integration | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminWhatsAppPage() {
  const [settings, logs] = await Promise.all([getWhatsAppSettings(), listWhatsAppLogs()]);
  const cfg = getWhatsAppProviderConfig();

  return (
    <WhatsAppSettingsView
      settings={settings}
      logs={logs}
      providerConfigured={cfg.configured}
    />
  );
}
