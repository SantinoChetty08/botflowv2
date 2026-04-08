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
import { Plus, RefreshCcw, ScrollText } from 'lucide-react';
import { toast } from 'sonner';

const emptyTemplate = {
  name: '',
  tenant_id: '',
  category: 'utility',
  language: 'en',
  body: '',
};

const Templates = () => {
  const queryClient = useQueryClient();
  const { user, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTemplate);
  const canManage = userRole === 'admin' || userRole === 'manager';
  const client = supabase as any;

  const { data: templates } = useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      const { data, error } = await client.from('message_templates').select('*, tenants(name)').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ['template-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: channels } = useQuery({
    queryKey: ['template-channels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('channels').select('id, name, tenant_id, waba_id').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const [syncChannelId, setSyncChannelId] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const variables = Array.from(new Set((form.body.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/[{}]/g, ''))));
      const { error } = await client.from('message_templates').insert({
        ...form,
        created_by: user?.id,
        variables,
        status: 'active',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      setOpen(false);
      setForm(emptyTemplate);
      toast.success('Template created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('meta-template-sync', { body: { channel_id: syncChannelId } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Templates synced from Meta');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">Reusable WhatsApp and campaign copy blocks.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Select value={syncChannelId} onValueChange={setSyncChannelId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Sync from channel" /></SelectTrigger>
              <SelectContent>
                {channels?.filter((channel: any) => channel.waba_id).map((channel: any) => (
                  <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={!syncChannelId || syncMutation.isPending}>
              <RefreshCcw className="w-4 h-4 mr-1" /> Sync Meta
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Template</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tenant</Label>
                    <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                      <SelectContent>
                        {tenants?.map((tenant: any) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="utility">Utility</SelectItem>
                          <SelectItem value="authentication">Authentication</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Language</Label>
                      <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Body</Label>
                    <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="min-h-[120px]" placeholder="Hello {{name}}, your order is ready." />
                  </div>
                  <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.tenant_id || !form.body}>
                    Save template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Meta Status</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.length ? templates.map((template: any) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.tenants?.name || '—'}</TableCell>
                  <TableCell className="capitalize">{template.category}</TableCell>
                  <TableCell>{template.language}</TableCell>
                  <TableCell className="text-xs">{(template.variables || []).join(', ') || '—'}</TableCell>
                  <TableCell className="capitalize">{template.source || 'manual'}</TableCell>
                  <TableCell>{template.meta_status || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{template.status}</Badge></TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No templates yet.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Templates;
