import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-token, x-api-secret",
};

interface FlowNode {
  id: string;
  type: string;
  data: {
    label: string;
    nodeType: string;
    config: Record<string, unknown>;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface BotAction {
  type: "send_message" | "ask_question" | "button_options" | "list_menu" | "capture_input" | "queue_route" | "agent_handoff" | "delay" | "end";
  message?: string;
  media_url?: string;
  buttons?: Array<{ label: string; value: string }>;
  list?: {
    header?: string;
    body?: string;
    button_text?: string;
    sections?: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  };
  input?: {
    variable_name?: string;
    input_type?: string;
    validation?: string;
    retries?: number;
    invalid_message?: string;
  };
  queue?: {
    queue_id?: string;
    route_method?: string;
    fallback_queue_id?: string;
    failure_message?: string;
  };
  handoff?: {
    queue_id?: string;
    message?: string;
    context_variables?: string[];
  };
  delay?: {
    duration?: number;
    unit?: string;
  };
}

interface BotResponse {
  node_id: string;
  node_type: string;
  label: string;
  action: BotAction;
  next_nodes: Array<{
    node_id: string;
    condition?: string;
  }>;
}

function buildBotResponse(node: FlowNode, edges: FlowEdge[]): BotResponse {
  const config = node.data.config || {};
  const outgoing = edges.filter((e) => e.source === node.id);
  const nextNodes = outgoing.map((e) => ({
    node_id: e.target,
    condition: e.label || e.sourceHandle || undefined,
  }));

  let action: BotAction;

  switch (node.data.nodeType) {
    case "start":
      action = { type: "send_message", message: "Flow started" };
      break;

    case "sendMessage":
      action = {
        type: "send_message",
        message: config.text as string || "",
        media_url: config.mediaUrl as string || undefined,
        buttons: Array.isArray(config.buttons) && config.buttons.length > 0
          ? config.buttons as Array<{ label: string; value: string }>
          : undefined,
      };
      break;

    case "askQuestion":
      action = {
        type: "ask_question",
        message: config.question as string || "",
        input: {
          variable_name: config.variableName as string,
          input_type: config.inputType as string,
          validation: config.validation as string,
          retries: config.retries as number,
          invalid_message: config.invalidMessage as string,
        },
      };
      break;

    case "buttonOptions":
      action = {
        type: "button_options",
        message: config.text as string || "",
        buttons: Array.isArray(config.buttons)
          ? config.buttons as Array<{ label: string; value: string }>
          : [],
      };
      break;

    case "listMenu":
      action = {
        type: "list_menu",
        list: {
          header: config.header as string,
          body: config.body as string,
          button_text: config.buttonText as string,
          sections: config.sections as Array<{
            title: string;
            rows: Array<{ id: string; title: string; description?: string }>;
          }>,
        },
      };
      break;

    case "captureInput":
      action = {
        type: "capture_input",
        message: config.prompt as string || "",
        input: {
          variable_name: config.variableName as string,
          validation: config.validation as string,
        },
      };
      break;

    case "queueRoute":
      action = {
        type: "queue_route",
        queue: {
          queue_id: config.queueId as string,
          route_method: config.routeMethod as string,
          fallback_queue_id: config.fallbackQueueId as string,
          failure_message: config.failureMessage as string,
        },
      };
      break;

    case "agentHandoff":
      action = {
        type: "agent_handoff",
        handoff: {
          queue_id: config.queueId as string,
          message: config.message as string,
          context_variables: config.contextVariables as string[],
        },
      };
      break;

    case "delay":
      action = {
        type: "delay",
        delay: {
          duration: config.duration as number,
          unit: config.unit as string,
        },
      };
      break;

    case "end":
      action = {
        type: "end",
        message: config.message as string || "Conversation ended",
      };
      break;

    default:
      action = { type: "send_message", message: "" };
  }

  return {
    node_id: node.id,
    node_type: node.data.nodeType,
    label: node.data.label,
    action,
    next_nodes: nextNodes,
  };
}

function processFlow(flowData: FlowData, currentNodeId?: string): {
  current: BotResponse;
  sequence: BotResponse[];
} {
  const { nodes, edges } = flowData;

  // Find the starting point
  let currentNode: FlowNode | undefined;
  if (currentNodeId) {
    currentNode = nodes.find((n) => n.id === currentNodeId);
  }
  if (!currentNode) {
    currentNode = nodes.find((n) => n.data.nodeType === "start");
  }
  if (!currentNode) {
    throw new Error("No start node found in flow");
  }

  // Build a sequence of responses following the flow from start until
  // we hit an interactive node (ask, buttons, list, capture) or end
  const sequence: BotResponse[] = [];
  let walker: FlowNode | undefined = currentNode;
  const visited = new Set<string>();

  while (walker && !visited.has(walker.id)) {
    visited.add(walker.id);
    const response = buildBotResponse(walker, edges);
    sequence.push(response);

    const nodeType = walker.data.nodeType;

    // Stop walking at interactive or terminal nodes
    if (["askQuestion", "buttonOptions", "listMenu", "captureInput", "end", "agentHandoff", "queueRoute"].includes(nodeType)) {
      break;
    }

    // Follow the first outgoing edge for linear nodes
    const outgoing = edges.filter((e) => e.source === walker!.id);
    if (outgoing.length === 0) break;

    const nextEdge = outgoing[0];
    walker = nodes.find((n) => n.id === nextEdge.target);
  }

  return {
    current: sequence[sequence.length - 1],
    sequence,
  };
}

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

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const channelId = pathParts[pathParts.length - 1];

  if (!channelId || channelId === "webhook") {
    return new Response(JSON.stringify({ error: "Missing channel_id in URL path" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiToken = req.headers.get("x-api-token");
  const apiSecret = req.headers.get("x-api-secret");

  if (!apiToken || !apiSecret) {
    return new Response(JSON.stringify({ error: "Missing x-api-token or x-api-secret headers" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: channel, error: fetchError } = await supabase
    .from("channels")
    .select("id, name, config, status, tenant_id")
    .eq("id", channelId)
    .single();

  if (fetchError || !channel) {
    return new Response(JSON.stringify({ error: "Channel not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const config = (channel.config as Record<string, unknown>) || {};
  const storedToken = config.api_token as string | undefined;
  const storedSecret = config.api_secret as string | undefined;

  if (!storedToken || !storedSecret) {
    return new Response(JSON.stringify({ error: "Channel has no API credentials configured" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const tokenMatch =
    apiToken.length === storedToken.length &&
    crypto.subtle
      ? await timingSafeEqual(encoder.encode(apiToken), encoder.encode(storedToken))
      : apiToken === storedToken;

  const secretMatch =
    apiSecret.length === storedSecret.length &&
    crypto.subtle
      ? await timingSafeEqual(encoder.encode(apiSecret), encoder.encode(storedSecret))
      : apiSecret === storedSecret;

  if (!tokenMatch || !secretMatch) {
    return new Response(JSON.stringify({ error: "Invalid API credentials" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (channel.status !== "active") {
    return new Response(JSON.stringify({ error: "Channel is not active" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: flow } = await supabase
    .from("flows")
    .select("id, name, flow_data")
    .eq("tenant_id", channel.tenant_id)
    .eq("status", "published")
    .limit(1)
    .single();

  if (!flow || !flow.flow_data) {
    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channel.id,
        tenant_id: channel.tenant_id,
        bot_response: null,
        message: "No published flow found for this channel",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Process the flow and generate bot response
  const flowData = flow.flow_data as unknown as FlowData;
  const currentNodeId = body.current_node_id as string | undefined;
  const userInput = body.user_input as string | undefined;

  try {
    const { current, sequence } = processFlow(flowData, currentNodeId);

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channel.id,
        channel_name: channel.name,
        tenant_id: channel.tenant_id,
        flow_id: flow.id,
        flow_name: flow.name,
        user_input: userInput || null,
        bot_response: current,
        message_sequence: sequence,
        session: {
          current_node_id: current.node_id,
          awaiting_input: ["ask_question", "button_options", "list_menu", "capture_input"].includes(current.action.type),
          next_node_ids: current.next_nodes.map((n) => n.node_id),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Flow processing error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function timingSafeEqual(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  if (a.length !== b.length) return false;
  const key = await crypto.subtle.importKey("raw", a, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, b);
  const expected = await crypto.subtle.sign("HMAC", key, a);
  const sigArr = new Uint8Array(sig);
  const expArr = new Uint8Array(expected);
  if (sigArr.length !== expArr.length) return false;
  let result = 0;
  for (let i = 0; i < sigArr.length; i++) {
    result |= sigArr[i] ^ expArr[i];
  }
  return result === 0;
}
