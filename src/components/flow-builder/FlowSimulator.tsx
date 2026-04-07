import { useState, useCallback, useRef, useEffect } from 'react';
import { useFlowStore } from '@/store/flowStore';
import { NODE_TYPE_CONFIGS } from './nodeTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Play, RotateCcw, Send, Bot, User, Zap, Clock, ArrowRight } from 'lucide-react';

type SimMessage = {
  id: string;
  type: 'bot' | 'user' | 'system';
  text: string;
  buttons?: { label: string; value: string }[];
  nodeId?: string;
  nodeType?: string;
};

type SimState = {
  currentNodeId: string | null;
  variables: Record<string, string>;
  waitingForInput: boolean;
  inputType: 'text' | 'button' | 'list';
  inputOptions?: { label: string; value: string }[];
  variableToSet?: string;
  finished: boolean;
};

interface FlowSimulatorProps {
  onClose: () => void;
}

const FlowSimulator = ({ onClose }: FlowSimulatorProps) => {
  const { nodes, edges, selectNode } = useFlowStore();
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [simState, setSimState] = useState<SimState>({
    currentNodeId: null,
    variables: {},
    waitingForInput: false,
    inputType: 'text',
    finished: false,
  });
  const [userInput, setUserInput] = useState('');
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  const newMsgId = () => `sim-msg-${++msgIdRef.current}`;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getNextNode = useCallback((fromNodeId: string, sourceHandle?: string): string | null => {
    const edge = edges.find((e) =>
      e.source === fromNodeId && (!sourceHandle || e.sourceHandle === sourceHandle)
    );
    return edge?.target || null;
  }, [edges]);

  const resolveVariables = useCallback((text: string, vars: Record<string, string>) => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `[${key}]`);
  }, []);

  const processNode = useCallback((nodeId: string, vars: Record<string, string>, msgs: SimMessage[]): {
    newMessages: SimMessage[];
    newState: Partial<SimState>;
    newVars: Record<string, string>;
    nextNodeId: string | null;
    autoAdvance: boolean;
  } => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { newMessages: msgs, newState: { finished: true }, newVars: vars, nextNodeId: null, autoAdvance: false };

    const config = node.data.config || {};
    const newMessages = [...msgs];
    let newVars = { ...vars };
    let nextNodeId: string | null = null;
    let autoAdvance = false;
    const newState: Partial<SimState> = {};

    switch (node.data.nodeType) {
      case 'start':
        newMessages.push({
          id: newMsgId(), type: 'system', text: '🚀 Flow started', nodeId, nodeType: 'start',
        });
        nextNodeId = getNextNode(nodeId);
        autoAdvance = true;
        break;

      case 'sendMessage': {
        const text = resolveVariables(config.text || 'No message configured', newVars);
        newMessages.push({
          id: newMsgId(), type: 'bot', text, nodeId, nodeType: 'sendMessage',
        });
        if (config.buttons?.length > 0) {
          newState.waitingForInput = true;
          newState.inputType = 'button';
          newState.inputOptions = config.buttons;
          newMessages[newMessages.length - 1].buttons = config.buttons;
        } else {
          nextNodeId = getNextNode(nodeId);
          autoAdvance = true;
        }
        break;
      }

      case 'askQuestion': {
        const text = resolveVariables(config.question || 'Please respond:', newVars);
        newMessages.push({
          id: newMsgId(), type: 'bot', text, nodeId, nodeType: 'askQuestion',
        });
        newState.waitingForInput = true;
        newState.inputType = 'text';
        newState.variableToSet = config.variableName;
        break;
      }

      case 'buttonOptions': {
        const text = resolveVariables(config.text || 'Please select:', newVars);
        newMessages.push({
          id: newMsgId(), type: 'bot', text, buttons: config.buttons, nodeId, nodeType: 'buttonOptions',
        });
        newState.waitingForInput = true;
        newState.inputType = 'button';
        newState.inputOptions = config.buttons;
        break;
      }

      case 'listMenu': {
        const items = config.sections?.flatMap((s: any) =>
          s.rows?.map((r: any) => ({ label: r.title, value: r.id })) || []
        ) || [];
        newMessages.push({
          id: newMsgId(), type: 'bot',
          text: resolveVariables(config.body || config.header || 'Select an option:', newVars),
          buttons: items, nodeId, nodeType: 'listMenu',
        });
        newState.waitingForInput = true;
        newState.inputType = 'button';
        newState.inputOptions = items;
        break;
      }

      case 'captureInput': {
        const text = resolveVariables(config.prompt || 'Please enter:', newVars);
        newMessages.push({
          id: newMsgId(), type: 'bot', text, nodeId, nodeType: 'captureInput',
        });
        newState.waitingForInput = true;
        newState.inputType = 'text';
        newState.variableToSet = config.variableName;
        break;
      }

      case 'condition': {
        const left = resolveVariables(config.leftOperand || '', newVars);
        const right = resolveVariables(config.rightOperand || '', newVars);
        let result = false;
        switch (config.operator) {
          case 'equals': result = left === right; break;
          case 'not_equals': result = left !== right; break;
          case 'contains': result = left.includes(right); break;
          case 'greater_than': result = parseFloat(left) > parseFloat(right); break;
          case 'less_than': result = parseFloat(left) < parseFloat(right); break;
          case 'exists': result = left !== '' && left !== `[${config.leftOperand?.replace(/\{|\}/g, '')}]`; break;
        }
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `⚡ Condition: ${left} ${config.operator} ${right} → ${result ? 'Yes' : 'No'}`,
          nodeId, nodeType: 'condition',
        });
        nextNodeId = getNextNode(nodeId, result ? 'true' : 'false');
        autoAdvance = true;
        break;
      }

      case 'setVariable': {
        const value = resolveVariables(config.value || '', newVars);
        newVars = { ...newVars, [config.variableName]: value };
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `📝 Set ${config.variableName} = "${value}"`,
          nodeId, nodeType: 'setVariable',
        });
        nextNodeId = getNextNode(nodeId);
        autoAdvance = true;
        break;
      }

      case 'apiWebhook':
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `🌐 API Call: ${config.method} ${config.url || 'no-url'} (simulated — result: "ok")`,
          nodeId, nodeType: 'apiWebhook',
        });
        if (config.outputVariable) {
          newVars = { ...newVars, [config.outputVariable]: 'simulated_response' };
        }
        nextNodeId = getNextNode(nodeId);
        autoAdvance = true;
        break;

      case 'queueRoute':
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `📋 Routing to queue: ${config.queueId || 'unknown'} (simulated)`,
          nodeId, nodeType: 'queueRoute',
        });
        nextNodeId = getNextNode(nodeId);
        autoAdvance = true;
        break;

      case 'agentHandoff':
        newMessages.push({
          id: newMsgId(), type: 'bot',
          text: resolveVariables(config.message || 'Connecting you to an agent...', newVars),
          nodeId, nodeType: 'agentHandoff',
        });
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `👤 Agent handoff to queue: ${config.queueId || 'default'} (simulated)`,
          nodeId, nodeType: 'agentHandoff',
        });
        nextNodeId = getNextNode(nodeId);
        autoAdvance = true;
        break;

      case 'businessHours':
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `🕐 Business hours check (${config.timezone || 'UTC'}) — simulated as: within hours`,
          nodeId, nodeType: 'businessHours',
        });
        nextNodeId = getNextNode(nodeId, 'true');
        autoAdvance = true;
        break;

      case 'delay':
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `⏳ Delay: ${config.duration} ${config.unit} (skipped in simulation)`,
          nodeId, nodeType: 'delay',
        });
        nextNodeId = getNextNode(nodeId);
        autoAdvance = true;
        break;

      case 'end':
        if (config.message) {
          newMessages.push({
            id: newMsgId(), type: 'bot',
            text: resolveVariables(config.message, newVars),
            nodeId, nodeType: 'end',
          });
        }
        newMessages.push({
          id: newMsgId(), type: 'system', text: '🏁 Flow ended', nodeId, nodeType: 'end',
        });
        newState.finished = true;
        break;

      case 'goTo':
        nextNodeId = config.targetNodeId || null;
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `↪ Go To: ${nodes.find((n) => n.id === nextNodeId)?.data.label || 'unknown'}`,
          nodeId, nodeType: 'goTo',
        });
        autoAdvance = true;
        break;

      default:
        newMessages.push({
          id: newMsgId(), type: 'system',
          text: `⚙️ ${node.data.label} (not simulated)`,
          nodeId, nodeType: node.data.nodeType,
        });
        nextNodeId = getNextNode(nodeId);
        autoAdvance = true;
    }

    return { newMessages, newState, newVars, nextNodeId, autoAdvance };
  }, [nodes, edges, getNextNode, resolveVariables]);

  const advanceFlow = useCallback((startNodeId: string, vars: Record<string, string>, msgs: SimMessage[]) => {
    let currentId: string | null = startNodeId;
    let currentVars = vars;
    let currentMsgs = msgs;
    let iterations = 0;

    while (currentId && iterations < 50) {
      iterations++;
      const result = processNode(currentId, currentVars, currentMsgs);
      currentMsgs = result.newMessages;
      currentVars = result.newVars;

      const stateUpdate: Partial<SimState> = {
        ...result.newState,
        currentNodeId: currentId,
        variables: currentVars,
      };

      if (!result.autoAdvance || result.newState.finished) {
        setMessages(currentMsgs);
        setSimState((prev) => ({ ...prev, ...stateUpdate, waitingForInput: result.newState.waitingForInput || false }));
        selectNode(currentId);
        return;
      }

      currentId = result.nextNodeId;
    }

    // Reached end without explicit end node or no next node
    currentMsgs.push({ id: newMsgId(), type: 'system', text: '⚠️ Flow ended (no next step)' });
    setMessages(currentMsgs);
    setSimState((prev) => ({ ...prev, currentNodeId: currentId, variables: currentVars, finished: true, waitingForInput: false }));
  }, [processNode, selectNode]);

  const handleStart = useCallback(() => {
    const startNode = nodes.find((n) => n.type === 'start');
    if (!startNode) return;
    setStarted(true);
    setMessages([]);
    setSimState({
      currentNodeId: startNode.id,
      variables: {},
      waitingForInput: false,
      inputType: 'text',
      finished: false,
    });
    advanceFlow(startNode.id, {}, []);
  }, [nodes, advanceFlow]);

  const handleUserInput = useCallback((value: string) => {
    if (!simState.currentNodeId || simState.finished) return;

    const newMsgs: SimMessage[] = [...messages, {
      id: newMsgId(), type: 'user', text: value,
    }];

    const newVars = { ...simState.variables };
    if (simState.variableToSet) {
      newVars[simState.variableToSet] = value;
    }

    const nextNodeId = getNextNode(simState.currentNodeId);
    if (nextNodeId) {
      setSimState((prev) => ({ ...prev, waitingForInput: false, variableToSet: undefined, variables: newVars }));
      advanceFlow(nextNodeId, newVars, newMsgs);
    } else {
      newMsgs.push({ id: newMsgId(), type: 'system', text: '⚠️ Flow ended (no next step)' });
      setMessages(newMsgs);
      setSimState((prev) => ({ ...prev, waitingForInput: false, finished: true, variables: newVars }));
    }

    setUserInput('');
  }, [simState, messages, getNextNode, advanceFlow]);

  const handleSendInput = () => {
    if (!userInput.trim()) return;
    handleUserInput(userInput.trim());
  };

  const handleReset = () => {
    setStarted(false);
    setMessages([]);
    setSimState({
      currentNodeId: null,
      variables: {},
      waitingForInput: false,
      inputType: 'text',
      finished: false,
    });
    selectNode(null);
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 text-primary">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Flow Simulator</p>
            <p className="text-[10px] text-muted-foreground">Step through your flow</p>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat area */}
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Play className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Test your flow</p>
            <p className="text-xs text-muted-foreground mt-1">
              Simulate a conversation to see how your bot responds to users
            </p>
          </div>
          <Button onClick={handleStart} size="sm" className="gap-1.5">
            <Play className="w-3.5 h-3.5" /> Start Simulation
          </Button>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="p-3 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.type === 'system' ? (
                    <button
                      onClick={() => msg.nodeId && selectNode(msg.nodeId)}
                      className="w-full text-center text-[10px] text-muted-foreground bg-muted/50 rounded-md py-1.5 px-2 hover:bg-muted transition-colors cursor-pointer"
                    >
                      {msg.text}
                    </button>
                  ) : msg.type === 'bot' ? (
                    <div className="max-w-[85%] space-y-1.5">
                      <button
                        onClick={() => msg.nodeId && selectNode(msg.nodeId)}
                        className="flex items-start gap-1.5 text-left cursor-pointer group"
                      >
                        <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3 h-3 text-primary" />
                        </div>
                        <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-xs text-foreground group-hover:bg-muted/80 transition-colors">
                          {msg.text}
                        </div>
                      </button>
                      {msg.buttons && msg.buttons.length > 0 && simState.waitingForInput && simState.inputType === 'button' && msg.id === messages.filter(m => m.type === 'bot').at(-1)?.id && (
                        <div className="flex flex-wrap gap-1 ml-6">
                          {msg.buttons.map((btn, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] rounded-full"
                              onClick={() => handleUserInput(btn.value)}
                            >
                              {btn.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[85%] flex items-start gap-1.5 flex-row-reverse">
                      <div className="w-5 h-5 rounded-full bg-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3 h-3 text-accent-foreground" />
                      </div>
                      <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-sm px-3 py-2 text-xs">
                        {msg.text}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {simState.finished && (
                <div className="pt-2 text-center">
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleReset}>
                    <RotateCcw className="w-3 h-3" /> Restart
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Variables panel */}
          {Object.keys(simState.variables).length > 0 && (
            <div className="border-t border-border px-3 py-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Variables</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(simState.variables).map(([key, val]) => (
                  <span key={key} className="text-[10px] bg-muted rounded px-1.5 py-0.5 font-mono">
                    {key}=<span className="text-primary">{val}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          {simState.waitingForInput && simState.inputType === 'text' && !simState.finished && (
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInput()}
                  placeholder="Type your response..."
                  className="h-8 text-xs"
                  autoFocus
                />
                <Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleSendInput}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Controls */}
          {!simState.finished && (
            <div className="p-2 border-t border-border flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">
                {simState.waitingForInput ? '⏳ Waiting for input...' : '▶ Running...'}
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={handleReset}>
                <RotateCcw className="w-3 h-3" /> Reset
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FlowSimulator;
