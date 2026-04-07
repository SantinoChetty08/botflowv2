import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Radio, GitBranch, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { userRole } = useAuth();

  const { data: tenantCount } = useQuery({
    queryKey: ['tenants-count'],
    queryFn: async () => {
      const { count } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: channelCount } = useQuery({
    queryKey: ['channels-count'],
    queryFn: async () => {
      const { count } = await supabase.from('channels').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: flowCount } = useQuery({
    queryKey: ['flows-count'],
    queryFn: async () => {
      const { count } = await supabase.from('flows').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: activeFlows } = useQuery({
    queryKey: ['active-flows-count'],
    queryFn: async () => {
      const { count } = await supabase.from('flows').select('*', { count: 'exact', head: true }).eq('status', 'published');
      return count || 0;
    },
  });

  const stats = [
    { label: 'Tenants', value: tenantCount ?? 0, icon: Building2, color: 'text-blue-500' },
    { label: 'Channels', value: channelCount ?? 0, icon: Radio, color: 'text-green-500' },
    { label: 'Total Flows', value: flowCount ?? 0, icon: GitBranch, color: 'text-purple-500' },
    { label: 'Published Flows', value: activeFlows ?? 0, icon: Activity, color: 'text-orange-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your WhatsApp Bot platform
          {userRole && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{userRole}</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
