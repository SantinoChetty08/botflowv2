import { useState } from 'react';
import { NODE_TYPE_CONFIGS, CATEGORIES } from './nodeTypes';
import { Search, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';

const NodePalette = () => {
  const [search, setSearch] = useState('');

  const filtered = NODE_TYPE_CONFIGS.filter(
    (n) =>
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase())
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Nodes</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/50 border-border"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {CATEGORIES.map((cat) => {
          const nodes = filtered.filter((n) => n.category === cat.key);
          if (nodes.length === 0) return null;

          return (
            <div key={cat.key}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-1.5">
                {cat.label}
              </p>
              <div className="space-y-1">
                {nodes.map((nodeConfig) => {
                  const Icon = nodeConfig.icon;
                  return (
                    <div
                      key={nodeConfig.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, nodeConfig.type)}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-muted/80 transition-colors group border border-transparent hover:border-border"
                    >
                      <div
                        className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                        style={{
                          background: `hsl(var(${nodeConfig.colorVar}) / 0.12)`,
                          color: `hsl(var(${nodeConfig.colorVar}))`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{nodeConfig.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{nodeConfig.description}</p>
                      </div>
                      <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NodePalette;
