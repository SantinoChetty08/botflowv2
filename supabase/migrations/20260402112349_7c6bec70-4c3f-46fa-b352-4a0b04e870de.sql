
-- Add channel_id to flows table
ALTER TABLE public.flows ADD COLUMN channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL;
CREATE INDEX idx_flows_channel ON public.flows(channel_id);

-- Create flow_versions table for version history
CREATE TABLE public.flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  version integer NOT NULL,
  flow_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid,
  change_summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(flow_id, version)
);

CREATE INDEX idx_flow_versions_flow ON public.flow_versions(flow_id);

ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view flow versions"
  ON public.flow_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage flow versions"
  ON public.flow_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = published_by);
