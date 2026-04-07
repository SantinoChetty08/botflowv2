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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify JWT from the calling user
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

  // Verify the user is authenticated and is an admin
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

  // Check admin role
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    short_lived_token: string;
    waba_id: string;
    phone_number_id: string;
    phone_number: string;
    tenant_id: string;
    channel_name: string;
    meta_app_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { short_lived_token, waba_id, phone_number_id, phone_number, tenant_id, channel_name, meta_app_id } = body;

  if (!short_lived_token || !waba_id || !phone_number_id || !phone_number || !tenant_id || !channel_name) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 1: Exchange short-lived token for a long-lived token
  const META_APP_ID = meta_app_id || Deno.env.get("META_APP_ID");
  const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

  if (!META_APP_SECRET) {
    return new Response(JSON.stringify({ error: "META_APP_SECRET not configured on the server" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let longLivedToken: string;

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${short_lived_token}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(JSON.stringify({ error: "Token exchange failed", details: tokenData.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    longLivedToken = tokenData.access_token;
  } catch (err) {
    return new Response(JSON.stringify({ error: "Token exchange request failed", details: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 2: Generate a unique verify_token for webhook verification
  const verifyTokenBytes = new Uint8Array(24);
  crypto.getRandomValues(verifyTokenBytes);
  const verifyToken = Array.from(verifyTokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  // Step 3: Create the channel record
  const { data: channel, error: insertErr } = await supabase
    .from("channels")
    .insert({
      name: channel_name,
      phone_number: phone_number,
      tenant_id: tenant_id,
      provider: "whatsapp_business",
      status: "pending",
      waba_id: waba_id,
      phone_number_id: phone_number_id,
      access_token: longLivedToken,
      meta_app_id: META_APP_ID,
      verify_token: verifyToken,
      webhook_url: "", // will be set below after we have the ID
    })
    .select("id")
    .single();

  if (insertErr || !channel) {
    return new Response(JSON.stringify({ error: "Failed to create channel", details: insertErr?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 4: Update the webhook URL with the channel ID
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook/${channel.id}`;
  await supabase
    .from("channels")
    .update({ webhook_url: webhookUrl })
    .eq("id", channel.id);

  // Step 5: Subscribe to webhooks via Meta API (register the webhook URL)
  // Note: This requires the app to have webhook subscriptions configured in Meta Developer Console
  // The verify_token is used when Meta sends the GET verification request

  return new Response(
    JSON.stringify({
      success: true,
      channel_id: channel.id,
      webhook_url: webhookUrl,
      verify_token: verifyToken,
      message: "Channel created. Configure this webhook URL in your Meta App Dashboard, then activate the channel.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
