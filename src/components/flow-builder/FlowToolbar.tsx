import { useFlowStore } from '@/store/flowStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, Upload, CheckCircle, Pencil, Undo2, Redo2, Play, ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import PublishFlowDialog from './PublishFlowDialog';

interface FlowToolbarProps {
  simulatorOpen?: boolean;
  onToggleSimulator?: () => void;
}

const FlowToolbar = ({ simulatorOpen, onToggleSimulator }: FlowToolbarProps) => {
  const { flowName, flowStatus, versionNumber, isDirty, isSaving, flowId, setFlowName, saveFlow, publishFlow, validateFlow, undo, redo, canUndo, canRedo } = useFlowStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(flowName);
  const [publishOpen, setPublishOpen] = useState(false);

  const handleSave = async () => {
    try {
      await saveFlow();
      toast.success('Flow saved successfully');
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    }
  };

  const handleValidate = () => {
    const errors = validateFlow();
    if (errors.length === 0) {
      toast.success('Flow is valid!');
    } else {
      errors.forEach((err) => toast.error(err));
    }
  };

  const handlePublish = () => {
    setPublishOpen(true);
  };

  const handleNameSubmit = () => {
    setFlowName(nameInput);
    setEditing(false);
  };

  return (
    <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate('/admin/flows')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Back to flows</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2">
          {editing ? (
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="h-7 text-sm font-semibold w-56"
            />
          ) : (
            <button
              onClick={() => { setNameInput(flowName); setEditing(true); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
            >
              {flowName}
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <Badge variant={flowStatus === 'published' ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wider">
          {flowStatus}
        </Badge>
        <span className="text-[10px] text-muted-foreground font-mono">v{versionNumber}</span>
        {isDirty && <span className="text-[10px] text-orange-500 font-medium">● Unsaved</span>}

        <div className="flex items-center gap-0.5 ml-2 border-l border-border pl-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undo} disabled={!canUndo}>
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={redo} disabled={!canRedo}>
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={simulatorOpen ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleSimulator}
        >
          <Play className="w-3 h-3" /> Simulate
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleValidate}>
          <CheckCircle className="w-3 h-3" /> Validate
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handlePublish} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Publish
        </Button>
      </div>
      <PublishFlowDialog open={publishOpen} onOpenChange={setPublishOpen} />
    </div>
  );
};

export default FlowToolbar;
