import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Trash2 } from 'lucide-react';

interface ListMenuOption {
  id: string;
  title: string;
  description?: string;
}

interface ListMenuSection {
  title: string;
  rows: ListMenuOption[];
}

interface ListMenuConfigProps {
  config: Record<string, any>;
  onUpdate: (key: string, value: any) => void;
}

const ListMenuConfig = ({ config, onUpdate }: ListMenuConfigProps) => {
  const sections: ListMenuSection[] = config.sections || [{ title: 'Options', rows: [] }];

  const updateSections = (newSections: ListMenuSection[]) => {
    onUpdate('sections', newSections);
  };

  const addOption = (sectionIndex: number) => {
    const updated = [...sections];
    const newId = `opt_${Date.now()}`;
    updated[sectionIndex].rows.push({ id: newId, title: '', description: '' });
    updateSections(updated);
  };

  const removeOption = (sectionIndex: number, rowIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].rows.splice(rowIndex, 1);
    updateSections(updated);
  };

  const updateOption = (sectionIndex: number, rowIndex: number, field: string, value: string) => {
    const updated = JSON.parse(JSON.stringify(sections));
    updated[sectionIndex].rows[rowIndex][field] = value;
    updateSections(updated);
  };

  const addSection = () => {
    updateSections([...sections, { title: 'New Section', rows: [] }]);
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    const updated = sections.filter((_, i) => i !== index);
    updateSections(updated);
  };

  const updateSectionTitle = (index: number, title: string) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], title };
    updateSections(updated);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Header Text</Label>
        <Input
          value={config.header || ''}
          onChange={(e) => onUpdate('header', e.target.value)}
          className="mt-1 h-8 text-xs"
          placeholder="Menu header"
        />
      </div>
      <div>
        <Label className="text-xs">Body Message</Label>
        <Textarea
          value={config.body || ''}
          onChange={(e) => onUpdate('body', e.target.value)}
          className="mt-1 text-xs min-h-[60px]"
          placeholder="Please select an option from the list below..."
        />
      </div>
      <div>
        <Label className="text-xs">Button Text</Label>
        <Input
          value={config.buttonText || 'Select'}
          onChange={(e) => onUpdate('buttonText', e.target.value)}
          className="mt-1 h-8 text-xs"
          placeholder="Select"
        />
      </div>
      <div>
        <Label className="text-xs">Save Selection to Variable</Label>
        <Input
          value={config.variableName || ''}
          onChange={(e) => onUpdate('variableName', e.target.value)}
          className="mt-1 h-8 text-xs font-mono"
          placeholder="user_selection"
        />
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Routing Options</Label>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={addSection}>
            <Plus className="w-3 h-3" /> Section
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">Each option creates an output route on the node. Connect each to a different path.</p>

        {sections.map((section, sIdx) => (
          <div key={sIdx} className="mb-3 border border-border rounded-lg overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-1 bg-muted/50 px-2 py-1.5">
              <Input
                value={section.title}
                onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                className="h-6 text-[11px] font-medium border-none bg-transparent p-0 focus-visible:ring-0"
                placeholder="Section title"
              />
              {sections.length > 1 && (
                <button onClick={() => removeSection(sIdx)} className="text-muted-foreground hover:text-destructive p-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Options */}
            <div className="p-2 space-y-2">
              {section.rows.map((row, rIdx) => (
                <div key={row.id} className="flex items-start gap-1.5 group">
                  <GripVertical className="w-3 h-3 text-muted-foreground/40 mt-2 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Input
                      value={row.title}
                      onChange={(e) => updateOption(sIdx, rIdx, 'title', e.target.value)}
                      className="h-7 text-[11px]"
                      placeholder={`Option ${rIdx + 1} title`}
                    />
                    <Input
                      value={row.description || ''}
                      onChange={(e) => updateOption(sIdx, rIdx, 'description', e.target.value)}
                      className="h-6 text-[10px] text-muted-foreground"
                      placeholder="Description (optional)"
                    />
                  </div>
                  <button
                    onClick={() => removeOption(sIdx, rIdx)}
                    className="text-muted-foreground hover:text-destructive p-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px] gap-1 border-dashed"
                onClick={() => addOption(sIdx)}
              >
                <Plus className="w-3 h-3" /> Add Option
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ListMenuConfig;
