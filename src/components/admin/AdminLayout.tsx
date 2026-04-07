import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Building2, Radio, GitBranch, LogOut, User, FileText, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const navItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Tenants', url: '/admin/tenants', icon: Building2 },
  { title: 'Channels', url: '/admin/channels', icon: Radio },
  { title: 'Inbox', url: '/admin/inbox', icon: Inbox },
  { title: 'Flows', url: '/admin/flows', icon: GitBranch },
  { title: 'API Docs', url: '/admin/api-docs', icon: FileText },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user, signOut, userRole } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            {!collapsed && <span className="text-xs font-bold tracking-wider uppercase">Flow Builder</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/admin'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <div className="mt-auto p-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.email}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{userRole || 'user'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={signOut}>
              <LogOut className="w-3 h-3" /> Sign Out
            </Button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

const AdminLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="w-48 h-8" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-4 gap-3">
            <SidebarTrigger />
            <h1 className="text-sm font-semibold text-foreground">Admin Dashboard</h1>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
