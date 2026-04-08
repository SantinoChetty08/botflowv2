import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart3, Activity, Send, Bot, TrendingUp } from 'lucide-react';

const chartConfig = {
  nodeExecutions: { label: 'Node Executions', color: 'hsl(var(--primary))' },
  broadcasts: { label: 'Broadcast Sent', color: '#8b5cf6' },
  reads: { label: 'Reads', color: '#10b981' },
  failures: { label: 'Failures', color: '#ef4444' },
  publishes: { label: 'Flow Published', color: '#f59e0b' },
} as const;

const Analytics = () => {
  const client = supabase as any;

  const { data: events } = useQuery({
    queryKey: ['analytics-events'],
    queryFn: async () => {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
      const { data, error } = await client
        .from('analytics_events')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const summary = useMemo(() => {
    const list = events || [];
    const nodeExecutions = list.filter((event: any) => event.event_type === 'node_executed');
    const broadcastsSent = list.filter((event: any) => event.event_type === 'broadcast_sent');
    const reads = list.filter((event: any) => event.event_type === 'message_read');
    const failures = list.filter((event: any) => event.event_type === 'message_failed' || event.event_type === 'broadcast_failed');
    const publishes = list.filter((event: any) => event.event_type === 'flow_published');
    const conversationsWaiting = list.filter((event: any) => event.event_type === 'conversation_waiting_for_agent');

    const byDayMap = list.reduce((acc: Record<string, any>, event: any) => {
      const key = new Date(event.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      acc[key] ||= { day: key, nodeExecutions: 0, broadcasts: 0, reads: 0, failures: 0, publishes: 0 };
      if (event.event_type === 'node_executed') acc[key].nodeExecutions += 1;
      if (event.event_type === 'broadcast_sent') acc[key].broadcasts += 1;
      if (event.event_type === 'message_read') acc[key].reads += 1;
      if (event.event_type === 'message_failed' || event.event_type === 'broadcast_failed') acc[key].failures += 1;
      if (event.event_type === 'flow_published') acc[key].publishes += 1;
      return acc;
    }, {});

    const nodeTypes = Object.entries(
      nodeExecutions.reduce((acc: Record<string, number>, event: any) => {
        const key = event.node_type || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    const eventMix = [
      { name: 'Node', value: nodeExecutions.length, fill: 'var(--color-nodeExecutions)' },
      { name: 'Broadcast', value: broadcastsSent.length, fill: 'var(--color-broadcasts)' },
      { name: 'Read', value: reads.length, fill: 'var(--color-reads)' },
      { name: 'Failed', value: failures.length, fill: 'var(--color-failures)' },
      { name: 'Published', value: publishes.length, fill: 'var(--color-publishes)' },
    ].filter((item) => item.value > 0);

    return {
      totalEvents: list.length,
      nodeExecutions: nodeExecutions.length,
      broadcastsSent: broadcastsSent.length,
      reads: reads.length,
      failures: failures.length,
      conversationsWaiting: conversationsWaiting.length,
      byDay: Object.values(byDayMap).slice(-10),
      nodeTypes,
      eventMix,
    };
  }, [events]);

  const stats = [
    { label: 'Tracked Events', value: summary.totalEvents, icon: Activity, color: 'text-blue-500' },
    { label: 'Node Executions', value: summary.nodeExecutions, icon: Bot, color: 'text-green-500' },
    { label: 'Broadcast Sends', value: summary.broadcastsSent, icon: Send, color: 'text-purple-500' },
    { label: 'Waiting For Agent', value: summary.conversationsWaiting, icon: TrendingUp, color: 'text-orange-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Operational visibility across flows, templates, campaigns, and handoffs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Activity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="h-[280px] w-full"
            >
              <LineChart data={summary.byDay}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="nodeExecutions" stroke="var(--color-nodeExecutions)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="broadcasts" stroke="var(--color-broadcasts)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reads" stroke="var(--color-reads)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failures" stroke="var(--color-failures)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie data={summary.eventMix} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100}>
                  {summary.eventMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Node Types</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart data={summary.nodeTypes}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-nodeExecutions)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
