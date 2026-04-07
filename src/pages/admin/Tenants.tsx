import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface TenantForm {
  name: string;
  slug: string;
  hoducc_endpoint: string;
  api_key: string;
  max_flows: number;
  max_channels: number;
}

const emptyForm: TenantForm = { name: '', slug: '', hoducc_endpoint: '', api_key: '', max_flows: 50, max_channels: 5 };

const Tenants = () => {
  const queryClient = useQueryClient();
  const { userRole, user } = useAuth();
  const isAdmin = userRole === 'admin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (form: TenantForm) => {
      if (editingId) {
        const { error } = await supabase.from('tenants').update({
          name: form.name, slug: form.slug, hoducc_endpoint: form.hoducc_endpoint,
          api_key: form.api_key, max_flows: form.max_flows, max_channels: form.max_channels,
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenants').insert({
          name: form.name, slug: form.slug, hoducc_endpoint: form.hoducc_endpoint,
          api_key: form.api_key, max_flows: form.max_flows, max_channels: form.max_channels,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenants-count'] });
      toast.success(editingId ? 'Tenant updated' : 'Tenant created');
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenants-count'] });
      toast.success('Tenant deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('tenants').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    onError: (err: any) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (tenant: any) => {
    setEditingId(tenant.id);
    setForm({
      name: tenant.name, slug: tenant.slug, hoducc_endpoint: tenant.hoducc_endpoint || '',
      api_key: tenant.api_key || '', max_flows: tenant.max_flows || 50, max_channels: tenant.max_channels || 5,
    });
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tenants</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage organizations and their configurations</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Tenant</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Tenant' : 'New Tenant'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required placeholder="my-company" />
                  </div>
                </div>
                <div>
                  <Label>HoduCC Endpoint</Label>
                  <Input value={form.hoducc_endpoint} onChange={(e) => setForm({ ...form, hoducc_endpoint: e.target.value })} placeholder="https://api.hoducc.example.com" />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="API key for HoduCC" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Max Flows</Label>
                    <Input type="number" value={form.max_flows} onChange={(e) => setForm({ ...form, max_flows: parseInt(e.target.value) || 50 })} />
                  </div>
                  <div>
                    <Label>Max Channels</Label>
                    <Input type="number" value={form.max_channels} onChange={(e) => setForm({ ...form, max_channels: parseInt(e.target.value) || 5 })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save'}</Button>
                </div>
              </form>
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
                <TableHead>Slug</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : tenants?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No tenants yet
                </TableCell></TableRow>
              ) : tenants?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                  <TableCell className="text-xs truncate max-w-[200px]">{t.hoducc_endpoint || '—'}</TableCell>
                  <TableCell className="text-xs">{t.max_flows} flows / {t.max_channels} ch</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch checked={t.is_active ?? true} onCheckedChange={(checked) => toggleActive.mutate({ id: t.id, is_active: checked })} />
                    ) : (
                      <Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Tenants;
