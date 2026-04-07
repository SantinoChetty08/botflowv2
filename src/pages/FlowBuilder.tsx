import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowStore } from '@/store/flowStore';
import FlowToolbar from '@/components/flow-builder/FlowToolbar';
import NodePalette from '@/components/flow-builder/NodePalette';
import FlowCanvas from '@/components/flow-builder/FlowCanvas';
import NodeConfigPanel from '@/components/flow-builder/NodeConfigPanel';
import FlowSimulator from '@/components/flow-builder/FlowSimulator';
import { Skeleton } from '@/components/ui/skeleton';

const FlowBuilder = () => {
  const { user, loading: authLoading } = useAuth();
  const { flowId } = useParams<{ flowId: string }>();
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [flowLoading, setFlowLoading] = useState(false);
  const { loadFlow, resetFlow } = useFlowStore();

  useEffect(() => {
    if (flowId) {
      setFlowLoading(true);
      loadFlow(flowId).finally(() => setFlowLoading(false));
    } else {
      resetFlow();
    }
    return () => { resetFlow(); };
  }, [flowId]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  if (flowLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Skeleton className="w-48 h-6 mx-auto" />
          <Skeleton className="w-32 h-4 mx-auto" />
          <p className="text-xs text-muted-foreground">Loading flow...</p>
        </div>
      </div>
    );
  }

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

export default FlowBuilder;
