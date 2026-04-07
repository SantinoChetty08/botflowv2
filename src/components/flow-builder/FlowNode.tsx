import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NODE_TYPE_CONFIGS } from './nodeTypes';

const FlowNode = memo(({ id, data, selected }: NodeProps) => {
  const config = NODE_TYPE_CONFIGS.find((c) => c.type === data.nodeType);
  if (!config) return null;

  const Icon = config.icon;
  const isCondition = data.nodeType === 'condition';
  const isBusinessHours = data.nodeType === 'businessHours';
  const isStart = data.nodeType === 'start';
  const isEnd = data.nodeType === 'end';
  const isListMenu = data.nodeType === 'listMenu';
  const isButtonOptions = data.nodeType === 'buttonOptions';
  const hasRouteOptions = isListMenu || isButtonOptions;

  // Collect route options for dynamic handles
  const getRouteOptions = (): { id: string; label: string }[] => {
    if (isButtonOptions) {
      return (data.config?.buttons || []).map((btn: any) => ({
        id: btn.value || btn.label,
        label: btn.label || 'Unnamed',
      }));
    }
    if (isListMenu) {
      const sections = data.config?.sections || [];
      const rows: { id: string; label: string }[] = [];
      sections.forEach((section: any) => {
        (section.rows || []).forEach((row: any) => {
          rows.push({ id: row.id, label: row.title || 'Unnamed' });
        });
      });
      return rows;
    }
    return [];
  };

  const routeOptions = hasRouteOptions ? getRouteOptions() : [];
  const hasMultipleOutputs = isCondition || isBusinessHours || (hasRouteOptions && routeOptions.length > 0);

  return (
    <div
      className={`
        relative group min-w-[200px] max-w-[260px] rounded-xl border-2 bg-card shadow-md transition-all duration-200
        ${selected ? 'shadow-lg scale-[1.02] border-primary' : 'border-transparent hover:shadow-lg hover:border-muted-foreground/20'}
      `}
    >
      {/* Color strip */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
        style={{ background: `hsl(var(${config.colorVar}))` }}
      />

      {/* Input handle */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/50 hover:!bg-primary transition-colors"
        />
      )}

      {/* Content */}
      <div className="px-3 py-3 pt-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
            style={{ background: `hsl(var(${config.colorVar}) / 0.15)`, color: `hsl(var(${config.colorVar}))` }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{data.label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{config.label}</p>
          </div>
        </div>

        {/* Preview content */}
        {data.config?.text && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 bg-muted/50 rounded-md px-2 py-1">
            {data.config.text}
          </p>
        )}
        {data.config?.question && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 bg-muted/50 rounded-md px-2 py-1">
            {data.config.question}
          </p>
        )}
        {data.config?.body && isListMenu && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 bg-muted/50 rounded-md px-2 py-1">
            {data.config.body}
          </p>
        )}
        {data.config?.url && (
          <p className="text-xs font-mono text-muted-foreground mt-2 truncate bg-muted/50 rounded-md px-2 py-1">
            {data.config.method} {data.config.url}
          </p>
        )}
        {data.config?.queueId && (
          <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-md px-2 py-1">
            Queue: {data.config.queueId}
          </p>
        )}

        {/* Route option labels for list/button nodes */}
        {hasRouteOptions && routeOptions.length > 0 && (
          <div className="mt-2 space-y-1">
            {routeOptions.map((opt, idx) => (
              <div
                key={opt.id}
                className="flex items-center gap-1.5 text-[10px] bg-muted/50 rounded px-2 py-0.5"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: `hsl(var(${config.colorVar}))` }}
                />
                <span className="truncate text-muted-foreground">{opt.label || `Option ${idx + 1}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output handles - single output for simple nodes */}
      {!isEnd && !hasMultipleOutputs && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/50 hover:!bg-primary transition-colors"
        />
      )}

      {/* Condition handles */}
      {(isCondition || isBusinessHours) && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-3 !h-3 !border-2 !border-card !bg-green-500 hover:!bg-green-400 transition-colors !left-[30%]"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-3 !h-3 !border-2 !border-card !bg-red-500 hover:!bg-red-400 transition-colors !left-[70%]"
          />
          <div className="flex justify-between px-4 pb-1 -mt-1">
            <span className="text-[9px] font-medium text-green-600">Yes</span>
            <span className="text-[9px] font-medium text-red-500">No</span>
          </div>
        </>
      )}

      {/* Dynamic route handles for list/button options */}
      {hasRouteOptions && routeOptions.length > 0 && (
        <>
          {routeOptions.map((opt, idx) => {
            const total = routeOptions.length;
            const leftPercent = total === 1 ? 50 : 15 + (idx * 70) / (total - 1);
            return (
              <Handle
                key={opt.id}
                type="source"
                position={Position.Bottom}
                id={opt.id}
                className="!w-3 !h-3 !border-2 !border-card hover:!bg-primary transition-colors"
                style={{
                  left: `${leftPercent}%`,
                  background: `hsl(var(${config.colorVar}))`,
                }}
              />
            );
          })}
          <div className="flex justify-between px-2 pb-1 -mt-1" style={{ gap: '2px' }}>
            {routeOptions.map((opt, idx) => (
              <span key={opt.id} className="text-[8px] font-medium text-muted-foreground truncate text-center flex-1">
                {opt.label || `${idx + 1}`}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Fallback single handle if route options node has no options yet */}
      {hasRouteOptions && routeOptions.length === 0 && !isEnd && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/50 hover:!bg-primary transition-colors"
        />
      )}
    </div>
  );
});

FlowNode.displayName = 'FlowNode';

export default FlowNode;
