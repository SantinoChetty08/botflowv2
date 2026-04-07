import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFlowStore } from '@/store/flowStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, AlertTriangle, CheckCircle2, Upload, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';

interface ValidationIssue {
  nodeId?: string;
  nodeName?: string;
  type: 'error' | 'warning';
  message: string;
}

interface PublishFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PublishFlowDialog = ({ open, onOpenChange }: PublishFlowDialogProps) => {
  const { flowId, tenantId, flowName, saveFlow, isSaving } = useFlowStore();
  const [channelId, setChannelId] = useState<string>('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const { data: channels } = useQuery({
    queryKey: ['channels', tenantId],
    queryFn: async () => {
      const query = supabase.from('channels').select('id, name, phone_number, status');
      if (tenantId) query.eq('tenant_id', tenantId);
      const { data, error } = await query.eq('status', 'active').order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setIssues([]);
      setValidated(false);
      setChannelId('');
    }
  }, [open]);

  const errorCount = issues.filter((i) => i.type === 'error').length;
  const warningCount = issues.filter((i) => i.type === 'warning').length;
  const isValid = validated && errorCount === 0;

  const handleValidate = async () => {
    if (!flowId) return;
    setValidating(true);
    try {
      // Save first to ensure backend has latest data
      await saveFlow();

      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('validate-flow', {
        body: { flow_id: flowId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      setIssues(res.data.issues || []);
      setValidated(true);
    } catch (err: any) {
      toast.error('Validation failed: ' + err.message);
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!flowId || !channelId) return;
    setPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('publish-flow', {
        body: { flow_id: flowId, channel_id: channelId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      if (!res.data.success) throw new Error(res.data.error || 'Publish failed');

      toast.success(`"${flowName}" published to channel (v${res.data.version})`);
      useFlowStore.setState({
        flowStatus: 'published',
        versionNumber: res.data.version,
        isDirty: false,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Publish failed: ' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Publish Flow
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Validate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Step 1: Validate</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleValidate}
                disabled={validating || !flowId}
              >
                {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                {validated ? 'Re-validate' : 'Validate Flow'}
              </Button>
            </div>

            {validated && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                {issues.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Flow is valid — no issues found!
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-xs">
                      {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-destructive font-medium">
                          <AlertCircle className="w-3.5 h-3.5" /> {errorCount} error{errorCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="flex items-center gap-1 text-orange-500 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} warning{warningCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <ScrollArea className="max-h-40">
                      <ul className="space-y-1.5">
                        {issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            {issue.type === 'error' ? (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                            )}
                            <span className="text-foreground">{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Select Channel */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Step 2: Select Channel</Label>
            <Select value={channelId} onValueChange={setChannelId} disabled={!isValid}>
              <SelectTrigger>
                <SelectValue placeholder={isValid ? 'Choose a channel...' : 'Validate first'} />
              </SelectTrigger>
              <SelectContent>
                {channels?.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    <div className="flex items-center gap-2">
                      <Radio className="w-3 h-3" />
                      <span>{ch.name}</span>
                      <Badge variant="outline" className="text-[10px] ml-1">{ch.phone_number}</Badge>
                    </div>
                  </SelectItem>
                ))}
                {(!channels || channels.length === 0) && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No active channels found for this tenant
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Publish Button */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1"
              onClick={handlePublish}
              disabled={!isValid || !channelId || publishing}
            >
              {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Publish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PublishFlowDialog;
