import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Notification } from "@/components/ui/notification";
import { Badge } from "@/components/ui/badge";
import { loadAdminRateAlerts } from "@/features/admin/server/rate-alerts";
import { formatPaise } from "@/features/rate-alerts/types";
import { rateAlertsAvailable } from "@/features/rate-alerts/actions";

export const metadata = {
  title: "Rate alerts | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

export default async function AdminRateAlertsPage() {
  const providerConfigured = await rateAlertsAvailable();
  const data = await loadAdminRateAlerts();
  return (
    <div className="space-y-gutter-lg">
      <h1 className="text-headline-md font-bold text-primary">Rate alerts</h1>
      {providerConfigured ? (
        <Notification tone="success">
          An email provider is configured. Alerts can be sent.
        </Notification>
      ) : (
        <Notification tone="warning" title="Customer sign-up is switched off">
          No customer email provider is configured, so the public page shows “unavailable” and no
          one can subscribe. Price snapshots still run daily so history is ready when a provider is
          approved.
        </Notification>
      )}
      {!data.ok ? (
        <Notification tone="error">
          Rate-alert data could not be read. Check that the rate-alert migration has been applied.
        </Notification>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-gutter-md md:grid-cols-4">
            {[
              ["Pending confirmation", data.counts.pending],
              ["Active", data.counts.active],
              ["Unsubscribed", data.counts.unsubscribed],
              ["Failed notifications", data.notificationCounts.failed],
            ].map(([label, n]) => (
              <Card key={label as string}>
                <CardBody>
                  <p className="text-body-sm text-on-surface-variant">{label}</p>
                  <p className="text-headline-md font-bold">{n}</p>
                </CardBody>
              </Card>
            ))}
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Last price snapshot: {data.lastSnapshotDate ?? "none yet"} · Notifications sent:{" "}
            {data.notificationCounts.sent} · Waiting to send: {data.notificationCounts.pending}
          </p>
          <Card>
            <CardHeader>
              <CardTitle>Recent subscriptions</CardTitle>
            </CardHeader>
            <CardBody>
              {data.subscriptions.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">No subscriptions.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.subscriptions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-body-sm">
                      <Badge
                        tone={s.status === "ACTIVE" ? "success" : "neutral"}
                        appearance="outline"
                      >
                        {s.status}
                      </Badge>
                      <span className="[overflow-wrap:anywhere]">{s.email}</span>
                      <span className="text-on-surface-variant">
                        {s.productId} ·{" "}
                        {s.alertType === "DROPS_BELOW" && s.targetPricePaise
                          ? `drops to ${formatPaise(s.targetPricePaise)}`
                          : "any change"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent notifications</CardTitle>
            </CardHeader>
            <CardBody>
              {data.notifications.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">No notifications.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.notifications.map((n) => (
                    <li key={n.id} className="flex flex-wrap items-center gap-2 py-2 text-body-sm">
                      <Badge
                        tone={
                          n.status === "SENT"
                            ? "success"
                            : n.status === "FAILED"
                              ? "error"
                              : "neutral"
                        }
                        appearance="outline"
                      >
                        {n.status}
                      </Badge>
                      <span>
                        {n.snapshotDate} · {formatPaise(n.priceToPaise)} · {n.attempts} attempt(s)
                      </span>
                      {n.lastError && (
                        <span className="text-error [overflow-wrap:anywhere]">{n.lastError}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
