import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationError {
  nodeId?: string;
  nodeName?: string;
  type: "error" | "warning";
  message: string;
}

function normalizeNodeType(nodeType: string): string {
  const aliases: Record<string, string> = {
    sendMessage: "send_message",
    askQuestion: "ask_question",
    captureInput: "capture_input",
    buttonOptions: "button_options",
    listMenu: "list_menu",
    setVariable: "set_variable",
    businessHours: "business_hours",
    apiWebhook: "api_request",
    queueRoute: "queue_route",
    agentHandoff: "agent_handoff",
  };
  return aliases[nodeType] || nodeType;
}

function listRows(config: any): any[] {
  if (config.items?.length) return config.items;
  return (config.sections || []).flatMap((section: any) => section.rows || []);
}

/**
 * Validate a flow for common errors before publishing.
 * POST body: { flow_id }
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

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { flow_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.flow_id) {
    return new Response(JSON.stringify({ error: "flow_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: flow, error: flowErr } = await supabase
    .from("flows")
    .select("id, name, flow_data")
    .eq("id", body.flow_id)
    .single();

  if (flowErr || !flow) {
    return new Response(JSON.stringify({ error: "Flow not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const flowData = flow.flow_data as any;
  const nodes: any[] = flowData?.nodes || [];
  const edges: any[] = flowData?.edges || [];
  const issues: ValidationError[] = [];

  const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));
  const nodeIds = new Set(nodes.map((n: any) => n.id));

  // 1. Must have exactly one Start node
  const startNodes = nodes.filter((n: any) => n.data?.nodeType === "start");
  if (startNodes.length === 0) {
    issues.push({ type: "error", message: "Flow must have a Start node" });
  } else if (startNodes.length > 1) {
    issues.push({ type: "error", message: "Flow must have exactly one Start node" });
  }

  // 2. Check for orphaned nodes (no incoming edges and not Start)
  const nodesWithIncoming = new Set(edges.map((e: any) => e.target));
  for (const node of nodes) {
    if (node.data?.nodeType === "start") continue;
    if (!nodesWithIncoming.has(node.id)) {
      issues.push({
        nodeId: node.id,
        nodeName: node.data?.label || node.data?.nodeType,
        type: "warning",
        message: `Node "${node.data?.label || node.data?.nodeType}" has no incoming connections`,
      });
    }
  }

  // 3. Check for dead-end nodes (no outgoing edges, except terminal nodes)
  const terminalTypes = new Set(["agent_handoff", "queue_route", "end"]);
  const nodesWithOutgoing = new Set(edges.map((e: any) => e.source));
  for (const node of nodes) {
    if (terminalTypes.has(normalizeNodeType(node.data?.nodeType))) continue;
    if (!nodesWithOutgoing.has(node.id)) {
      issues.push({
        nodeId: node.id,
        nodeName: node.data?.label || node.data?.nodeType,
        type: "warning",
        message: `Node "${node.data?.label || node.data?.nodeType}" has no outgoing connections (dead end)`,
      });
    }
  }

  // 4. Check edges reference valid nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({ type: "error", message: `Edge references non-existent source node: ${edge.source}` });
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({ type: "error", message: `Edge references non-existent target node: ${edge.target}` });
    }
  }

  // 5. Validate node configurations
  for (const node of nodes) {
    const nodeType = normalizeNodeType(node.data?.nodeType);
    const config = node.data?.config || {};
    const label = node.data?.label || node.data?.nodeType || nodeType;

    switch (nodeType) {
      case "send_message":
        if (!config.text?.trim()) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" has no message text` });
        }
        break;

      case "ask_question":
        if (!config.question?.trim()) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" has no question text` });
        }
        if (!config.variableName?.trim()) {
          issues.push({ nodeId: node.id, nodeName: label, type: "warning", message: `"${label}" has no variable name to store the answer` });
        }
        break;

      case "button_options": {
        const buttons = config.buttons || config.options || [];
        if (buttons.length === 0) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" has no button options defined` });
        } else if (buttons.length > 3) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" exceeds WhatsApp's 3 button limit` });
        }
        break;
      }

      case "list_menu": {
        const rows = listRows(config);
        if (rows.length === 0) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" has no menu items defined` });
        } else if (rows.length > 10) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" exceeds WhatsApp's 10 item limit` });
        }
        break;
      }

      case "condition":
        if (!(config.leftOperand || config.variable)?.trim()) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" has no variable to check` });
        }
        break;

      case "api_request":
        if (!config.url?.trim()) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" has no URL configured` });
        }
        break;

      case "set_variable":
        if (!config.variableName?.trim()) {
          issues.push({ nodeId: node.id, nodeName: label, type: "error", message: `"${label}" has no variable name` });
        }
        break;

      case "business_hours":
        if (!config.timezone) {
          issues.push({ nodeId: node.id, nodeName: label, type: "warning", message: `"${label}" has no timezone set, will default to UTC` });
        }
        break;
    }
  }

  // 6. Check Start node is connected
  if (startNodes.length === 1) {
    const startId = startNodes[0].id;
    const startEdges = edges.filter((e: any) => e.source === startId);
    if (startEdges.length === 0) {
      issues.push({ nodeId: startId, type: "error", message: "Start node is not connected to any other node" });
    }
  }

  // 7. Check minimum node count
  if (nodes.length <= 1) {
    issues.push({ type: "error", message: "Flow must have at least one node besides Start" });
  }

  const errorCount = issues.filter((i) => i.type === "error").length;
  const warningCount = issues.filter((i) => i.type === "warning").length;

  return new Response(
    JSON.stringify({
      valid: errorCount === 0,
      errors: errorCount,
      warnings: warningCount,
      issues,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
