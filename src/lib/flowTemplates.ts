export interface StarterFlowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'support' | 'sales' | 'operations';
  flowData: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}

export const starterFlowTemplates: StarterFlowTemplate[] = [
  {
    id: 'support-triage',
    name: 'Support Triage',
    description: 'Welcome users, capture the issue type, and route them to support or billing.',
    category: 'support',
    flowData: {
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 320, y: 40 },
          data: { label: 'Start', nodeType: 'start', config: { triggerType: 'message' } },
        },
        {
          id: 'btn-1',
          type: 'buttonOptions',
          position: { x: 280, y: 180 },
          data: {
            label: 'Choose Intent',
            nodeType: 'buttonOptions',
            config: {
              text: 'Welcome to support. What do you need help with today?',
              variableName: 'support_intent',
              buttons: [
                { label: 'Technical', value: 'technical' },
                { label: 'Billing', value: 'billing' },
                { label: 'Human agent', value: 'human' },
              ],
            },
          },
        },
        {
          id: 'queue-1',
          type: 'queueRoute',
          position: { x: 120, y: 380 },
          data: {
            label: 'Technical Queue',
            nodeType: 'queueRoute',
            config: { queueId: 'technical', message: 'Connecting you to technical support.' },
          },
        },
        {
          id: 'queue-2',
          type: 'queueRoute',
          position: { x: 320, y: 380 },
          data: {
            label: 'Billing Queue',
            nodeType: 'queueRoute',
            config: { queueId: 'billing', message: 'Connecting you to billing support.' },
          },
        },
        {
          id: 'agent-1',
          type: 'agentHandoff',
          position: { x: 520, y: 380 },
          data: {
            label: 'Live Agent',
            nodeType: 'agentHandoff',
            config: { message: 'A live agent will join this conversation shortly.' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'btn-1' },
        { id: 'e2', source: 'btn-1', sourceHandle: 'technical', target: 'queue-1', label: 'technical' },
        { id: 'e3', source: 'btn-1', sourceHandle: 'billing', target: 'queue-2', label: 'billing' },
        { id: 'e4', source: 'btn-1', sourceHandle: 'human', target: 'agent-1', label: 'human' },
      ],
    },
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Collect customer details and hand off qualified leads to sales.',
    category: 'sales',
    flowData: {
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 320, y: 40 },
          data: { label: 'Start', nodeType: 'start', config: { triggerType: 'message' } },
        },
        {
          id: 'ask-1',
          type: 'askQuestion',
          position: { x: 280, y: 180 },
          data: { label: 'Ask Name', nodeType: 'askQuestion', config: { question: 'What is your name?', variableName: 'name' } },
        },
        {
          id: 'ask-2',
          type: 'askQuestion',
          position: { x: 280, y: 320 },
          data: { label: 'Ask Need', nodeType: 'askQuestion', config: { question: 'What service are you interested in?', variableName: 'service_interest' } },
        },
        {
          id: 'queue-1',
          type: 'queueRoute',
          position: { x: 280, y: 460 },
          data: { label: 'Sales Queue', nodeType: 'queueRoute', config: { queueId: 'sales', message: 'Thanks {{name}}. A sales advisor will contact you next.' } },
        },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'ask-1' },
        { id: 'e2', source: 'ask-1', target: 'ask-2' },
        { id: 'e3', source: 'ask-2', target: 'queue-1' },
      ],
    },
  },
];
