import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Verify Meta's X-Hub-Signature-256 header to ensure the webhook payload
 * is authentic and hasn't been tampered with.
 */
async function verifySignature(
  payload: string,
  signature: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signature) return false;

  const expectedPrefix = "sha256=";
  if (!signature.startsWith(expectedPrefix)) return false;

  const signatureHash = signature.slice(expectedPrefix.length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  const computedHash = Array.from(new Uint8Array(mac), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  // Constant-time comparison
  if (computedHash.length !== signatureHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computedHash.length; i++) {
    mismatch |= computedHash.charCodeAt(i) ^ signatureHash.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const channelId = pathParts[pathParts.length - 1];

  if (!channelId || channelId === "whatsapp-webhook") {
    return new Response(JSON.stringify({ error: "Missing channel_id in URL path" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(channelId)) {
    return new Response(JSON.stringify({ error: "Invalid channel_id format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch channel
  const { data: channel, error: chErr } = await supabase
    .from("channels")
    .select("id, name, tenant_id, status, verify_token, access_token, phone_number_id, waba_id, meta_app_id, config")
    .eq("id", channelId)
    .single();

  if (chErr || !channel) {
    return new Response(JSON.stringify({ error: "Channel not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── GET: Meta Webhook Verification ───
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === channel.verify_token) {
      console.log(`Webhook verified for channel ${channelId}`);

      if (channel.status !== "active") {
        await supabase
          .from("channels")
          .update({ status: "active" })
          .eq("id", channelId);
        console.log(`Channel ${channelId} status set to active`);
      }

      return new Response(challenge || "", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // ─── POST: Incoming WhatsApp Events ───
  if (req.method === "POST") {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify X-Hub-Signature-256
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
    if (META_APP_SECRET) {
      const signature = req.headers.get("x-hub-signature-256");
      const isValid = await verifySignature(rawBody, signature, META_APP_SECRET);
      if (!isValid) {
        console.error(`[Channel ${channelId}] Invalid webhook signature`);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn(`[Channel ${channelId}] META_APP_SECRET not set — skipping signature verification`);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate expected Meta webhook structure
    if (!body.object || body.object !== "whatsapp_business_account") {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entry = (body.entry as any[]) || [];
    const messagesToInsert: any[] = [];
    const statusUpdates: any[] = [];

    for (const e of entry) {
      const changes = e.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value || {};

        // Queue incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            const senderPhone = msg.from;
            const msgType = msg.type || "unknown";
            const text = msg.text?.body
              || msg.interactive?.button_reply?.title
              || msg.interactive?.list_reply?.title
              || "";

            messagesToInsert.push({
              channel_id: channelId,
              tenant_id: channel.tenant_id,
              sender_phone: senderPhone,
              message_type: msgType,
              message_id: msg.id || null,
              payload: {
                raw: msg,
                text,
                contacts: value.contacts || [],
                metadata: value.metadata || {},
              },
              status: "pending",
            });
          }
        }

        // Log status updates
        if (value.statuses) {
          statusUpdates.push(...value.statuses);
        }
      }
    }

    // Batch insert messages into the queue
    if (messagesToInsert.length > 0) {
      console.log(`[Channel ${channelId}] Queuing ${messagesToInsert.length} message(s)`);

      const { error: insertErr } = await supabase
        .from("inbound_messages")
        .insert(messagesToInsert);

      if (insertErr) {
        console.error(`[Channel ${channelId}] Failed to queue messages:`, insertErr.message);
      } else {
        // Trigger async processing via the process-messages function
        try {
          const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-messages`;
          await fetch(processUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              channel_id: channelId,
              tenant_id: channel.tenant_id,
              message_count: messagesToInsert.length,
            }),
          });
        } catch (err) {
          // Non-blocking: messages are queued, processor can pick them up later
          console.warn(`[Channel ${channelId}] Could not trigger processor:`, (err as Error).message);
        }
      }
    }

    if (statusUpdates.length > 0) {
      console.log(`[Channel ${channelId}] Received ${statusUpdates.length} status update(s)`);
      for (const status of statusUpdates) {
        const externalMessageId = status.id || null;
        const statusValue = status.status || "unknown";
        const statusTimestamp = status.timestamp
          ? new Date(Number(status.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        if (!externalMessageId) continue;

        const recipientPatch: Record<string, unknown> = {
          status_updated_at: statusTimestamp,
        };

        if (statusValue === "delivered" || statusValue === "sent") {
          recipientPatch.status = "sent";
          recipientPatch.delivered_at = statusTimestamp;
        } else if (statusValue === "read") {
          recipientPatch.status = "sent";
          recipientPatch.read_at = statusTimestamp;
        } else if (statusValue === "failed") {
          recipientPatch.status = "failed";
          recipientPatch.error_message = status.errors?.[0]?.title || status.errors?.[0]?.message || "Delivery failed";
        }

        await supabase
          .from("broadcast_recipients")
          .update(recipientPatch)
          .eq("external_message_id", externalMessageId);

        const messagePatch: Record<string, unknown> = {
          status: statusValue,
          status_updated_at: statusTimestamp,
        };

        if (statusValue === "delivered" || statusValue === "sent") {
          messagePatch.delivered_at = statusTimestamp;
        } else if (statusValue === "read") {
          messagePatch.read_at = statusTimestamp;
        }

        await supabase
          .from("conversation_messages")
          .update(messagePatch)
          .eq("external_message_id", externalMessageId);

        const { data: recipient } = await supabase
          .from("broadcast_recipients")
          .select("id, tenant_id, broadcast_id, phone_number")
          .eq("external_message_id", externalMessageId)
          .maybeSingle();

        await supabase.from("analytics_events").insert({
          tenant_id: recipient?.tenant_id || channel.tenant_id,
          channel_id: channelId,
          recipient_id: recipient?.id || null,
          event_type: `message_${statusValue}`,
          payload: {
            external_message_id: externalMessageId,
            phone_number: recipient?.phone_number || status.recipient_id || null,
            status: statusValue,
          },
        });
      }
    }

    // Always respond 200 to Meta quickly
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
