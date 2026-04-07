import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface ButtonOption {
  label: string;
  value: string;
}

interface ButtonOptionsConfigProps {
  config: Record<string, any>;
  onUpdate: (key: string, value: any) => void;
}

const ButtonOptionsConfig = ({ config, onUpdate }: ButtonOptionsConfigProps) => {
  const buttons: ButtonOption[] = config.buttons || [];

  const updateButtons = (newButtons: ButtonOption[]) => {
    onUpdate('buttons', newButtons);
  };

  const addButton = () => {
    if (buttons.length >= 3) return; // WhatsApp limit
    updateButtons([...buttons, { label: '', value: `opt_${Date.now()}` }]);
  };

  const removeButton = (index: number) => {
    updateButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: string, value: string) => {
    const updated = buttons.map((btn, i) =>
      i === index ? { ...btn, [field]: value } : btn
    );
    updateButtons(updated);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Message Text</Label>
        <Textarea
          value={config.text || ''}
          onChange={(e) => onUpdate('text', e.target.value)}
          className="mt-1 text-xs min-h-[60px]"
          placeholder="Choose one of the options below:"
        />
      </div>
      <div>
        <Label className="text-xs">Save Selection to Variable</Label>
        <Input
          value={config.variableName || ''}
          onChange={(e) => onUpdate('variableName', e.target.value)}
          className="mt-1 h-8 text-xs font-mono"
          placeholder="user_choice"
        />
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Button Routes</Label>
          <span className="text-[10px] text-muted-foreground">{buttons.length}/3</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">Each button creates an output route on the node. Connect each to a different path.</p>

        <div className="space-y-2">
          {buttons.map((btn, idx) => (
            <div key={idx} className="flex items-center gap-1.5 group">
              <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              <div className="flex-1 flex gap-1.5">
                <Input
                  value={btn.label}
                  onChange={(e) => updateButton(idx, 'label', e.target.value)}
                  className="h-7 text-[11px]"
                  placeholder={`Button ${idx + 1} label`}
                />
                <Input
                  value={btn.value}
                  onChange={(e) => updateButton(idx, 'value', e.target.value)}
                  className="h-7 text-[11px] font-mono w-24"
                  placeholder="value"
                />
              </div>
              <button
                onClick={() => removeButton(idx)}
                className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {buttons.length < 3 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[10px] gap-1 border-dashed mt-2"
            onClick={addButton}
          >
            <Plus className="w-3 h-3" /> Add Button
          </Button>
        )}
      </div>
    </div>
  );
};

export default ButtonOptionsConfig;
