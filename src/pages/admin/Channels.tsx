import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Radio, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import ChannelApiCredentials from '@/components/admin/ChannelApiCredentials';
import MetaEmbeddedSignup from '@/components/admin/MetaEmbeddedSignup';
import ChannelEditDialog from '@/components/admin/ChannelEditDialog';

const Channels = () => {
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const [signupOpen, setSignupOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [credentialsChannel, setCredentialsChannel] = useState<any>(null);

  const { data: channels, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('channels').select('*, tenants(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels-count'] });
      toast.success('Channel deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor = (s: string) => s === 'active' ? 'default' : s === 'pending' ? 'secondary' : 'outline';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Channels</h2>
          <p className="text-sm text-muted-foreground mt-1">Connect and manage WhatsApp Business channels</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1" onClick={() => setSignupOpen(true)}>
            <Plus className="w-4 h-4" /> Connect Channel
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>WABA ID</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : channels?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No channels yet. Connect your first WhatsApp Business number.
                </TableCell></TableRow>
              ) : channels?.map((ch: any) => (
                <TableRow key={ch.id}>
                  <TableCell className="font-medium">{ch.name}</TableCell>
                  <TableCell className="text-xs">{ch.tenants?.name || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{ch.phone_number}</TableCell>
                  <TableCell className="font-mono text-xs">{ch.waba_id || '—'}</TableCell>
                  <TableCell className="text-xs capitalize">{ch.provider}</TableCell>
                  <TableCell><Badge variant={statusColor(ch.status || 'inactive')}>{ch.status}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCredentialsChannel(ch)} title="API Credentials"><KeyRound className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingChannel(ch)}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(ch.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Meta Embedded Signup Dialog */}
      <MetaEmbeddedSignup open={signupOpen} onOpenChange={setSignupOpen} />

      {/* Edit Channel Dialog */}
      {editingChannel && (
        <ChannelEditDialog
          channel={editingChannel}
          open={!!editingChannel}
          onOpenChange={(open) => { if (!open) setEditingChannel(null); }}
        />
      )}

      {/* API Credentials Dialog */}
      {credentialsChannel && (
        <ChannelApiCredentials
          channel={credentialsChannel}
          open={!!credentialsChannel}
          onOpenChange={(open) => { if (!open) setCredentialsChannel(null); }}
        />
      )}
    </div>
  );
};

export default Channels;
