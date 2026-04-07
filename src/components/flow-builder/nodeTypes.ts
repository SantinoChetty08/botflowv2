import { NodeType } from '@/store/flowStore';
import {
  Play, MessageSquare, HelpCircle, SquareMousePointer, List, TextCursorInput,
  GitBranch, Variable, Globe, Route, Headphones, Clock, Timer, Square, ArrowRight
} from 'lucide-react';

export interface NodeTypeConfig {
  type: NodeType;
  label: string;
  description: string;
  icon: typeof Play;
  colorVar: string;
  category: 'trigger' | 'message' | 'input' | 'logic' | 'integration' | 'flow';
}

export const NODE_TYPE_CONFIGS: NodeTypeConfig[] = [
  { type: 'start', label: 'Start', description: 'Entry point of the flow', icon: Play, colorVar: '--node-start', category: 'trigger' },
  { type: 'sendMessage', label: 'Send Message', description: 'Send a text or media message', icon: MessageSquare, colorVar: '--node-message', category: 'message' },
  { type: 'askQuestion', label: 'Ask Question', description: 'Ask and capture user response', icon: HelpCircle, colorVar: '--node-question', category: 'input' },
  { type: 'buttonOptions', label: 'Button Options', description: 'Present clickable buttons', icon: SquareMousePointer, colorVar: '--node-button', category: 'input' },
  { type: 'listMenu', label: 'List Menu', description: 'Show a list selection menu', icon: List, colorVar: '--node-list', category: 'input' },
  { type: 'captureInput', label: 'Capture Input', description: 'Capture and validate input', icon: TextCursorInput, colorVar: '--node-capture', category: 'input' },
  { type: 'condition', label: 'Condition', description: 'Branch based on a condition', icon: GitBranch, colorVar: '--node-condition', category: 'logic' },
  { type: 'setVariable', label: 'Set Variable', description: 'Set or update a variable', icon: Variable, colorVar: '--node-variable', category: 'logic' },
  { type: 'apiWebhook', label: 'API Request', description: 'Call an external API', icon: Globe, colorVar: '--node-api', category: 'integration' },
  { type: 'queueRoute', label: 'Queue Route', description: 'Route to HoduCC queue', icon: Route, colorVar: '--node-queue', category: 'integration' },
  { type: 'agentHandoff', label: 'Agent Handoff', description: 'Transfer to live agent', icon: Headphones, colorVar: '--node-handoff', category: 'integration' },
  { type: 'businessHours', label: 'Business Hours', description: 'Check business hours', icon: Clock, colorVar: '--node-business', category: 'logic' },
  { type: 'delay', label: 'Delay', description: 'Wait before next step', icon: Timer, colorVar: '--node-delay', category: 'flow' },
  { type: 'end', label: 'End', description: 'End the conversation', icon: Square, colorVar: '--node-end', category: 'flow' },
  { type: 'goTo', label: 'Go To', description: 'Jump to another node', icon: ArrowRight, colorVar: '--node-goto', category: 'flow' },
];

export const CATEGORIES = [
  { key: 'trigger', label: 'Triggers' },
  { key: 'message', label: 'Messages' },
  { key: 'input', label: 'User Input' },
  { key: 'logic', label: 'Logic' },
  { key: 'integration', label: 'Integrations' },
  { key: 'flow', label: 'Flow Control' },
] as const;
