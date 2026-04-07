import { useFlowStore } from '@/store/flowStore';
import { NODE_TYPE_CONFIGS } from './nodeTypes';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Trash2, Copy, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import ListMenuConfig from './node-configs/ListMenuConfig';
import ButtonOptionsConfig from './node-configs/ButtonOptionsConfig';

const NodeConfigPanel = () => {
  const { nodes, selectedNodeId, selectNode, updateNodeData, deleteNode, duplicateNode, copySelectedNodes } = useFlowStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node || !selectedNodeId) {
    return (
      <div className="w-72 bg-card border-l border-border flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground text-center">Select a node to configure</p>
      </div>
    );
  }

  const typeConfig = NODE_TYPE_CONFIGS.find((c) => c.type === node.data.nodeType);
  if (!typeConfig) return null;

  const Icon = typeConfig.icon;
  const config = node.data.config || {};

  const update = (key: string, value: any) => {
    updateNodeData(selectedNodeId, { config: { ...config, [key]: value } });
  };

  const renderFields = () => {
    switch (node.data.nodeType) {
      case 'start':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Trigger Type</Label>
              <Select value={config.triggerType} onValueChange={(v) => update('triggerType', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Any Message</SelectItem>
                  <SelectItem value="keyword">Keyword Match</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'sendMessage':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Message Text</Label>
              <Textarea
                value={config.text || ''}
                onChange={(e) => update('text', e.target.value)}
                placeholder="Type your message..."
                className="mt-1 text-xs min-h-[80px]"
              />
            </div>
            <div>
              <Label className="text-xs">Media URL (optional)</Label>
              <Input value={config.mediaUrl || ''} onChange={(e) => update('mediaUrl', e.target.value)} className="mt-1 h-8 text-xs" placeholder="https://..." />
            </div>
          </div>
        );

      case 'askQuestion':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Question</Label>
              <Textarea value={config.question || ''} onChange={(e) => update('question', e.target.value)} className="mt-1 text-xs min-h-[60px]" placeholder="What would you like to know?" />
            </div>
            <div>
              <Label className="text-xs">Save to Variable</Label>
              <Input value={config.variableName || ''} onChange={(e) => update('variableName', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="user_response" />
            </div>
            <div>
              <Label className="text-xs">Input Type</Label>
              <Select value={config.inputType} onValueChange={(v) => update('inputType', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max Retries</Label>
              <Input type="number" value={config.retries || 3} onChange={(e) => update('retries', parseInt(e.target.value))} className="mt-1 h-8 text-xs" />
            </div>
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Left Operand</Label>
              <Input value={config.leftOperand || ''} onChange={(e) => update('leftOperand', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="{{variable}}" />
            </div>
            <div>
              <Label className="text-xs">Operator</Label>
              <Select value={config.operator} onValueChange={(v) => update('operator', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                  <SelectItem value="exists">Exists</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Right Operand</Label>
              <Input value={config.rightOperand || ''} onChange={(e) => update('rightOperand', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="value" />
            </div>
          </div>
        );

      case 'queueRoute':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Route Method</Label>
              <Select value={config.routeMethod} onValueChange={(v) => update('routeMethod', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct Queue</SelectItem>
                  <SelectItem value="rule_based">Rule Based</SelectItem>
                  <SelectItem value="api_based">API Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Queue ID</Label>
              <Input value={config.queueId || ''} onChange={(e) => update('queueId', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="sales-q1" />
            </div>
            <div>
              <Label className="text-xs">Fallback Queue ID</Label>
              <Input value={config.fallbackQueueId || ''} onChange={(e) => update('fallbackQueueId', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="general-q1" />
            </div>
            <div>
              <Label className="text-xs">Failure Message</Label>
              <Textarea value={config.failureMessage || ''} onChange={(e) => update('failureMessage', e.target.value)} className="mt-1 text-xs" placeholder="No agents available..." />
            </div>
          </div>
        );

      case 'agentHandoff':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Queue ID</Label>
              <Input value={config.queueId || ''} onChange={(e) => update('queueId', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="queue-id" />
            </div>
            <div>
              <Label className="text-xs">Handoff Message</Label>
              <Textarea value={config.message || ''} onChange={(e) => update('message', e.target.value)} className="mt-1 text-xs" />
            </div>
          </div>
        );

      case 'apiWebhook':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={config.method} onValueChange={(v) => update('method', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">URL</Label>
              <Input value={config.url || ''} onChange={(e) => update('url', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="https://api.example.com/..." />
            </div>
            <div>
              <Label className="text-xs">Timeout (ms)</Label>
              <Input type="number" value={config.timeout || 5000} onChange={(e) => update('timeout', parseInt(e.target.value))} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Output Variable</Label>
              <Input value={config.outputVariable || ''} onChange={(e) => update('outputVariable', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="api_result" />
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Duration</Label>
              <Input type="number" value={config.duration || 2} onChange={(e) => update('duration', parseInt(e.target.value))} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={config.unit} onValueChange={(v) => update('unit', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Seconds</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'setVariable':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Variable Name</Label>
              <Input value={config.variableName || ''} onChange={(e) => update('variableName', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="my_variable" />
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input value={config.value || ''} onChange={(e) => update('value', e.target.value)} className="mt-1 h-8 text-xs font-mono" placeholder="value or {{variable}}" />
            </div>
          </div>
        );

      case 'businessHours':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Timezone</Label>
              <Input value={config.timezone || 'UTC'} onChange={(e) => update('timezone', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <p className="text-[10px] text-muted-foreground">Schedule configuration coming soon. Routes to "Yes" during hours, "No" after hours.</p>
          </div>
        );

      case 'end':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Closing Message (optional)</Label>
              <Textarea value={config.message || ''} onChange={(e) => update('message', e.target.value)} className="mt-1 text-xs" placeholder="Thank you for contacting us!" />
            </div>
          </div>
        );

      case 'listMenu':
        return <ListMenuConfig config={config} onUpdate={update} />;

      case 'buttonOptions':
        return <ButtonOptionsConfig config={config} onUpdate={update} />;

      default:
        return <p className="text-xs text-muted-foreground">Configuration for this node type is coming soon.</p>;
    }
  };

  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: `hsl(var(${typeConfig.colorVar}) / 0.15)`, color: `hsl(var(${typeConfig.colorVar}))` }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{typeConfig.label}</p>
            <p className="text-[10px] text-muted-foreground">{typeConfig.description}</p>
          </div>
        </div>
        <button onClick={() => selectNode(null)} className="text-muted-foreground hover:text-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Node label */}
      <div className="p-3 border-b border-border">
        <Label className="text-xs">Node Label</Label>
        <Input
          value={node.data.label}
          onChange={(e) => updateNodeData(selectedNodeId, { label: e.target.value })}
          className="mt-1 h-8 text-xs"
        />
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderFields()}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        {node.data.nodeType !== 'start' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8 gap-1"
              onClick={() => {
                duplicateNode(selectedNodeId);
                toast.success('Node duplicated');
              }}
            >
              <Copy className="w-3 h-3" /> Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8 gap-1"
              onClick={() => {
                copySelectedNodes();
                toast.info('Copied to clipboard');
              }}
            >
              <Clipboard className="w-3 h-3" /> Copy
            </Button>
          </div>
        )}
        {node.data.nodeType !== 'start' && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-xs h-8"
            onClick={() => deleteNode(selectedNodeId)}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete Node
          </Button>
        )}
      </div>
    </div>
  );
};

export default NodeConfigPanel;
