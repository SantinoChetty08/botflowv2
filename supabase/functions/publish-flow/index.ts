import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Publish a flow to a specific channel.
 * Enforces: only one published flow per channel at a time.
 * Auto-increments version and stores a snapshot in flow_versions.
 *
 * POST body: { flow_id, channel_id }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check admin or manager role
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "manager"])
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden: admin or manager required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { flow_id: string; channel_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { flow_id, channel_id } = body;
  if (!flow_id || !channel_id) {
    return new Response(JSON.stringify({ error: "flow_id and channel_id are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch the flow
  const { data: flow, error: flowErr } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flow_id)
    .single();

  if (flowErr || !flow) {
    return new Response(JSON.stringify({ error: "Flow not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify channel exists and belongs to same tenant
  const { data: channel, error: chErr } = await supabase
    .from("channels")
    .select("id, tenant_id, status")
    .eq("id", channel_id)
    .single();

  if (chErr || !channel) {
    return new Response(JSON.stringify({ error: "Channel not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (channel.tenant_id !== flow.tenant_id) {
    return new Response(JSON.stringify({ error: "Flow and channel must belong to the same tenant" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Unpublish any currently published flow on this channel
  await supabase
    .from("flows")
    .update({ status: "draft", channel_id: null })
    .eq("channel_id", channel_id)
    .eq("status", "published");

  // Increment version
  const newVersion = (flow.version || 0) + 1;

  // Store version snapshot
  await supabase
    .from("flow_versions")
    .insert({
      flow_id: flow.id,
      version: newVersion,
      flow_data: flow.flow_data || {},
      published_by: user.id,
      change_summary: `Published to channel ${channel_id}`,
    });

  // Update flow to published
  const { error: updateErr } = await supabase
    .from("flows")
    .update({
      status: "published",
      channel_id: channel_id,
      version: newVersion,
      updated_by: user.id,
    })
    .eq("id", flow_id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: "Failed to publish", details: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Close any active sessions on this channel (they'll restart with the new flow)
  await supabase
    .from("conversation_sessions")
    .update({ status: "closed" })
    .eq("channel_id", channel_id)
    .eq("status", "active");

  await supabase.from("analytics_events").insert({
    tenant_id: flow.tenant_id,
    channel_id,
    flow_id,
    event_type: "flow_published",
    payload: {
      version: newVersion,
      published_by: user.id,
    },
  });

  return new Response(
    JSON.stringify({
      success: true,
      flow_id,
      channel_id,
      version: newVersion,
      message: "Flow published successfully. Active conversations will restart with the new flow.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
