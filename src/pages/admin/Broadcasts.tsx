import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Send } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  name: '',
  tenant_id: '',
  channel_id: '',
  template_id: '',
  audience: '',
};

const Broadcasts = () => {
  const queryClient = useQueryClient();
  const { user, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const canManage = userRole === 'admin' || userRole === 'manager';
  const client = supabase as any;

  const { data: broadcasts } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: async () => {
      const { data, error } = await client.from('broadcasts').select('*, channels(name), message_templates(name), tenants(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recipientRows } = useQuery({
    queryKey: ['broadcast-recipients'],
    queryFn: async () => {
      const { data, error } = await client.from('broadcast_recipients').select('*');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: tenants } = useQuery({
    queryKey: ['broadcast-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: channels } = useQuery({
    queryKey: ['broadcast-channels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('channels').select('id, name, tenant_id').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['broadcast-templates'],
    queryFn: async () => {
      const { data, error } = await client.from('message_templates').select('id, name, tenant_id').eq('status', 'active').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const audience = form.audience.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
      const { error } = await client.from('broadcasts').insert({
        name: form.name,
        tenant_id: form.tenant_id,
        channel_id: form.channel_id,
        template_id: form.template_id,
        audience,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      setOpen(false);
      setForm(emptyForm);
      toast.success('Broadcast saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      const { error } = await supabase.functions.invoke('send-broadcast', { body: { broadcast_id: broadcastId } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast sending started');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Broadcasts</h2>
          <p className="text-sm text-muted-foreground mt-1">Send one-to-many WhatsApp campaigns from approved copy.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Broadcast</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Broadcast</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Tenant</Label>
                  <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v, channel_id: '', template_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                    <SelectContent>
                      {tenants?.map((tenant: any) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Channel</Label>
                    <Select value={form.channel_id} onValueChange={(v) => setForm({ ...form, channel_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                      <SelectContent>
                        {channels?.filter((channel: any) => !form.tenant_id || channel.tenant_id === form.tenant_id).map((channel: any) => (
                          <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Template</Label>
                    <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        {templates?.filter((template: any) => !form.tenant_id || template.tenant_id === form.tenant_id).map((template: any) => (
                          <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Audience</Label>
                  <Textarea
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                    className="min-h-[120px]"
                    placeholder="+27123456789&#10;+27821234567"
                  />
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.tenant_id || !form.channel_id || !form.template_id || !form.audience.trim()}>
                  Save broadcast
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="w-28">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts?.length ? broadcasts.map((broadcast: any) => (
                <TableRow key={broadcast.id}>
                  <TableCell className="font-medium">{broadcast.name}</TableCell>
                  <TableCell>{broadcast.tenants?.name || '—'}</TableCell>
                  <TableCell>{broadcast.channels?.name || '—'}</TableCell>
                  <TableCell>{broadcast.message_templates?.name || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{broadcast.status}</Badge></TableCell>
                  <TableCell>{broadcast.audience?.length || 0}</TableCell>
                  <TableCell className="text-xs">
                    {(() => {
                      const recipients = (recipientRows || []).filter((row: any) => row.broadcast_id === broadcast.id);
                      const sent = recipients.filter((row: any) => row.status === 'sent').length;
                      const failed = recipients.filter((row: any) => row.status === 'failed').length;
                      const read = recipients.filter((row: any) => row.read_at).length;
                      return `sent ${sent} · read ${read} · failed ${failed}`;
                    })()}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" disabled={!canManage || broadcast.status === 'sending'} onClick={() => sendMutation.mutate(broadcast.id)}>
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No broadcasts yet.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Broadcasts;
