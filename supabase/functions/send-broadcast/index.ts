import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "manager"])
    .maybeSingle();

  if (!roleData) return json({ error: "Forbidden: admin or manager required" }, 403);

  let body: { broadcast_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.broadcast_id) return json({ error: "broadcast_id is required" }, 400);

  const { data: broadcast, error: broadcastErr } = await supabase
    .from("broadcasts")
    .select("*, message_templates(*), channels(*)")
    .eq("id", body.broadcast_id)
    .single();

  if (broadcastErr || !broadcast) return json({ error: "Broadcast not found" }, 404);
  if (!broadcast.channel_id || !broadcast.channels?.access_token || !broadcast.channels?.phone_number_id) {
    return json({ error: "Broadcast channel is missing WhatsApp credentials" }, 400);
  }

  const audience: string[] = Array.isArray(broadcast.audience) ? broadcast.audience : [];
  if (audience.length === 0) return json({ error: "Broadcast audience is empty" }, 400);

  const templateBody = broadcast.message_templates?.body || broadcast.metadata?.body || "";
  if (!templateBody) return json({ error: "Broadcast message body is empty" }, 400);

  await supabase.from("broadcasts").update({
    status: "sending",
    channel_id: broadcast.channel_id,
  }).eq("id", broadcast.id);

  let sent = 0;
  let failed = 0;

  for (const phoneNumber of audience) {
    const recipientInsert = {
      broadcast_id: broadcast.id,
      tenant_id: broadcast.tenant_id,
      channel_id: broadcast.channel_id,
      phone_number: phoneNumber,
    };

    const { data: recipient } = await supabase
      .from("broadcast_recipients")
      .insert(recipientInsert)
      .select("id")
      .single();

    try {
      const whatsappResponse = await sendWhatsAppMessage(
        broadcast.channels.access_token,
        broadcast.channels.phone_number_id,
        phoneNumber,
        templateBody,
      );

      await supabase.from("broadcast_recipients").update({
        status: "sent",
        delivered_at: new Date().toISOString(),
        external_message_id: whatsappResponse?.messages?.[0]?.id || null,
      }).eq("id", recipient?.id);

      await supabase.from("analytics_events").insert({
        tenant_id: broadcast.tenant_id,
        channel_id: broadcast.channel_id,
        recipient_id: recipient?.id || null,
        event_type: "broadcast_sent",
        payload: {
          broadcast_id: broadcast.id,
          phone_number: phoneNumber,
          template_id: broadcast.template_id,
        },
      });

      sent++;
    } catch (err) {
      await supabase.from("broadcast_recipients").update({
        status: "failed",
        error_message: (err as Error).message,
      }).eq("id", recipient?.id);

      await supabase.from("analytics_events").insert({
        tenant_id: broadcast.tenant_id,
        channel_id: broadcast.channel_id,
        recipient_id: recipient?.id || null,
        event_type: "broadcast_failed",
        payload: {
          broadcast_id: broadcast.id,
          phone_number: phoneNumber,
          error: (err as Error).message,
        },
      });

      failed++;
    }
  }

  await supabase.from("broadcasts").update({
    status: failed > 0 && sent === 0 ? "failed" : "sent",
    sent_at: new Date().toISOString(),
    metadata: {
      ...(broadcast.metadata || {}),
      sent,
      failed,
      sent_by: user.id,
    },
  }).eq("id", broadcast.id);

  return json({ success: true, sent, failed });
});

async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  body: string,
): Promise<any> {
  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`WhatsApp API error ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
