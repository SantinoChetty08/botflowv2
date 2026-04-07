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

  let body: { session_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const message = body.message?.trim();
  if (!body.session_id || !message) {
    return json({ error: "session_id and message are required" }, 400);
  }

  const { data: session, error: sessionErr } = await supabase
    .from("conversation_sessions")
    .select("id, channel_id, tenant_id, sender_phone, status")
    .eq("id", body.session_id)
    .single();

  if (sessionErr || !session) return json({ error: "Conversation not found" }, 404);

  const { data: channel, error: channelErr } = await supabase
    .from("channels")
    .select("id, access_token, phone_number_id, status")
    .eq("id", session.channel_id)
    .single();

  if (channelErr || !channel || channel.status !== "active" || !channel.access_token || !channel.phone_number_id) {
    return json({ error: "Channel is inactive or missing WhatsApp credentials" }, 400);
  }

  const whatsappResult = await sendWhatsAppMessage(
    channel.access_token,
    channel.phone_number_id,
    session.sender_phone,
    message,
  );

  await supabase
    .from("conversation_messages")
    .insert({
      session_id: session.id,
      channel_id: session.channel_id,
      tenant_id: session.tenant_id,
      sender_phone: session.sender_phone,
      direction: "outbound",
      sender_type: "agent",
      agent_id: user.id,
      message_type: "text",
      body: message,
      payload: whatsappResult,
      status: "sent",
      external_message_id: whatsappResult?.messages?.[0]?.id || null,
    });

  await supabase
    .from("conversation_sessions")
    .update({
      status: session.status === "queued" ? "handoff" : session.status,
      assigned_to: user.id,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  return json({ success: true });
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
