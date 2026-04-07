import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ChannelEditDialogProps {
  channel: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChannelEditDialog = ({ channel, open, onOpenChange }: ChannelEditDialogProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(channel.name);
  const [status, setStatus] = useState(channel.status || 'inactive');

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('channels')
        .update({ name, status })
        .eq('id', channel.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel updated');
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Channel</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
          className="space-y-4"
        >
          <div>
            <Label>Channel Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Read-only Meta fields */}
          {channel.phone_number && (
            <div>
              <Label className="text-xs text-muted-foreground">Phone Number</Label>
              <Input readOnly value={channel.phone_number} className="font-mono text-xs bg-muted" />
            </div>
          )}

          {channel.waba_id && (
            <div>
              <Label className="text-xs text-muted-foreground">WABA ID</Label>
              <Input readOnly value={channel.waba_id} className="font-mono text-xs bg-muted" />
            </div>
          )}

          {channel.phone_number_id && (
            <div>
              <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
              <Input readOnly value={channel.phone_number_id} className="font-mono text-xs bg-muted" />
            </div>
          )}

          {channel.webhook_url && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={channel.webhook_url} className="font-mono text-xs bg-muted" />
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(channel.webhook_url, 'Webhook URL')}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelEditDialog;
