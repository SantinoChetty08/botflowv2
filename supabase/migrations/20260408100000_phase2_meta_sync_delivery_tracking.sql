-- Phase 2.5: Meta template sync + delivery/read tracking.

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_template_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'meta')),
  ADD COLUMN IF NOT EXISTS components jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_status text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text;

CREATE INDEX IF NOT EXISTS idx_message_templates_channel
  ON public.message_templates(channel_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_unique_identity
  ON public.message_templates(tenant_id, name, language);

ALTER TABLE public.broadcast_recipients
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;

ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;
