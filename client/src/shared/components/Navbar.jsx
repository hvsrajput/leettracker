import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Users, User, LogOut, ChevronDown, Code2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/shared/ui/dropdown-menu';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/problems', label: 'Problems', Icon: ListChecks },
  { to: '/groups', label: 'Groups', Icon: Users },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <NavLink to="/dashboard" className="group flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 transition-transform group-hover:scale-105">
                <Code2 className="h-4.5 w-4.5" size={18} />
              </span>
              <span className="text-lg font-bold tracking-tight text-white">
                Leet<span className="text-emerald-400">Tracker</span>
              </span>
            </NavLink>

            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )
                  }
                >
                  <link.Icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl p-1.5 pr-2.5 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-white/5 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-sm font-semibold text-emerald-400">
                {user.username.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-medium text-gray-200">{user.username}</span>
                <span className="text-[10px] text-muted-foreground">Personal Account</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="font-medium text-foreground">{user.username}</div>
                {user.email && <div className="font-normal truncate">{user.email}</div>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                <User />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
              >
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.06] bg-background">
        <div className="grid grid-cols-3 px-2 py-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground'
                )
              }
            >
              <link.Icon className="h-5 w-5" />
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
};

export default Navbar;
