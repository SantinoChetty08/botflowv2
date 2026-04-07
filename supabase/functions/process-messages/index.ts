import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ───

interface SessionData {
  variables: Record<string, any>;
  last_input: string;
  last_node: string;
  awaiting_input?: boolean;
  awaiting_variable?: string;
  handoff_reason?: string;
}

interface MessageLogContext {
  supabase: any;
  sessionId?: string | null;
  channelId: string;
  tenantId: string;
  senderPhone: string;
}

interface NodeConfig {
  text?: string;
  question?: string;
  prompt?: string;
  mediaUrl?: string;
  variableName?: string;
  variable?: string;
  leftOperand?: string;
  operator?: string;
  value?: string;
  rightOperand?: string;
  buttons?: Array<{ label?: string; text?: string; value?: string }>;
  options?: Array<{ label?: string; text?: string; value?: string }>;
  sections?: Array<{ title?: string; rows?: Array<{ title?: string; description?: string; id?: string }> }>;
  items?: Array<{ title?: string; description?: string; id?: string }>;
  buttonText?: string;
  body?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  requestBody?: string;
  outputVariable?: string;
  responseVariable?: string;
  timezone?: string;
  schedule?: Record<string, { open: string; close: string; enabled: boolean }>;
  variableValue?: string;
  queueId?: string;
  reason?: string;
  message?: string;
  fallbackMessage?: string;
}

// ─── Main Handler ───

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { channel_id?: string; tenant_id?: string; batch_size?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const batchSize = Math.min(body.batch_size || 20, 50);

  // Fetch pending messages
  let query = supabase
    .from("inbound_messages")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (body.channel_id) query = query.eq("channel_id", body.channel_id);
  if (body.tenant_id) query = query.eq("tenant_id", body.tenant_id);

  const { data: messages, error: fetchErr } = await query;

  if (fetchErr) {
    console.error("Failed to fetch pending messages:", fetchErr.message);
    return new Response(JSON.stringify({ error: "Failed to fetch messages" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Processing ${messages.length} pending message(s)`);

  let processed = 0;
  let errors = 0;

  for (const msg of messages) {
    try {
      await supabase.from("inbound_messages").update({ status: "processing" }).eq("id", msg.id);

      const { data: channel } = await supabase
        .from("channels")
        .select("id, tenant_id, access_token, phone_number_id, status")
        .eq("id", msg.channel_id)
        .single();

      if (!channel || channel.status !== "active" || !channel.access_token) {
        await markMessage(supabase, msg.id, "skipped", "Channel inactive or missing credentials");
        continue;
      }

      const payload = msg.payload as any;
      const senderPhone = msg.sender_phone;
      const userText = payload?.text || "";

      // Get or create conversation session
      let { data: session } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("channel_id", msg.channel_id)
        .eq("sender_phone", senderPhone)
        .eq("status", "active")
        .maybeSingle();

      const { data: handoffSession } = !session
        ? await supabase
            .from("conversation_sessions")
            .select("*")
            .eq("channel_id", msg.channel_id)
            .eq("sender_phone", senderPhone)
            .in("status", ["queued", "handoff", "open"])
            .order("last_activity_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null };

      if (handoffSession) {
        await logConversationMessage({
          supabase,
          sessionId: handoffSession.id,
          channelId: msg.channel_id,
          tenantId: msg.tenant_id,
          senderPhone,
        }, "inbound", "customer", userText, msg.payload);

        await supabase
          .from("conversation_sessions")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", handoffSession.id);

        await markMessage(supabase, msg.id, "processed");
        processed++;
        continue;
      }

      // Get the published flow for this channel (preferred) or tenant
      const flowQuery = supabase
        .from("flows")
        .select("id, name, flow_data")
        .eq("status", "published")
        .limit(1);

      // Prefer channel-specific flow
      const { data: channelFlow } = await supabase
        .from("flows")
        .select("id, name, flow_data")
        .eq("channel_id", msg.channel_id)
        .eq("status", "published")
        .limit(1)
        .maybeSingle();

      const { data: tenantFlow } = !channelFlow
        ? await supabase
            .from("flows")
            .select("id, name, flow_data")
            .eq("tenant_id", msg.tenant_id)
            .eq("status", "published")
            .limit(1)
            .maybeSingle()
        : { data: null };

      const flow = channelFlow || tenantFlow;

      if (!flow?.flow_data) {
        await sendWhatsAppMessage(channel.access_token, channel.phone_number_id, senderPhone, {
          type: "text",
          text: { body: "Thank you for your message. We'll get back to you shortly." },
        });
        await markMessage(supabase, msg.id, "processed");
        processed++;
        continue;
      }

      const flowData = flow.flow_data as any;
      const nodes: any[] = flowData.nodes || [];
      const edges: any[] = flowData.edges || [];

      const sessionData: SessionData = (session?.session_data as any) || {
        variables: {},
        last_input: "",
        last_node: "",
      };

      let currentNodeId: string | null = session?.current_node_id || null;

      // ── New conversation: initialize from Start node ──
      if (!session) {
        const startNode = nodes.find((n: any) => n.data?.nodeType === "start");
        if (!startNode) {
          await markMessage(supabase, msg.id, "error", "Flow has no start node");
          errors++;
          continue;
        }

        currentNodeId = startNode.id;
        const { data: newSession } = await supabase
          .from("conversation_sessions")
          .insert({
            channel_id: msg.channel_id,
            tenant_id: msg.tenant_id,
            sender_phone: senderPhone,
            flow_id: flow.id,
            current_node_id: currentNodeId,
            session_data: { variables: {}, last_input: "", last_node: "" },
          })
          .select()
          .single();
        session = newSession;
      }

      if (!currentNodeId || !session) {
        await markMessage(supabase, msg.id, "processed");
        processed++;
        continue;
      }

      await logConversationMessage({
        supabase,
        sessionId: session.id,
        channelId: msg.channel_id,
        tenantId: msg.tenant_id,
        senderPhone,
      }, "inbound", "customer", userText, msg.payload);

      // ── If we were awaiting input, capture it ──
      if (sessionData.awaiting_input && sessionData.awaiting_variable) {
        sessionData.variables[sessionData.awaiting_variable] = userText;
        sessionData.awaiting_input = false;
        sessionData.awaiting_variable = undefined;
      }

      sessionData.last_input = userText;

      // ── Traverse the flow from current node ──
      let nextNodeId = getNextNode(currentNodeId, edges, nodes, userText, sessionData);
      let messagessSent = 0;
      const maxSteps = 20; // Guard against infinite loops
      let steps = 0;

      while (nextNodeId && steps < maxSteps) {
        steps++;
        const node = nodes.find((n: any) => n.id === nextNodeId);
        if (!node) break;

        const nodeType = node.data?.nodeType;
        const config: NodeConfig = node.data?.config || {};

        const result = await executeNode(
          nodeType,
          config,
          sessionData,
          channel.access_token,
          channel.phone_number_id,
          senderPhone,
          {
            supabase,
            sessionId: session.id,
            channelId: msg.channel_id,
            tenantId: msg.tenant_id,
            senderPhone,
          },
        );

        if (result.messageSent) messagessSent++;

        // If node requires user input, stop and wait
        if (result.awaitInput) {
          sessionData.awaiting_input = true;
          sessionData.awaiting_variable = result.awaitVariable;
          sessionData.last_node = nextNodeId;

          await updateSession(supabase, session.id, nextNodeId, sessionData);
          break;
        }

        // If node is terminal (handoff, queue route), close session
        if (result.terminal) {
          await supabase
            .from("conversation_sessions")
            .update({
              status: result.terminalStatus || "closed",
              current_node_id: nextNodeId,
              session_data: sessionData,
              last_activity_at: new Date().toISOString(),
            })
            .eq("id", session.id);
          break;
        }

        // Determine next node based on result
        const resolvedNextId = result.nextNodeId
          || getNextNode(nextNodeId, edges, nodes, userText, sessionData, result.branchKey);
        
        sessionData.last_node = nextNodeId;

        if (!resolvedNextId || resolvedNextId === nextNodeId) {
          // No more nodes to traverse
          await updateSession(supabase, session.id, nextNodeId, sessionData);
          break;
        }

        nextNodeId = resolvedNextId;

        // If we've traversed all nodes without awaiting input, save final state
        if (steps >= maxSteps) {
          console.warn(`[Flow] Max traversal steps reached for session ${session.id}`);
          await updateSession(supabase, session.id, nextNodeId, sessionData);
        }
      }

      if (steps >= maxSteps) {
        await updateSession(supabase, session.id, nextNodeId || currentNodeId, sessionData);
      }

      await markMessage(supabase, msg.id, "processed");
      processed++;
    } catch (err) {
      console.error(`Error processing message ${msg.id}:`, (err as Error).message);
      await markMessage(supabase, msg.id, "error", (err as Error).message);
      errors++;
    }
  }

  return new Response(
    JSON.stringify({ processed, errors, total: messages.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

// ─── Node Execution ───

interface ExecutionResult {
  messageSent: boolean;
  awaitInput: boolean;
  awaitVariable?: string;
  terminal: boolean;
  terminalStatus?: string;
  branchKey?: string;
  nextNodeId?: string;
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

function listRows(config: NodeConfig): Array<{ title?: string; description?: string; id?: string }> {
  if (config.items?.length) return config.items;
  return (config.sections || []).flatMap((section) => section.rows || []);
}

async function executeNode(
  nodeType: string,
  config: NodeConfig,
  sessionData: SessionData,
  accessToken: string,
  phoneNumberId: string,
  senderPhone: string,
  logContext: MessageLogContext,
): Promise<ExecutionResult> {
  const interpolate = (text: string): string => {
    if (!text) return text;
    return text.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return sessionData.variables[varName] !== undefined
        ? String(sessionData.variables[varName])
        : `{{${varName}}}`;
    });
  };

  switch (normalizeNodeType(nodeType)) {
    case "start":
      return { messageSent: false, awaitInput: false, terminal: false };

    case "send_message": {
      const text = interpolate(config.text || "Hello!");
      const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
        type: "text",
        text: { body: text },
      });
      await logConversationMessage(logContext, "outbound", "bot", text, result);
      return { messageSent: true, awaitInput: false, terminal: false };
    }

    case "ask_question": {
      const question = interpolate(config.question || "Please respond:");
      const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
        type: "text",
        text: { body: question },
      });
      await logConversationMessage(logContext, "outbound", "bot", question, result);
      return {
        messageSent: true,
        awaitInput: true,
        awaitVariable: config.variableName || "user_input",
        terminal: false,
      };
    }

    case "capture_input": {
      const prompt = interpolate(config.prompt || config.text || config.question || "Please provide your input:");
      const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
        type: "text",
        text: { body: prompt },
      });
      await logConversationMessage(logContext, "outbound", "bot", prompt, result);
      return {
        messageSent: true,
        awaitInput: true,
        awaitVariable: config.variableName || "captured_input",
        terminal: false,
      };
    }

    case "button_options": {
      const bodyText = interpolate(config.text || config.question || "Choose an option:");
      const buttons = (config.buttons || config.options || []).slice(0, 3).map((opt, i) => ({
        type: "reply",
        reply: {
          id: `btn_${i}_${opt.value || opt.label || i}`,
          title: (opt.label || opt.text || `Option ${i + 1}`).slice(0, 20),
        },
      }));

      if (buttons.length > 0) {
        const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: bodyText },
            action: { buttons },
          },
        });
        await logConversationMessage(logContext, "outbound", "bot", bodyText, result);
      }
      return {
        messageSent: true,
        awaitInput: true,
        awaitVariable: config.variableName || "button_selection",
        terminal: false,
      };
    }

    case "list_menu": {
      const bodyText = interpolate(config.body || config.text || "Select from the menu:");
      const rows = listRows(config).slice(0, 10).map((item, i) => ({
        id: `row_${i}_${item.id || i}`,
        title: (item.title || `Item ${i + 1}`).slice(0, 24),
        description: (item.description || "").slice(0, 72),
      }));

      if (rows.length > 0) {
        const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
          type: "interactive",
          interactive: {
            type: "list",
            body: { text: bodyText },
            action: {
              button: (config.buttonText || "View Options").slice(0, 20),
              sections: [{ title: "Options", rows }],
            },
          },
        });
        await logConversationMessage(logContext, "outbound", "bot", bodyText, result);
      }
      return {
        messageSent: true,
        awaitInput: true,
        awaitVariable: config.variableName || "list_selection",
        terminal: false,
      };
    }

    case "condition": {
      const variable = config.variable || "";
      const leftOperand = config.leftOperand || (variable ? `{{${variable}}}` : "");
      const operator = config.operator || "equals";
      const compareValue = config.rightOperand || config.value || "";
      const actualValue = interpolate(leftOperand).toLowerCase().trim();
      const expected = compareValue.toLowerCase().trim();

      let result = false;
      switch (operator) {
        case "equals": result = actualValue === expected; break;
        case "not_equals": result = actualValue !== expected; break;
        case "contains": result = actualValue.includes(expected); break;
        case "not_contains": result = !actualValue.includes(expected); break;
        case "starts_with": result = actualValue.startsWith(expected); break;
        case "ends_with": result = actualValue.endsWith(expected); break;
        case "greater_than": result = Number(actualValue) > Number(expected); break;
        case "less_than": result = Number(actualValue) < Number(expected); break;
        case "exists": result = actualValue !== "" && !/^\{\{.+\}\}$/.test(actualValue); break;
        case "is_empty": result = actualValue === ""; break;
        case "is_not_empty": result = actualValue !== ""; break;
        default: result = actualValue === expected;
      }

      return {
        messageSent: false,
        awaitInput: false,
        terminal: false,
        branchKey: result ? "true" : "false",
      };
    }

    case "set_variable": {
      const varName = config.variableName || "unnamed";
      const varValue = interpolate(config.variableValue || config.value || "");
      sessionData.variables[varName] = varValue;
      return { messageSent: false, awaitInput: false, terminal: false };
    }

    case "business_hours": {
      const tz = config.timezone || "UTC";
      const now = new Date();
      // Convert to timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "";
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
      const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
      const currentMinutes = hour * 60 + minute;

      const schedule = config.schedule || {};
      const daySchedule = schedule[weekday];

      let isOpen = false;
      if (daySchedule?.enabled) {
        const [openH, openM] = (daySchedule.open || "09:00").split(":").map(Number);
        const [closeH, closeM] = (daySchedule.close || "17:00").split(":").map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;
        isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      }

      return {
        messageSent: false,
        awaitInput: false,
        terminal: false,
        branchKey: isOpen ? "open" : "closed",
      };
    }

    case "api_request": {
      const url = interpolate(config.url || "");
      const method = (config.method || "GET").toUpperCase();
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      // Merge custom headers
      if (config.headers) {
        for (const [key, val] of Object.entries(config.headers)) {
          headers[key] = interpolate(val);
        }
      }

      try {
        const fetchOptions: RequestInit = { method, headers };
        const requestBody = config.requestBody || config.body;
        if (method !== "GET" && method !== "HEAD" && requestBody) {
          fetchOptions.body = interpolate(requestBody);
        }

        const response = await fetch(url, fetchOptions);
        const responseData = await response.json().catch(() => ({}));

        // Store response in variable
        const responseVar = config.outputVariable || config.responseVariable || "api_response";
        sessionData.variables[responseVar] = responseData;
        sessionData.variables[`${responseVar}_status`] = response.status;

        return {
          messageSent: false,
          awaitInput: false,
          terminal: false,
          branchKey: response.ok ? "success" : "error",
        };
      } catch (err) {
        console.error("API Request failed:", (err as Error).message);
        const responseVar = config.outputVariable || config.responseVariable || "api_response";
        sessionData.variables[`${responseVar}_error`] = (err as Error).message;
        return {
          messageSent: false,
          awaitInput: false,
          terminal: false,
          branchKey: "error",
        };
      }
    }

    case "queue_route": {
      const queueMessage = interpolate(
        config.message || config.fallbackMessage || "You're being transferred to our support team. Please wait..."
      );
      const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
        type: "text",
        text: { body: queueMessage },
      });
      await logConversationMessage(logContext, "outbound", "bot", queueMessage, result);

      sessionData.handoff_reason = config.reason || "queue_route";
      sessionData.variables["queue_id"] = config.queueId || "";

      return {
        messageSent: true,
        awaitInput: false,
        terminal: true,
        terminalStatus: "queued",
      };
    }

    case "agent_handoff": {
      const handoffMessage = interpolate(
        config.message || "Connecting you to a live agent. Please hold..."
      );
      const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
        type: "text",
        text: { body: handoffMessage },
      });
      await logConversationMessage(logContext, "outbound", "bot", handoffMessage, result);

      sessionData.handoff_reason = config.reason || "agent_handoff";

      return {
        messageSent: true,
        awaitInput: false,
        terminal: true,
        terminalStatus: "handoff",
      };
    }

    case "delay": {
      return { messageSent: false, awaitInput: false, terminal: false };
    }

    case "end": {
      if (config.message) {
        const result = await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, {
          type: "text",
          text: { body: interpolate(config.message) },
        });
        await logConversationMessage(logContext, "outbound", "bot", interpolate(config.message), result);
      }
      return {
        messageSent: Boolean(config.message),
        awaitInput: false,
        terminal: true,
        terminalStatus: "closed",
      };
    }

    default:
      console.warn(`Unknown node type: ${nodeType}`);
      return { messageSent: false, awaitInput: false, terminal: false };
  }
}

// ─── Flow Traversal ───

function getNextNode(
  currentNodeId: string,
  edges: any[],
  nodes: any[],
  userText: string,
  sessionData: SessionData,
  branchKey?: string,
): string | null {
  const outEdges = edges.filter((e: any) => e.source === currentNodeId);
  if (outEdges.length === 0) return null;

  // If a specific branch key is provided (from condition/business_hours nodes)
  if (branchKey) {
    const normalizedBranch = branchKey.toLowerCase().trim();
    const branchCandidates = new Set(
      normalizedBranch === "true" || normalizedBranch === "yes" || normalizedBranch === "open"
        ? ["true", "yes", "open"]
        : normalizedBranch === "false" || normalizedBranch === "no" || normalizedBranch === "closed"
          ? ["false", "no", "closed"]
          : [normalizedBranch],
    );

    // Match by sourceHandle
    const handleMatch = outEdges.find((e: any) => {
      const handle = (e.sourceHandle || "").toLowerCase().trim();
      return branchCandidates.has(handle);
    });
    if (handleMatch) return handleMatch.target;

    // Match by label
    const labelMatch = outEdges.find((e: any) => {
      const label = (e.label || e.data?.label || "").toLowerCase().trim();
      return branchCandidates.has(label);
    });
    if (labelMatch) return labelMatch.target;
  }

  // Single outgoing edge
  if (outEdges.length === 1) return outEdges[0].target;

  // Multiple edges without branch key: try user input matching
  const normalizedInput = userText.toLowerCase().trim();
  const currentNode = nodes.find((n: any) => n.id === currentNodeId);
  const currentConfig = (currentNode?.data?.config || {}) as NodeConfig;
  const inputCandidates = new Set([normalizedInput]);

  if (normalizeNodeType(currentNode?.data?.nodeType || "") === "button_options") {
    for (const button of currentConfig.buttons || currentConfig.options || []) {
      const label = (button.label || button.text || "").toLowerCase().trim();
      const value = (button.value || "").toLowerCase().trim();
      if (normalizedInput === label || normalizedInput === value) {
        if (label) inputCandidates.add(label);
        if (value) inputCandidates.add(value);
      }
    }
  }

  if (normalizeNodeType(currentNode?.data?.nodeType || "") === "list_menu") {
    for (const row of listRows(currentConfig)) {
      const title = (row.title || "").toLowerCase().trim();
      const id = (row.id || "").toLowerCase().trim();
      if (normalizedInput === title || normalizedInput === id) {
        if (title) inputCandidates.add(title);
        if (id) inputCandidates.add(id);
      }
    }
  }

  // Match by edge label
  for (const edge of outEdges) {
    const label = (edge.label || edge.data?.label || "").toLowerCase().trim();
    if (label && inputCandidates.has(label)) return edge.target;
  }

  // Match by button/list option index or text
  for (const edge of outEdges) {
    const handle = (edge.sourceHandle || "").toLowerCase().trim();
    if (handle && inputCandidates.has(handle)) return edge.target;
  }

  // Default: first edge
  return outEdges[0].target;
}

// ─── Helpers ───

async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  message: any,
): Promise<any> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        ...message,
      }),
    },
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`WhatsApp API error ${response.status}: ${JSON.stringify(errData)}`);
  }

  return response.json().catch(() => ({}));
}

async function logConversationMessage(
  context: MessageLogContext,
  direction: "inbound" | "outbound",
  senderType: "customer" | "bot" | "agent" | "system",
  body: string,
  payload: any = {},
): Promise<void> {
  await context.supabase
    .from("conversation_messages")
    .insert({
      session_id: context.sessionId,
      channel_id: context.channelId,
      tenant_id: context.tenantId,
      sender_phone: context.senderPhone,
      direction,
      sender_type: senderType,
      message_type: "text",
      body,
      payload,
      status: "sent",
      external_message_id: payload?.messages?.[0]?.id || payload?.raw?.id || null,
    });
}

async function markMessage(
  supabase: any,
  messageId: string,
  status: string,
  errorMessage?: string,
): Promise<void> {
  const update: any = { status, processed_at: new Date().toISOString() };
  if (errorMessage) update.error_message = errorMessage;
  await supabase.from("inbound_messages").update(update).eq("id", messageId);
}

async function updateSession(
  supabase: any,
  sessionId: string,
  currentNodeId: string,
  sessionData: SessionData,
): Promise<void> {
  await supabase
    .from("conversation_sessions")
    .update({
      current_node_id: currentNodeId,
      session_data: sessionData,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}
