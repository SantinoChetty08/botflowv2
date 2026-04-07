import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GitBranch, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface FlowForm {
  name: string;
  description: string;
  tenant_id: string;
}

const emptyForm: FlowForm = { name: '', description: '', tenant_id: '' };

const Flows = () => {
  const queryClient = useQueryClient();
  const { userRole, user } = useAuth();
  const isAdmin = userRole === 'admin';
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FlowForm>(emptyForm);

  const { data: flows, isLoading } = useQuery({
    queryKey: ['flows'],
    queryFn: async () => {
      const { data, error } = await supabase.from('flows').select('*, tenants(name)').order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (form: FlowForm) => {
      const { data, error } = await supabase.from('flows').insert({
        name: form.name,
        description: form.description,
        tenant_id: form.tenant_id,
        created_by: user?.id,
        flow_data: { nodes: [], edges: [] },
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      queryClient.invalidateQueries({ queryKey: ['flows-count'] });
      toast.success('Flow created');
      setDialogOpen(false);
      setForm(emptyForm);
      navigate(`/builder/${data.id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('flows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      queryClient.invalidateQueries({ queryKey: ['flows-count'] });
      queryClient.invalidateQueries({ queryKey: ['active-flows-count'] });
      toast.success('Flow deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor = (s: string) => {
    switch (s) {
      case 'published': return 'default' as const;
      case 'draft': return 'secondary' as const;
      case 'archived': return 'outline' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Flows</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage bot conversation flows</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setForm(emptyForm); } else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Flow</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Flow</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <Label>Tenant</Label>
                <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Flow Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Customer Support Flow" />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what this flow does..." className="min-h-[60px]" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setForm(emptyForm); }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || !form.tenant_id || !form.name}>
                  {createMutation.isPending ? 'Creating...' : 'Create & Open Builder'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : flows?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No flows yet. Create your first flow!
                </TableCell></TableRow>
              ) : flows?.map((flow: any) => (
                <TableRow key={flow.id}>
                  <TableCell className="font-medium">{flow.name}</TableCell>
                  <TableCell className="text-xs">{flow.tenants?.name || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{flow.description || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">v{flow.version}</TableCell>
                  <TableCell><Badge variant={statusColor(flow.status || 'draft')}>{flow.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(flow.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/builder/${flow.id}`)}>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(flow.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Flows;
