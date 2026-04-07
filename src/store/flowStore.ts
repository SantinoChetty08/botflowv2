import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { supabase } from '@/integrations/supabase/client';

export type NodeType =
  | 'start' | 'sendMessage' | 'askQuestion' | 'buttonOptions' | 'listMenu'
  | 'captureInput' | 'condition' | 'setVariable' | 'apiWebhook'
  | 'queueRoute' | 'agentHandoff' | 'businessHours' | 'delay' | 'end' | 'goTo';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  clipboard: { nodes: Node[]; edges: Edge[] } | null;
  flowId: string | null;
  tenantId: string | null;
  flowName: string;
  flowDescription: string;
  flowStatus: 'draft' | 'published';
  versionNumber: number;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  selectNode: (id: string | null) => void;
  updateNodeData: (id: string, data: Record<string, any>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  copySelectedNodes: () => void;
  pasteNodes: () => void;
  undo: () => void;
  redo: () => void;
  setFlowName: (name: string) => void;
  loadFlow: (flowId: string) => Promise<void>;
  saveFlow: () => Promise<void>;
  publishFlow: () => Promise<void>;
  resetFlow: () => void;
  validateFlow: () => string[];
}

const NODE_DEFAULTS: Record<NodeType, { label: string; config: Record<string, any> }> = {
  start: { label: 'Start', config: { triggerType: 'message' } },
  sendMessage: { label: 'Send Message', config: { text: '', mediaUrl: '', buttons: [] } },
  askQuestion: { label: 'Ask Question', config: { question: '', inputType: 'text', variableName: '', retries: 3, invalidMessage: 'Invalid input, please try again.' } },
  buttonOptions: { label: 'Button Options', config: { text: '', buttons: [{ label: 'Option 1', value: 'opt1' }, { label: 'Option 2', value: 'opt2' }] } },
  listMenu: { label: 'List Menu', config: { header: '', body: '', buttonText: 'Select', sections: [{ title: 'Options', rows: [{ id: '1', title: 'Item 1' }] }] } },
  captureInput: { label: 'Capture Input', config: { prompt: '', variableName: '', validation: 'none' } },
  condition: { label: 'Condition', config: { leftOperand: '', operator: 'equals', rightOperand: '' } },
  setVariable: { label: 'Set Variable', config: { variableName: '', value: '' } },
  apiWebhook: { label: 'API Request', config: { method: 'GET', url: '', headers: {}, body: '', timeout: 5000, outputVariable: '' } },
  queueRoute: { label: 'Queue Route', config: { routeMethod: 'direct', queueId: '', fallbackQueueId: '', failureMessage: '' } },
  agentHandoff: { label: 'Agent Handoff', config: { queueId: '', message: 'Connecting you to an agent...', contextVariables: [] } },
  businessHours: { label: 'Business Hours', config: { timezone: 'UTC', schedule: {} } },
  delay: { label: 'Delay', config: { duration: 2, unit: 'seconds' } },
  end: { label: 'End', config: { message: '' } },
  goTo: { label: 'Go To', config: { targetNodeId: '' } },
};

let nodeIdCounter = 1;

const initialNodes: Node[] = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 400, y: 50 },
    data: { label: 'Start', nodeType: 'start', config: { triggerType: 'message' } },
  },
  {
    id: 'msg-1',
    type: 'sendMessage',
    position: { x: 400, y: 200 },
    data: { label: 'Welcome Message', nodeType: 'sendMessage', config: { text: 'Welcome! How can we help you today?', buttons: [{ label: 'Sales', value: 'sales' }, { label: 'Support', value: 'support' }] } },
  },
  {
    id: 'cond-1',
    type: 'condition',
    position: { x: 400, y: 400 },
    data: { label: 'Route by Choice', nodeType: 'condition', config: { leftOperand: '{{user_choice}}', operator: 'equals', rightOperand: 'sales' } },
  },
  {
    id: 'queue-1',
    type: 'queueRoute',
    position: { x: 200, y: 600 },
    data: { label: 'Sales Queue', nodeType: 'queueRoute', config: { routeMethod: 'direct', queueId: 'sales-q1', failureMessage: 'Sorry, no agents available.' } },
  },
  {
    id: 'queue-2',
    type: 'queueRoute',
    position: { x: 600, y: 600 },
    data: { label: 'Support Queue', nodeType: 'queueRoute', config: { routeMethod: 'direct', queueId: 'support-q1', failureMessage: 'Sorry, no agents available.' } },
  },
];

const initialEdges: Edge[] = [
  { id: 'e-start-msg', source: 'start-1', target: 'msg-1', animated: true },
  { id: 'e-msg-cond', source: 'msg-1', target: 'cond-1' },
  { id: 'e-cond-sales', source: 'cond-1', target: 'queue-1', label: 'Yes', sourceHandle: 'true' },
  { id: 'e-cond-support', source: 'cond-1', target: 'queue-2', label: 'No', sourceHandle: 'false' },
];

// --- Undo/Redo history management ---
const MAX_HISTORY = 50;
const undoStack: Snapshot[] = [];
const redoStack: Snapshot[] = [];

function takeSnapshot(state: { nodes: Node[]; edges: Edge[] }): Snapshot {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
  };
}

function pushUndo(state: { nodes: Node[]; edges: Edge[] }) {
  undoStack.push(takeSnapshot(state));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  // Clear redo on new action
  redoStack.length = 0;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  selectedNodeIds: [],
  clipboard: null,
  flowId: null,
  tenantId: null,
  flowName: 'New Flow',
  flowDescription: '',
  flowStatus: 'draft',
  versionNumber: 1,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  isSaving: false,

  onNodesChange: (changes) => {
    // Only snapshot for structural changes (add/remove), not drags/selections
    const isStructural = changes.some((c) => c.type === 'remove' || c.type === 'add');
    if (isStructural) pushUndo(get());
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    }));
  },

  onEdgesChange: (changes) => {
    const isStructural = changes.some((c) => c.type === 'remove' || c.type === 'add');
    if (isStructural) pushUndo(get());
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    }));
  },

  onConnect: (connection) => {
    pushUndo(get());
    set((state) => ({
      edges: addEdge({ ...connection, animated: false }, state.edges),
      isDirty: true,
      canUndo: true,
      canRedo: false,
    }));
  },

  addNode: (type, position) => {
    pushUndo(get());
    const defaults = NODE_DEFAULTS[type];
    const id = `${type}-${++nodeIdCounter}`;
    const newNode: Node = {
      id,
      type,
      position,
      data: { label: defaults.label, nodeType: type, config: { ...defaults.config } },
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
      isDirty: true,
      canUndo: true,
      canRedo: false,
    }));
  },

  selectNode: (id) => set({
    selectedNodeId: id,
    selectedNodeIds: id ? [id] : [],
  }),

  updateNodeData: (id, data) => {
    pushUndo(get());
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
      canUndo: true,
      canRedo: false,
    }));
  },

  deleteNode: (id) => {
    pushUndo(get());
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      selectedNodeIds: state.selectedNodeIds.filter((nid) => nid !== id),
      isDirty: true,
      canUndo: true,
      canRedo: false,
    }));
  },

  duplicateNode: (id) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === id);
    if (!node || node.type === 'start') return;

    pushUndo(state);
    const newId = `${node.type}-${++nodeIdCounter}`;
    const newNode: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 50, y: node.position.y + 80 },
      data: { ...node.data, label: `${node.data.label} (copy)`, config: { ...node.data.config } },
      selected: false,
    };
    set((s) => ({
      nodes: [...s.nodes, newNode],
      selectedNodeId: newId,
      selectedNodeIds: [newId],
      isDirty: true,
      canUndo: true,
      canRedo: false,
    }));
  },

  copySelectedNodes: () => {
    const { nodes, edges, selectedNodeIds, selectedNodeId } = get();
    const ids = selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];
    if (ids.length === 0) return;

    const copiedNodes = nodes.filter((n) => ids.includes(n.id) && n.type !== 'start');
    if (copiedNodes.length === 0) return;

    const nodeIdSet = new Set(copiedNodes.map((n) => n.id));
    const copiedEdges = edges.filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));

    set({ clipboard: { nodes: copiedNodes, edges: copiedEdges } });
  },

  pasteNodes: () => {
    const { clipboard } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    pushUndo(get());
    const idMap = new Map<string, string>();
    const newNodes: Node[] = clipboard.nodes.map((node) => {
      const newId = `${node.type}-${++nodeIdCounter}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        position: { x: node.position.x + 80, y: node.position.y + 80 },
        data: { ...node.data, label: `${node.data.label}`, config: { ...node.data.config } },
        selected: true,
      };
    });

    const newEdges: Edge[] = clipboard.edges.map((edge) => ({
      ...edge,
      id: `e-${idMap.get(edge.source)}-${idMap.get(edge.target)}-${Date.now()}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }));

    set((state) => ({
      nodes: [...state.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...state.edges, ...newEdges],
      selectedNodeIds: newNodes.map((n) => n.id),
      selectedNodeId: newNodes.length === 1 ? newNodes[0].id : null,
      isDirty: true,
      canUndo: true,
      canRedo: false,
    }));
  },

  undo: () => {
    if (undoStack.length === 0) return;
    const current = takeSnapshot(get());
    redoStack.push(current);
    const prev = undoStack.pop()!;
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      isDirty: true,
      selectedNodeId: null,
      selectedNodeIds: [],
      canUndo: undoStack.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    if (redoStack.length === 0) return;
    const current = takeSnapshot(get());
    undoStack.push(current);
    const next = redoStack.pop()!;
    set({
      nodes: next.nodes,
      edges: next.edges,
      isDirty: true,
      selectedNodeId: null,
      selectedNodeIds: [],
      canUndo: true,
      canRedo: redoStack.length > 0,
    });
  },

  setFlowName: (name) => set({ flowName: name, isDirty: true }),

  loadFlow: async (flowId: string) => {
    const { data, error } = await supabase.from('flows').select('*').eq('id', flowId).single();
    if (error || !data) return;
    const flowData = (data.flow_data as any) || {};
    const nodes = flowData.nodes || initialNodes;
    const edges = flowData.edges || initialEdges;
    // Reset undo/redo stacks
    undoStack.length = 0;
    redoStack.length = 0;
    set({
      flowId: data.id,
      tenantId: data.tenant_id,
      flowName: data.name,
      flowDescription: data.description || '',
      flowStatus: (data.status as 'draft' | 'published') || 'draft',
      versionNumber: data.version || 1,
      nodes,
      edges,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      selectedNodeId: null,
      selectedNodeIds: [],
    });
  },

  saveFlow: async () => {
    const { flowId, nodes, edges, flowName, flowDescription, tenantId } = get();
    if (!flowId) { set({ isDirty: false }); return; }
    set({ isSaving: true });
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('flows').update({
      name: flowName,
      description: flowDescription,
      flow_data: { nodes, edges } as any,
      updated_by: user?.id,
    }).eq('id', flowId);
    set({ isSaving: false, isDirty: !error });
    if (error) throw error;
  },

  publishFlow: async () => {
    const { flowId, nodes, edges, flowName, flowDescription } = get();
    if (!flowId) { set({ flowStatus: 'published', isDirty: false }); return; }
    set({ isSaving: true });
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('flows').update({
      name: flowName,
      description: flowDescription,
      flow_data: { nodes, edges } as any,
      status: 'published',
      updated_by: user?.id,
    }).eq('id', flowId);
    set({ isSaving: false, flowStatus: 'published', isDirty: !error });
    if (error) throw error;
  },

  resetFlow: () => {
    undoStack.length = 0;
    redoStack.length = 0;
    set({
      flowId: null,
      tenantId: null,
      flowName: 'New Flow',
      flowDescription: '',
      flowStatus: 'draft',
      versionNumber: 1,
      nodes: initialNodes,
      edges: initialEdges,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      selectedNodeId: null,
      selectedNodeIds: [],
    });
  },

  validateFlow: () => {
    const { nodes, edges } = get();
    const errors: string[] = [];
    const startNodes = nodes.filter((n) => n.type === 'start');
    if (startNodes.length === 0) errors.push('Flow must have a Start node');
    if (startNodes.length > 1) errors.push('Flow must have exactly one Start node');
    
    nodes.forEach((node) => {
      if (node.type === 'end') return;
      const outgoing = edges.filter((e) => e.source === node.id);
      if (outgoing.length === 0 && node.type !== 'goTo') {
        errors.push(`"${node.data.label}" has no outgoing connection`);
      }
    });

    const connectedIds = new Set<string>();
    edges.forEach((e) => { connectedIds.add(e.source); connectedIds.add(e.target); });
    nodes.forEach((n) => {
      if (!connectedIds.has(n.id) && nodes.length > 1) {
        errors.push(`"${n.data.label}" is orphaned (not connected)`);
      }
    });

    return errors;
  },
}));
