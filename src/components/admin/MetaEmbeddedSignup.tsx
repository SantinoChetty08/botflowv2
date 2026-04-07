import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Copy, MessageSquare, Phone, Hash, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface MetaEmbeddedSignupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MetaCallbackData {
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  phoneNumber: string;
}

type Step = 'setup' | 'connecting' | 'connected' | 'error';

const MetaEmbeddedSignup = ({ open, onOpenChange }: MetaEmbeddedSignupProps) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('setup');
  const [tenantId, setTenantId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [metaData, setMetaData] = useState<MetaCallbackData | null>(null);
  const [channelResult, setChannelResult] = useState<{
    channelId?: string;
    webhookUrl?: string;
    verifyToken?: string;
    phoneNumber?: string;
    wabaId?: string;
    phoneNumberId?: string;
    error?: string;
  } | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) {
      setStep('setup');
      setTenantId('');
      setChannelName('');
      setMetaData(null);
      setChannelResult(null);
    }
  }, [open]);

  // Listen for Meta Embedded Signup postMessage callback
  const handleMetaCallback = useCallback((event: MessageEvent) => {
    if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://business.facebook.com') return;
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.type === 'WA_EMBEDDED_SIGNUP') {
        if (data.event === 'FINISH') {
          setMetaData({
            accessToken: data.data?.accessToken || data.data?.token || '',
            wabaId: data.data?.waba_id || data.data?.wabaId || '',
            phoneNumberId: data.data?.phone_number_id || data.data?.phoneNumberId || '',
            phoneNumber: data.data?.phone_number || data.data?.phoneNumber || '',
          });
        } else if (data.event === 'CANCEL') {
          toast.error('Meta signup was cancelled');
        } else if (data.event === 'ERROR') {
          toast.error('Meta signup failed: ' + (data.data?.error_message || 'Unknown error'));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMetaCallback);
    return () => window.removeEventListener('message', handleMetaCallback);
  }, [handleMetaCallback]);

  // Token exchange mutation
  const exchangeMutation = useMutation({
    mutationFn: async (data: MetaCallbackData) => {
      const { data: result, error } = await supabase.functions.invoke('meta-token-exchange', {
        body: {
          short_lived_token: data.accessToken,
          waba_id: data.wabaId,
          phone_number_id: data.phoneNumberId,
          phone_number: data.phoneNumber,
          tenant_id: tenantId,
          channel_name: channelName,
        },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      setChannelResult({
        channelId: data.channel_id,
        webhookUrl: data.webhook_url,
        verifyToken: data.verify_token,
        phoneNumber: metaData?.phoneNumber,
        wabaId: metaData?.wabaId,
        phoneNumberId: metaData?.phoneNumberId,
      });
      setStep('connected');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels-count'] });
      toast.success('WhatsApp channel connected!');
    },
    onError: (err: any) => {
      setChannelResult({ error: err.message });
      setStep('error');
      toast.error('Connection failed: ' + err.message);
    },
  });

  // Trigger exchange when metaData arrives
  useEffect(() => {
    if (metaData && tenantId && channelName) {
      setStep('connecting');
      exchangeMutation.mutate(metaData);
    }
  }, [metaData]); // eslint-disable-line react-hooks/exhaustive-deps

  const launchMetaSignup = () => {
    if (!tenantId || !channelName.trim()) {
      toast.error('Please select a tenant and enter a channel name');
      return;
    }
    const metaAppId = import.meta.env.VITE_META_APP_ID || '';
    if (!metaAppId) {
      toast.info('Meta App ID not configured. Use manual entry below.');
      return;
    }
    const configId = import.meta.env.VITE_META_CONFIG_ID || '';
    const w = 700, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(
      `https://www.facebook.com/v21.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=code&scope=whatsapp_business_management,whatsapp_business_messaging&extras=${encodeURIComponent(JSON.stringify({ setup: { channel: 'WHATSAPP', business_id: configId || undefined } }))}`,
      'meta_embedded_signup',
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`,
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {step === 'setup' ? 'Add New Channel' : step === 'connected' ? 'Channel Connected' : 'Connecting Channel'}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Setup ── */}
        {step === 'setup' && (
          <div className="space-y-5">
            <div>
              <Label>Tenant</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Channel Name</Label>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. Support Line, Sales Bot"
              />
            </div>

            <Separator />

            {/* Primary CTA */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connect with WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Sign in with Meta to link your business number</p>
                </div>
              </div>
              <Button
                onClick={launchMetaSignup}
                disabled={!tenantId || !channelName.trim()}
                className="w-full gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Connect with WhatsApp
              </Button>
            </div>

            <ManualMetaEntry
              tenantId={tenantId}
              channelName={channelName}
              onSubmit={(data) => setMetaData(data)}
            />

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Connecting ── */}
        {step === 'connecting' && (
          <div className="py-14 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <div>
              <p className="text-sm font-medium">Setting up your channel...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Exchanging tokens and generating webhook
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Connected (pre-filled read-only summary) ── */}
        {step === 'connected' && channelResult && (
          <div className="space-y-5">
            {/* Status banner */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold">Channel Connected</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="secondary" className="text-[10px]">Pending Verification</Badge>
                  <span className="text-[10px] text-muted-foreground">Waiting for Meta webhook verification</span>
                </div>
              </div>
            </div>

            {/* Read-only channel details */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Channel Name</Label>
                <Input readOnly value={channelName} className="bg-muted text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone Number
                  </Label>
                  <Input readOnly value={channelResult.phoneNumber || '—'} className="font-mono text-xs bg-muted" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Phone Number ID
                  </Label>
                  <Input readOnly value={channelResult.phoneNumberId || '—'} className="font-mono text-xs bg-muted" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">WABA ID</Label>
                <Input readOnly value={channelResult.wabaId || '—'} className="font-mono text-xs bg-muted" />
              </div>
            </div>

            <Separator />

            {/* Webhook configuration info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Webhook Configuration
              </h4>
              <div className="space-y-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Callback URL</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={channelResult.webhookUrl} className="font-mono text-xs bg-muted" />
                    <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(channelResult.webhookUrl!, 'Webhook URL')}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Verify Token</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={channelResult.verifyToken} className="font-mono text-xs bg-muted" />
                    <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(channelResult.verifyToken!, 'Verify Token')}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Next steps */}
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Next Steps to Activate
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to <strong>Meta App Dashboard → WhatsApp → Configuration</strong></li>
                <li>Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> above</li>
                <li>Subscribe to the <strong>messages</strong> webhook field</li>
                <li>Status will change to <strong>Active</strong> once Meta verifies the webhook</li>
              </ol>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {step === 'error' && channelResult && (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">Connection Failed</p>
              <p className="text-xs text-muted-foreground">{channelResult.error}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('setup')}>Try Again</Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Manual entry fallback ──
function ManualMetaEntry({
  tenantId,
  channelName,
  onSubmit,
}: {
  tenantId: string;
  channelName: string;
  onSubmit: (data: MetaCallbackData) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  if (!expanded) {
    return (
      <button
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
        onClick={() => setExpanded(true)}
      >
        Or enter credentials manually →
      </button>
    );
  }

  return (
    <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
      <h4 className="text-xs font-semibold text-muted-foreground">Manual Credential Entry</h4>
      <div>
        <Label className="text-xs">System User Access Token</Label>
        <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAxxxxxxxxx..." className="text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">WABA ID</Label>
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="123456789" className="text-xs" />
        </div>
        <div>
          <Label className="text-xs">Phone Number ID</Label>
          <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="123456789" className="text-xs" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Phone Number</Label>
        <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1234567890" className="text-xs" />
      </div>
      <Button
        size="sm"
        disabled={!accessToken || !wabaId || !phoneNumberId || !phoneNumber || !tenantId || !channelName}
        onClick={() => onSubmit({ accessToken, wabaId, phoneNumberId, phoneNumber })}
        className="w-full"
      >
        Connect Manually
      </Button>
    </div>
  );
}

export default MetaEmbeddedSignup;
