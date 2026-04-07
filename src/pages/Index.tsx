import { useState } from 'react';
import FlowToolbar from '@/components/flow-builder/FlowToolbar';
import NodePalette from '@/components/flow-builder/NodePalette';
import FlowCanvas from '@/components/flow-builder/FlowCanvas';
import NodeConfigPanel from '@/components/flow-builder/NodeConfigPanel';
import FlowSimulator from '@/components/flow-builder/FlowSimulator';

const Index = () => {
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <FlowToolbar
        simulatorOpen={simulatorOpen}
        onToggleSimulator={() => setSimulatorOpen(!simulatorOpen)}
      />
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <FlowCanvas />
        {simulatorOpen ? (
          <FlowSimulator onClose={() => setSimulatorOpen(false)} />
        ) : (
          <NodeConfigPanel />
        )}
      </div>
    </div>
  );
};

export default Index;
