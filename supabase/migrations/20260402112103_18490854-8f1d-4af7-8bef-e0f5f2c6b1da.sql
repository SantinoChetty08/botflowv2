
-- Create inbound_messages table for queuing incoming WhatsApp messages
CREATE TABLE public.inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_phone text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for processing queue
CREATE INDEX idx_inbound_messages_status ON public.inbound_messages(status) WHERE status = 'pending';
CREATE INDEX idx_inbound_messages_channel ON public.inbound_messages(channel_id);
CREATE INDEX idx_inbound_messages_tenant ON public.inbound_messages(tenant_id);

-- Enable RLS
ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view messages
CREATE POLICY "Admins can view inbound messages"
  ON public.inbound_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create conversation_sessions table for tracking user state across messages
CREATE TABLE public.conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_phone text NOT NULL,
  flow_id uuid REFERENCES public.flows(id) ON DELETE SET NULL,
  current_node_id text,
  session_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one active session per sender per channel
CREATE UNIQUE INDEX idx_conversation_sessions_active 
  ON public.conversation_sessions(channel_id, sender_phone) 
  WHERE status = 'active';

CREATE INDEX idx_conversation_sessions_tenant ON public.conversation_sessions(tenant_id);

ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sessions"
  ON public.conversation_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage sessions"
  ON public.conversation_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger for conversation_sessions
CREATE TRIGGER update_conversation_sessions_updated_at
  BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
