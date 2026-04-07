import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, KeyRound, RefreshCw, Eye, EyeOff, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChannelApiCredentialsProps {
  channel: {
    id: string;
    name: string;
    config: any;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

const ChannelApiCredentials = ({ channel, open, onOpenChange }: ChannelApiCredentialsProps) => {
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data: any; status: number } | null>(null);

  const config = (channel.config as Record<string, any>) || {};
  const apiToken = config.api_token || null;
  const apiSecret = config.api_secret || null;
  const generatedAt = config.credentials_generated_at || null;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const newToken = `cht_${generateToken(24)}`;
      const newSecret = `chs_${generateToken(32)}`;
      const updatedConfig = {
        ...config,
        api_token: newToken,
        api_secret: newSecret,
        credentials_generated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('channels')
        .update({ config: updatedConfig })
        .eq('id', channel.id);
      if (error) throw error;
      return { token: newToken, secret: newSecret };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('API credentials generated successfully');
      setShowSecret(true);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyIntegrationSnippet = () => {
    const snippet = JSON.stringify({
      channel_id: channel.id,
      api_token: apiToken,
      api_secret: apiSecret,
      webhook_endpoint: `${window.location.origin}/api/webhook/${channel.id}`,
    }, null, 2);
    navigator.clipboard.writeText(snippet);
    toast.success('Integration config copied to clipboard');
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook/${channel.id}`;
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': apiToken,
          'x-api-secret': apiSecret,
        },
        body: JSON.stringify({
          metadata: { sender_phone: '+0000000000', session_id: 'test_connection' },
        }),
      });
      const data = await res.json();
      return { success: res.ok, data, status: res.status };
    },
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        toast.success('Webhook connection successful');
      } else {
        toast.error(`Webhook returned ${result.status}`);
      }
    },
    onError: (err: any) => {
      setTestResult({ success: false, data: { error: err.message }, status: 0 });
      toast.error('Connection failed: ' + err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            API Credentials — {channel.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel ID */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Channel ID</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={channel.id} className="font-mono text-xs bg-muted" />
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(channel.id, 'Channel ID')}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {apiToken ? (
            <>
              {/* API Token */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">API Token</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={apiToken} className="font-mono text-xs bg-muted" />
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(apiToken, 'API Token')}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* API Secret */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">API Secret</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={showSecret ? 'text' : 'password'}
                    value={apiSecret}
                    className="font-mono text-xs bg-muted"
                  />
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(apiSecret, 'API Secret')}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {generatedAt && (
                <p className="text-xs text-muted-foreground">
                  Generated: {new Date(generatedAt).toLocaleString()}
                </p>
              )}

              {/* Integration Config */}
              <div className="rounded-md border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">HoduCC Integration Config</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={copyIntegrationSnippet}>
                    <Copy className="w-3 h-3" /> Copy Config
                  </Button>
                </div>
                <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre">
{JSON.stringify({
  channel_id: channel.id,
  api_token: showSecret ? apiToken : '••••••••',
  api_secret: showSecret ? apiSecret : '••••••••',
  webhook_endpoint: `${window.location.origin}/api/webhook/${channel.id}`,
}, null, 2)}
                </pre>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate Credentials
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Test Connection
                </Button>
              </div>
              <p className="text-[11px] text-destructive">
                ⚠ Regenerating credentials will invalidate the current token and secret.
              </p>

              {testResult && (
                <div className={`rounded-md border p-3 space-y-2 ${testResult.success ? 'border-green-600/30 bg-green-50/50 dark:bg-green-950/20' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-xs font-semibold">
                      {testResult.success ? 'Connection Successful' : `Error (HTTP ${testResult.status})`}
                    </span>
                  </div>
                  <ScrollArea className="max-h-40">
                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre overflow-x-auto">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 space-y-3">
              <Badge variant="secondary" className="mb-2">No credentials generated</Badge>
              <p className="text-sm text-muted-foreground">
                Generate API credentials for this channel to integrate with HoduCC.
              </p>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-1"
              >
                <KeyRound className="w-4 h-4" />
                {generateMutation.isPending ? 'Generating...' : 'Generate API Credentials'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelApiCredentials;
