-- Shared inbox + human handoff foundation.

ALTER TABLE public.conversation_sessions
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS internal_note text;

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_status
  ON public.conversation_sessions(status);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_assigned_to
  ON public.conversation_sessions(assigned_to);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_phone text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type text NOT NULL DEFAULT 'customer' CHECK (sender_type IN ('customer', 'bot', 'agent', 'system')),
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text',
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sent',
  external_message_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_session
  ON public.conversation_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_channel_sender
  ON public.conversation_messages(channel_id, sender_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_tenant
  ON public.conversation_messages(tenant_id, created_at DESC);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conversation messages"
  ON public.conversation_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can manage conversation messages"
  ON public.conversation_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can view sessions"
  ON public.conversation_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update sessions"
  ON public.conversation_sessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));
