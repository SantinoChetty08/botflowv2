import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Inbox as InboxIcon, MessageSquare, Send, UserCheck, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';

type Session = {
  id: string;
  channel_id: string;
  tenant_id: string;
  sender_phone: string;
  status: string;
  assigned_to: string | null;
  priority: string;
  tags: string[];
  last_activity_at: string;
  channels?: { name?: string | null; phone_number?: string | null } | null;
  tenants?: { name?: string | null } | null;
};

type ConversationMessage = {
  id: string;
  session_id: string | null;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'bot' | 'agent' | 'system';
  body: string | null;
  status: string;
  created_at: string;
};

const humanStatuses = ['queued', 'handoff', 'open'];

const Inbox = () => {
  const queryClient = useQueryClient();
  const { user, userRole } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const canReply = userRole === 'admin' || userRole === 'manager';

  const sessionsQuery = useQuery({
    queryKey: ['inbox-sessions'],
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from('conversation_sessions')
        .select('*, channels(name, phone_number), tenants(name)')
        .order('last_activity_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Session[];
    },
    refetchInterval: 10000,
  });

  const sessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (sessionsQuery.data || []).filter((session) => {
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'human' ? humanStatuses.includes(session.status) : session.status === statusFilter);
      const searchMatch =
        !term ||
        session.sender_phone.toLowerCase().includes(term) ||
        session.channels?.name?.toLowerCase().includes(term) ||
        session.tenants?.name?.toLowerCase().includes(term);
      return statusMatch && searchMatch;
    });
  }, [sessionsQuery.data, search, statusFilter]);

  const selectedSession = sessions.find((session) => session.id === selectedId) || sessions[0] || null;

  const messagesQuery = useQuery({
    queryKey: ['inbox-messages', selectedSession?.id],
    enabled: Boolean(selectedSession?.id),
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from('conversation_messages')
        .select('*')
        .eq('session_id', selectedSession!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ConversationMessage[];
    },
    refetchInterval: 5000,
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const client = supabase as any;
      const { error } = await client
        .from('conversation_sessions')
        .update({ ...patch, last_activity_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-sessions'] }),
    onError: (err: any) => toast.error(err.message),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSession || !reply.trim()) return;
      const { error } = await supabase.functions.invoke('agent-reply', {
        body: { session_id: selectedSession.id, message: reply.trim() },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['inbox-messages', selectedSession?.id] });
      queryClient.invalidateQueries({ queryKey: ['inbox-sessions'] });
      toast.success('Reply sent');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const takeOver = () => {
    if (!selectedSession || !user) return;
    updateSessionMutation.mutate({
      id: selectedSession.id,
      patch: { status: 'handoff', assigned_to: user.id },
    });
  };

  const resolve = () => {
    if (!selectedSession) return;
    updateSessionMutation.mutate({
      id: selectedSession.id,
      patch: { status: 'resolved' },
    });
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-background">
      <aside className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <InboxIcon className="w-5 h-5" /> Inbox
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Human handoff and shared support queue</p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search phone or channel" className="pl-7 h-8 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All conversations</SelectItem>
              <SelectItem value="human">Needs humans</SelectItem>
              <SelectItem value="active">Bot active</SelectItem>
              <SelectItem value="handoff">Handoff</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessionsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading conversations...</p>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setSelectedId(session.id)}
              className={cn(
                'w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors',
                selectedSession?.id === session.id && 'bg-muted',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{session.sender_phone}</p>
                  <p className="text-[11px] text-muted-foreground">{session.channels?.name || 'WhatsApp'} · {session.tenants?.name || 'Tenant'}</p>
                </div>
                <Badge variant={statusVariant(session.status)} className="text-[10px]">{session.status}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">{selectedSession.sender_phone}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedSession.channels?.name || 'WhatsApp'} · {selectedSession.status}
                  {selectedSession.assigned_to ? ' · Assigned' : ' · Unassigned'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={takeOver} disabled={!canReply || updateSessionMutation.isPending}>
                  <UserCheck className="w-3.5 h-3.5 mr-1" /> Take over
                </Button>
                <Button variant="outline" size="sm" onClick={resolve} disabled={!canReply || updateSessionMutation.isPending}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolve
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(messagesQuery.data || []).length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground text-center">
                    No transcript messages logged yet. New WhatsApp messages will appear here after processing.
                  </CardContent>
                </Card>
              ) : messagesQuery.data?.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                >
                  <div className={cn(
                    'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                    message.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                  )}>
                    <p className="whitespace-pre-wrap">{message.body || '[non-text message]'}</p>
                    <p className={cn('text-[10px] mt-1', message.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {message.sender_type} · {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={canReply ? 'Type an agent reply...' : 'Only admins and managers can reply'}
                  disabled={!canReply || replyMutation.isPending}
                  className="min-h-[54px]"
                />
                <Button onClick={() => replyMutation.mutate()} disabled={!canReply || !reply.trim() || replyMutation.isPending} className="self-end">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a conversation to view the transcript.
          </div>
        )}
      </main>
    </div>
  );
};

const statusVariant = (status: string) => {
  if (status === 'handoff' || status === 'queued') return 'default';
  if (status === 'resolved' || status === 'closed') return 'outline';
  return 'secondary';
};

export default Inbox;
