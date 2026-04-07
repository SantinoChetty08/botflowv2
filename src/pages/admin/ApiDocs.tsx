import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Clock, ArrowRight, Shield, Zap, Code2, Server, Webhook, GitBranch, Radio } from 'lucide-react';

const API_VERSIONS = [
  {
    version: '3.0',
    date: '2026-04-02',
    status: 'current' as const,
    changes: [
      'Added publish-flow endpoint with channel targeting and version snapshots',
      'Added validate-flow endpoint with comprehensive node-level validation',
      'Added WhatsApp webhook with HMAC-SHA256 signature verification',
      'Added async message queue (inbound_messages) with fire-and-forget processing',
      'Added process-messages engine with multi-node traversal, variable interpolation, and business hours logic',
      'Added meta-token-exchange endpoint for Embedded Signup flow',
      'Added flow_versions table for immutable version history',
      'Added conversation_sessions table for stateful flow execution',
    ],
  },
  {
    version: '2.0',
    date: '2026-04-02',
    status: 'deprecated' as const,
    changes: [
      'Added bot_response with structured action types (send_message, button_options, list_menu, ask_question, etc.)',
      'Added message_sequence array for traversed messages',
      'Added session tracking with current_node_id and awaiting_input',
      'Added flow processing with automatic graph traversal from start node',
      'Added user_input and current_node_id request fields for conversation continuation',
    ],
  },
  {
    version: '1.0',
    date: '2026-04-01',
    status: 'deprecated' as const,
    changes: [
      'Initial webhook endpoint with channel authentication',
      'x-api-token and x-api-secret header validation with timing-safe comparison',
      'Channel status and credential verification',
      'Raw flow_data returned for published flows',
    ],
  },
];

const CodeBlock = ({ children, title }: { children: string; title?: string }) => (
  <div className="rounded-md border border-border bg-muted/40 overflow-hidden">
    {title && (
      <div className="px-3 py-1.5 border-b border-border bg-muted/60 text-xs font-mono text-muted-foreground">
        {title}
      </div>
    )}
    <ScrollArea className="max-h-96">
      <pre className="p-3 text-xs font-mono text-foreground whitespace-pre overflow-x-auto">
        {children}
      </pre>
    </ScrollArea>
  </div>
);

const SectionHeading = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
  <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mt-6 mb-3">
    <Icon className="w-4 h-4 text-primary" />
    {children}
  </h3>
);

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET: 'bg-blue-600 hover:bg-blue-600',
    POST: 'bg-green-600 hover:bg-green-600',
    PUT: 'bg-amber-600 hover:bg-amber-600',
    DELETE: 'bg-red-600 hover:bg-red-600',
  };
  return (
    <Badge className={`${colors[method] || 'bg-muted'} text-white font-mono text-xs`}>{method}</Badge>
  );
};

const ApiDocs = () => {
  const [activeTab, setActiveTab] = useState('reference');

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">API Documentation</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Complete backend function reference — HoduCC integration, WhatsApp webhooks, flow management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reference">HoduCC Webhook</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Webhook</TabsTrigger>
          <TabsTrigger value="flows">Flow Management</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
        </TabsList>

        {/* ─── HODUCC WEBHOOK TAB ─── */}
        <TabsContent value="reference" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="w-4 h-4" /> HoduCC Webhook Endpoint
              </CardTitle>
              <CardDescription>Process incoming messages through a published flow (for HoduCC/external CRM integration)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <MethodBadge method="POST" />
                <code className="text-sm font-mono text-foreground">
                  /functions/v1/webhook/{'{'}<span className="text-primary">channel_id</span>{'}'}
                </code>
              </div>

              <SectionHeading icon={Shield}>Authentication Headers</SectionHeading>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Header</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="px-3 py-2 font-mono text-xs">x-api-token</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Required</Badge></td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">Channel API token (prefix: cht_)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">x-api-secret</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Required</Badge></td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">Channel API secret (prefix: chs_)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <SectionHeading icon={Zap}>Request Body</SectionHeading>
              <CodeBlock title="application/json">{`{
  "user_input": "string (optional) — user's reply text",
  "current_node_id": "string (optional) — resume from this node",
  "metadata": {
    "sender_phone": "+1234567890",
    "session_id": "unique-session-id"
  }
}`}</CodeBlock>

              <SectionHeading icon={Code2}>Response Structure</SectionHeading>
              <CodeBlock title="200 OK">{`{
  "success": true,
  "channel_id": "uuid",
  "channel_name": "Main WhatsApp",
  "tenant_id": "uuid",
  "flow_id": "uuid",
  "flow_name": "Welcome Flow",
  "user_input": "Hello" | null,
  "bot_response": {
    "node_id": "node-3",
    "node_type": "buttonOptions",
    "label": "Main Menu",
    "action": {
      "type": "button_options",
      "message": "How can I help you?",
      "buttons": [
        { "label": "Sales", "value": "sales" },
        { "label": "Support", "value": "support" }
      ]
    },
    "next_nodes": [
      { "node_id": "node-4", "condition": "sales" },
      { "node_id": "node-5", "condition": "support" }
    ]
  },
  "message_sequence": [ ... ],
  "session": {
    "current_node_id": "node-3",
    "awaiting_input": true,
    "next_node_ids": ["node-4", "node-5"]
  }
}`}</CodeBlock>

              <SectionHeading icon={Shield}>Action Types</SectionHeading>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Interactive</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      ['send_message', 'Text or media message', 'No'],
                      ['ask_question', 'Prompt with input validation', 'Yes'],
                      ['button_options', 'Message with clickable buttons (max 3)', 'Yes'],
                      ['list_menu', 'WhatsApp list with sections (max 10 items)', 'Yes'],
                      ['capture_input', 'Capture and store user input', 'Yes'],
                      ['queue_route', 'Route to HoduCC queue', 'Yes'],
                      ['agent_handoff', 'Transfer to live agent', 'Yes'],
                      ['delay', 'Wait before next action', 'No'],
                      ['end', 'Terminate conversation', 'Yes'],
                    ].map(([type, desc, interactive]) => (
                      <tr key={type} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono">{type}</td>
                        <td className="px-3 py-2 text-muted-foreground">{desc}</td>
                        <td className="px-3 py-2">
                          <Badge variant={interactive === 'Yes' ? 'default' : 'secondary'} className="text-[10px]">
                            {interactive}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <SectionHeading icon={Shield}>Error Responses</SectionHeading>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      ['400', 'Missing channel_id or invalid JSON body'],
                      ['401', 'Missing or invalid API credentials'],
                      ['403', 'Channel inactive or no credentials configured'],
                      ['404', 'Channel not found'],
                      ['405', 'Method not allowed (use POST)'],
                      ['500', 'Flow processing error'],
                    ].map(([code, reason]) => (
                      <tr key={code} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono font-medium">{code}</td>
                        <td className="px-3 py-2 text-muted-foreground">{reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── WHATSAPP WEBHOOK TAB ─── */}
        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="w-4 h-4" /> WhatsApp Webhook
              </CardTitle>
              <CardDescription>Receives events directly from Meta's WhatsApp Cloud API — verification, incoming messages, and delivery statuses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Verification */}
              <div className="flex items-center gap-2">
                <MethodBadge method="GET" />
                <code className="text-sm font-mono text-foreground">
                  /functions/v1/whatsapp-webhook/{'{'}<span className="text-primary">channel_id</span>{'}'}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                Meta sends this request when you first register the webhook URL. The endpoint validates <code className="text-foreground">hub.verify_token</code> against the channel's stored verify token and returns the challenge.
              </p>
              <CodeBlock title="Query Parameters">{`hub.mode      = "subscribe"
hub.verify_token = "<channel verify_token>"
hub.challenge  = "<random string from Meta>"`}</CodeBlock>

              <Separator className="my-4" />

              {/* Incoming Messages */}
              <div className="flex items-center gap-2">
                <MethodBadge method="POST" />
                <code className="text-sm font-mono text-foreground">
                  /functions/v1/whatsapp-webhook/{'{'}<span className="text-primary">channel_id</span>{'}'}
                </code>
              </div>

              <SectionHeading icon={Shield}>Security</SectionHeading>
              <ul className="space-y-1.5 text-xs text-muted-foreground ml-1">
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Validates <code className="text-foreground">X-Hub-Signature-256</code> header using HMAC-SHA256 with META_APP_SECRET</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Rejects requests with invalid or missing signatures (401)</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Validates channel_id as UUID format</li>
              </ul>

              <SectionHeading icon={Zap}>Processing Pipeline</SectionHeading>
              <ul className="space-y-1.5 text-xs text-muted-foreground ml-1">
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Parses Meta's webhook JSON structure (<code className="text-foreground">entry[].changes[].value.messages[]</code>)</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Batch-inserts messages into <code className="text-foreground">inbound_messages</code> table with status <code className="text-foreground">"pending"</code></li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Fires async call to <code className="text-foreground">process-messages</code> function (non-blocking)</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Returns <code className="text-foreground">200 OK</code> immediately to Meta to avoid webhook timeouts</li>
              </ul>

              <SectionHeading icon={Code2}>Inbound Message Schema</SectionHeading>
              <CodeBlock title="inbound_messages row">{`{
  "id": "uuid",
  "channel_id": "uuid",
  "tenant_id": "uuid",
  "sender_phone": "+1234567890",
  "message_type": "text | interactive | image | ...",
  "message_id": "wamid.xxx",
  "payload": {
    "raw": { /* original Meta message object */ },
    "text": "extracted text content",
    "contacts": [...],
    "metadata": { "display_phone_number": "...", "phone_number_id": "..." }
  },
  "status": "pending | processing | processed | error",
  "error_message": null,
  "created_at": "2026-04-02T...",
  "processed_at": null
}`}</CodeBlock>
            </CardContent>
          </Card>

          {/* Process Messages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-4 h-4" /> Message Processor
              </CardTitle>
              <CardDescription>Async engine that dequeues pending messages and executes the published flow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <MethodBadge method="POST" />
                <code className="text-sm font-mono text-foreground">/functions/v1/process-messages</code>
              </div>
              <p className="text-xs text-muted-foreground">Internal function triggered by the webhook. Not intended for external use.</p>

              <SectionHeading icon={GitBranch}>Execution Engine Capabilities</SectionHeading>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Feature</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      ['Multi-node traversal', 'Walks up to 20 nodes per message until hitting an interactive or terminal node'],
                      ['Variable interpolation', 'Replaces {{variable_name}} in message text with session context data'],
                      ['Condition branching', 'Evaluates equals/not_equals/contains/gt/lt operators on session variables'],
                      ['Business hours', 'Checks current time against configured schedule and timezone'],
                      ['API requests', 'Makes outbound HTTP calls and stores response in session variables'],
                      ['Session management', 'Creates/resumes conversation_sessions per sender_phone + channel_id'],
                      ['WhatsApp API', 'Sends text, buttons (interactive.button), and list menus (interactive.list) via Meta Graph API'],
                    ].map(([feature, detail]) => (
                      <tr key={feature} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{feature}</td>
                        <td className="px-3 py-2 text-muted-foreground">{detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── FLOW MANAGEMENT TAB ─── */}
        <TabsContent value="flows" className="space-y-4 mt-4">
          {/* Validate Flow */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-4 h-4" /> Validate Flow
              </CardTitle>
              <CardDescription>Pre-deployment validation that checks flow integrity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <MethodBadge method="POST" />
                <code className="text-sm font-mono text-foreground">/functions/v1/validate-flow</code>
              </div>

              <SectionHeading icon={Shield}>Auth</SectionHeading>
              <p className="text-xs text-muted-foreground">Requires <code className="text-foreground">Authorization: Bearer &lt;jwt&gt;</code> from an authenticated user.</p>

              <SectionHeading icon={Zap}>Request</SectionHeading>
              <CodeBlock title="application/json">{`{ "flow_id": "uuid" }`}</CodeBlock>

              <SectionHeading icon={Code2}>Response</SectionHeading>
              <CodeBlock title="200 OK">{`{
  "valid": true | false,
  "errors": 0,
  "warnings": 2,
  "issues": [
    {
      "nodeId": "node-3",
      "nodeName": "Ask Name",
      "type": "error" | "warning",
      "message": ""Ask Name" has no variable name to store the answer"
    }
  ]
}`}</CodeBlock>

              <SectionHeading icon={FileText}>Validation Rules</SectionHeading>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Rule</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      ['Exactly one Start node required', 'Error'],
                      ['Start node must have outgoing connection', 'Error'],
                      ['Flow must have ≥2 nodes', 'Error'],
                      ['Edges must reference valid node IDs', 'Error'],
                      ['send_message requires message text', 'Error'],
                      ['ask_question requires question text', 'Error'],
                      ['button_options max 3 buttons (WhatsApp limit)', 'Error'],
                      ['list_menu max 10 items (WhatsApp limit)', 'Error'],
                      ['condition requires variable to check', 'Error'],
                      ['api_request requires URL', 'Error'],
                      ['set_variable requires variable name', 'Error'],
                      ['Orphaned nodes (no incoming connections)', 'Warning'],
                      ['Dead-end nodes (no outgoing, except terminals)', 'Warning'],
                      ['ask_question missing variable name', 'Warning'],
                      ['business_hours missing timezone', 'Warning'],
                    ].map(([rule, severity]) => (
                      <tr key={rule} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{rule}</td>
                        <td className="px-3 py-2">
                          <Badge variant={severity === 'Error' ? 'destructive' : 'secondary'} className="text-[10px]">{severity}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Publish Flow */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="w-4 h-4" /> Publish Flow
              </CardTitle>
              <CardDescription>Deploy a flow to a specific channel with version tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <MethodBadge method="POST" />
                <code className="text-sm font-mono text-foreground">/functions/v1/publish-flow</code>
              </div>

              <SectionHeading icon={Shield}>Auth</SectionHeading>
              <p className="text-xs text-muted-foreground">Requires JWT from admin or manager role.</p>

              <SectionHeading icon={Zap}>Request</SectionHeading>
              <CodeBlock title="application/json">{`{
  "flow_id": "uuid",
  "channel_id": "uuid"
}`}</CodeBlock>

              <SectionHeading icon={Code2}>Response</SectionHeading>
              <CodeBlock title="200 OK">{`{
  "success": true,
  "flow_id": "uuid",
  "channel_id": "uuid",
  "version": 3,
  "message": "Flow published successfully. Active conversations will restart with the new flow."
}`}</CodeBlock>

              <SectionHeading icon={FileText}>Behavior</SectionHeading>
              <ul className="space-y-1.5 text-xs text-muted-foreground ml-1">
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Unpublishes any currently published flow on the target channel</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Auto-increments version number and stores snapshot in <code className="text-foreground">flow_versions</code></li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Flow and channel must belong to the same tenant</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Closes all active conversation_sessions on the channel (they restart with new flow)</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />Only one published flow per channel at any time</li>
              </ul>

              <SectionHeading icon={Shield}>Error Responses</SectionHeading>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      ['400', 'Missing flow_id/channel_id, or flow and channel belong to different tenants'],
                      ['401', 'Missing authorization header'],
                      ['403', 'User is not admin or manager'],
                      ['404', 'Flow or channel not found'],
                      ['500', 'Database update failure'],
                    ].map(([code, reason]) => (
                      <tr key={code} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono font-medium">{code}</td>
                        <td className="px-3 py-2 text-muted-foreground">{reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CHANNELS TAB ─── */}
        <TabsContent value="channels" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="w-4 h-4" /> Meta Token Exchange (Embedded Signup)
              </CardTitle>
              <CardDescription>Exchanges a short-lived Meta token for a long-lived access token and provisions a new channel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <MethodBadge method="POST" />
                <code className="text-sm font-mono text-foreground">/functions/v1/meta-token-exchange</code>
              </div>

              <SectionHeading icon={Shield}>Auth</SectionHeading>
              <p className="text-xs text-muted-foreground">Requires JWT from admin role.</p>

              <SectionHeading icon={Zap}>Request</SectionHeading>
              <CodeBlock title="application/json">{`{
  "short_lived_token": "EAAx...",
  "waba_id": "123456789",
  "phone_number_id": "987654321",
  "phone_number": "+1234567890",
  "tenant_id": "uuid",
  "channel_name": "Main Sales Channel",
  "meta_app_id": "111222333 (optional, falls back to server env)"
}`}</CodeBlock>

              <SectionHeading icon={Code2}>Response</SectionHeading>
              <CodeBlock title="200 OK">{`{
  "success": true,
  "channel_id": "uuid",
  "webhook_url": "https://<project>/functions/v1/whatsapp-webhook/<channel_id>",
  "verify_token": "hex-random-48-chars",
  "message": "Channel created. Configure this webhook URL in your Meta App Dashboard, then activate the channel."
}`}</CodeBlock>

              <SectionHeading icon={FileText}>Pipeline</SectionHeading>
              <ul className="space-y-1.5 text-xs text-muted-foreground ml-1">
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" /><strong className="text-foreground">Step 1:</strong> Exchanges short-lived token → long-lived token via Meta Graph API</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" /><strong className="text-foreground">Step 2:</strong> Generates cryptographic <code className="text-foreground">verify_token</code> (48 hex chars)</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" /><strong className="text-foreground">Step 3:</strong> Creates channel record with status <code className="text-foreground">"pending"</code></li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" /><strong className="text-foreground">Step 4:</strong> Sets <code className="text-foreground">webhook_url</code> pointing to <code className="text-foreground">whatsapp-webhook/{'{'}channel_id{'}'}</code></li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" /><strong className="text-foreground">Step 5:</strong> Channel auto-activates when Meta sends GET verification request</li>
              </ul>
            </CardContent>
          </Card>

          {/* Channel Data Model */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-4 h-4" /> Channel Data Model
              </CardTitle>
              <CardDescription>Database schema for the channels table</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Column</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      ['id', 'uuid', 'Primary key'],
                      ['name', 'text', 'Display name'],
                      ['tenant_id', 'uuid (FK)', 'Owning tenant'],
                      ['phone_number', 'text', 'WhatsApp number'],
                      ['waba_id', 'text', 'WhatsApp Business Account ID'],
                      ['phone_number_id', 'text', 'Meta phone number ID'],
                      ['access_token', 'text', 'Long-lived Meta access token'],
                      ['provider', 'text', 'whatsapp_business (default)'],
                      ['status', 'text', 'inactive | pending | active | error'],
                      ['webhook_url', 'text', 'Auto-generated webhook URL'],
                      ['verify_token', 'text', 'Random token for Meta webhook verification'],
                      ['meta_app_id', 'text', 'Meta App ID used during setup'],
                      ['config', 'jsonb', 'Additional config (api_token, api_secret for HoduCC)'],
                    ].map(([col, type, desc]) => (
                      <tr key={col} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-foreground">{col}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{type}</td>
                        <td className="px-3 py-2 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── EXAMPLES TAB ─── */}
        <TabsContent value="examples" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Integration Examples</CardTitle>
              <CardDescription>Step-by-step conversation flow with the HoduCC webhook</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Step 1</Badge>
                  Start a conversation
                </h4>
                <CodeBlock title="curl">{`curl -X POST \\
  https://<project-url>/functions/v1/webhook/<channel_id> \\
  -H "Content-Type: application/json" \\
  -H "x-api-token: cht_your_token_here" \\
  -H "x-api-secret: chs_your_secret_here" \\
  -d '{
    "metadata": {
      "sender_phone": "+1234567890",
      "session_id": "sess_abc123"
    }
  }'`}</CodeBlock>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Step 2</Badge>
                  Send user reply to continue flow
                </h4>
                <CodeBlock title="curl">{`curl -X POST \\
  https://<project-url>/functions/v1/webhook/<channel_id> \\
  -H "Content-Type: application/json" \\
  -H "x-api-token: cht_your_token_here" \\
  -H "x-api-secret: chs_your_secret_here" \\
  -d '{
    "user_input": "sales",
    "current_node_id": "node-4",
    "metadata": {
      "sender_phone": "+1234567890",
      "session_id": "sess_abc123"
    }
  }'`}</CodeBlock>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Step 3</Badge>
                  Validate a flow before publishing
                </h4>
                <CodeBlock title="curl">{`curl -X POST \\
  https://<project-url>/functions/v1/validate-flow \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <jwt_token>" \\
  -d '{ "flow_id": "<flow_uuid>" }'`}</CodeBlock>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Step 4</Badge>
                  Publish flow to a channel
                </h4>
                <CodeBlock title="curl">{`curl -X POST \\
  https://<project-url>/functions/v1/publish-flow \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <jwt_token>" \\
  -d '{
    "flow_id": "<flow_uuid>",
    "channel_id": "<channel_uuid>"
  }'`}</CodeBlock>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Flow</Badge>
                  Conversation loop logic
                </h4>
                <CodeBlock title="pseudocode">{`function handleConversation(channelId, userPhone):
  sessionNodeId = null

  loop:
    response = POST webhook/{channelId}
      body: {
        user_input: userMessage or null,
        current_node_id: sessionNodeId
      }

    // 1. Display all messages in message_sequence
    for msg in response.message_sequence:
      if msg.action.type == "send_message":
        sendToUser(userPhone, msg.action.message)

    // 2. Handle the bot_response (last interactive node)
    bot = response.bot_response

    switch bot.action.type:
      case "button_options":
        sendButtons(userPhone, bot.action.message, bot.action.buttons)
        userMessage = waitForReply()
        sessionNodeId = findNextNode(bot.next_nodes, userMessage)

      case "list_menu":
        sendListMenu(userPhone, bot.action.list)
        userMessage = waitForReply()
        sessionNodeId = findNextNode(bot.next_nodes, userMessage)

      case "ask_question":
        sendToUser(userPhone, bot.action.message)
        userMessage = waitForReply()
        sessionNodeId = bot.next_nodes[0].node_id

      case "end":
        sendToUser(userPhone, bot.action.message)
        break loop

      case "agent_handoff":
        transferToAgent(bot.action.handoff)
        break loop`}</CodeBlock>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CHANGELOG TAB ─── */}
        <TabsContent value="changelog" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-4 h-4" /> Version History
              </CardTitle>
              <CardDescription>API changes and updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {API_VERSIONS.map((v) => (
                <div key={v.version}>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={v.status === 'current' ? 'default' : 'secondary'} className="text-xs">
                      v{v.version}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{v.date}</span>
                    {v.status === 'current' && (
                      <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/30">
                        Current
                      </Badge>
                    )}
                    {v.status === 'deprecated' && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/30">
                        Deprecated
                      </Badge>
                    )}
                  </div>
                  <ul className="space-y-1.5 ml-1">
                    {v.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
                        {change}
                      </li>
                    ))}
                  </ul>
                  {v.version !== API_VERSIONS[API_VERSIONS.length - 1].version && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiDocs;
