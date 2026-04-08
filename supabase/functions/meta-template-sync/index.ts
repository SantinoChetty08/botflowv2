import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

  let body: { channel_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.channel_id) return json({ error: "channel_id is required" }, 400);

  const { data: channel, error: channelErr } = await supabase
    .from("channels")
    .select("id, tenant_id, waba_id, access_token")
    .eq("id", body.channel_id)
    .single();

  if (channelErr || !channel) return json({ error: "Channel not found" }, 404);
  if (!channel.waba_id || !channel.access_token) {
    return json({ error: "Channel is missing WABA ID or access token" }, 400);
  }

  const templateUrl = new URL(`https://graph.facebook.com/v21.0/${channel.waba_id}/message_templates`);
  templateUrl.searchParams.set("fields", "id,name,status,category,language,components,rejected_reason");
  templateUrl.searchParams.set("limit", "100");

  const synced: Array<Record<string, unknown>> = [];
  let nextUrl: string | null = templateUrl.toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${channel.access_token}` },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return json({ error: "Meta template sync failed", details: data }, response.status);
    }

    for (const template of data.data || []) {
      const bodyComponent = (template.components || []).find((component: any) => component.type === "BODY");
      const bodyText = bodyComponent?.text || "";
      const variables = Array.from(new Set((bodyText.match(/\{\{(\d+)\}\}/g) || []).map((item) => item.replace(/[{}]/g, ""))));

      const payload = {
        tenant_id: channel.tenant_id,
        channel_id: channel.id,
        meta_template_id: template.id || template.name,
        name: template.name,
        category: (template.category || "utility").toLowerCase(),
        language: typeof template.language === "string" ? template.language : template.language?.code || "en",
        body: bodyText || "Template imported from Meta",
        variables,
        status: template.status === "APPROVED" ? "active" : "draft",
        source: "meta",
        components: template.components || [],
        meta_status: template.status || null,
        rejected_reason: template.rejected_reason || null,
        last_synced_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("message_templates")
        .upsert(payload, { onConflict: "tenant_id,name,language" } as any);

      if (error) {
        return json({ error: "Failed to upsert template", details: error.message }, 500);
      }

      synced.push({
        name: template.name,
        status: template.status,
        category: template.category,
      });
    }

    nextUrl = data.paging?.next || null;
  }

  await supabase.from("analytics_events").insert({
    tenant_id: channel.tenant_id,
    channel_id: channel.id,
    event_type: "meta_templates_synced",
    payload: { count: synced.length, synced_by: user.id },
  });

  return json({ success: true, synced_count: synced.length, templates: synced });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
