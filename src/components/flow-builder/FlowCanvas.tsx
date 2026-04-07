import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowStore, NodeType } from '@/store/flowStore';
import FlowNode from './FlowNode';
import { toast } from 'sonner';

const nodeTypes = {
  start: FlowNode,
  sendMessage: FlowNode,
  askQuestion: FlowNode,
  buttonOptions: FlowNode,
  listMenu: FlowNode,
  captureInput: FlowNode,
  condition: FlowNode,
  setVariable: FlowNode,
  apiWebhook: FlowNode,
  queueRoute: FlowNode,
  agentHandoff: FlowNode,
  businessHours: FlowNode,
  delay: FlowNode,
  end: FlowNode,
  goTo: FlowNode,
};

const FlowCanvas = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode,
    selectedNodeId, duplicateNode, copySelectedNodes, pasteNodes, undo, redo,
  } = useFlowStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key === 'c') {
        e.preventDefault();
        copySelectedNodes();
        toast.info('Copied to clipboard');
      } else if (mod && e.key === 'v') {
        e.preventDefault();
        pasteNodes();
      } else if (mod && e.key === 'd') {
        e.preventDefault();
        if (selectedNodeId) {
          duplicateNode(selectedNodeId);
          toast.success('Node duplicated');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, copySelectedNodes, pasteNodes, duplicateNode, undo, redo]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left - 100,
        y: event.clientY - bounds.top - 30,
      };

      addNode(type, position);
    },
    [addNode]
  );

  const onNodeClick = useCallback((_: any, node: any) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--canvas-dot))"
        />
        <Controls />
        <MiniMap
          nodeStrokeColor="hsl(var(--border))"
          nodeColor="hsl(var(--card))"
          maskColor="hsl(var(--background) / 0.7)"
          className="!bg-card"
        />
      </ReactFlow>
    </div>
  );
};

const FlowCanvasWrapper = () => (
  <ReactFlowProvider>
    <FlowCanvas />
  </ReactFlowProvider>
);

export default FlowCanvasWrapper;
