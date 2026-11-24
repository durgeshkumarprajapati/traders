"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notification } from "@/components/ui/notification";
import { confirmRateAlertAction, unsubscribeRateAlertAction } from "@/features/rate-alerts/actions";

/** The token lives in the URL fragment, so it is never sent to the server in the page request, logs or Referer headers. */
function readToken(): string | null {
  const m = /(?:^#|&)t=([A-Za-z0-9_]+)/.exec(window.location.hash);
  return m ? m[1] : null;
}

export function TokenAction({ mode }: { mode: "confirm" | "unsubscribe" }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "working" | "done" | "notfound" | "error">("idle");

  useEffect(() => {
    const t = readToken();
    // Remove the credential from the address bar and history once read.
    if (t) window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fragment is only readable in the browser
    setToken(t);
  }, []);

  async function run() {
    if (!token) return;
    setState("working");
    try {
      if (mode === "confirm") setState((await confirmRateAlertAction(token)) ? "done" : "notfound");
      else {
        const r = await unsubscribeRateAlertAction(token);
        setState(r === "DONE" ? "done" : r === "NOT_FOUND" ? "notfound" : "error");
      }
    } catch {
      setState("error");
    }
  }

  if (token === undefined) return <p aria-busy="true">Loading…</p>;
  if (!token && state === "idle")
    return (
      <Notification tone="warning">
        This link is incomplete. Open the link from your email again.
      </Notification>
    );
  if (state === "done")
    return (
      <Notification tone="success">
        {mode === "confirm"
          ? "Thank you — your rate alert is now active. You can unsubscribe from any alert email."
          : "You have been unsubscribed. You will not receive further alerts for this subscription."}
      </Notification>
    );
  if (state === "notfound")
    return (
      <Notification tone="warning">
        This link is not valid any more.{" "}
        {mode === "confirm" ? "It may have been used already." : ""}
      </Notification>
    );
  if (state === "error")
    return (
      <Notification tone="error">
        We could not complete this right now. Please try again later.
      </Notification>
    );
  return (
    <Button onClick={run} disabled={state === "working"}>
      {mode === "confirm" ? "Confirm my rate alert" : "Unsubscribe"}
    </Button>
  );
}
