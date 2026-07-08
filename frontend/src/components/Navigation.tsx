import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  LayoutDashboard,
  Wrench,
  Users,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ClipboardList,
  Package,
  BarChart3,
  UserCheck,
  User,
  Phone,
  Lock,
  Building,
  Hash,
  ChevronRight,
  Settings,
  Camera,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import TechBackground from './TechBackground';
import { QRScannerModal } from './QRScannerModal';
import { socket } from '../services/socket';

// ─── Menu item definition ──────────────────────────────────────────────────
interface MenuItem {
  name: string;
  shortName: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

const ALL_MENU: MenuItem[] = [
  { name: 'Dashboard',     shortName: 'Home',    path: '/',            icon: LayoutDashboard, roles: ['ADMIN', 'ENGINEER', 'ACCOUNTS', 'SUPPORT'] },
  { name: 'Service Jobs',  shortName: 'Jobs',    path: '/jobs',         icon: Wrench,          roles: ['ADMIN', 'ENGINEER', 'ACCOUNTS', 'SUPPORT'] },
  { name: 'Customers',     shortName: 'Clients', path: '/customers',    icon: Users,           roles: ['ADMIN', 'ACCOUNTS', 'SUPPORT'] },
  { name: 'Spare Parts',   shortName: 'Spares',  path: '/spare-parts',  icon: Package,         roles: ['ADMIN', 'ENGINEER', 'ACCOUNTS', 'SUPPORT'] },
  { name: 'Manager Approvals', shortName: 'Approvals', path: '/approvals', icon: ClipboardList, roles: ['ADMIN', 'ACCOUNTS', 'SUPPORT'] },
  { name: 'Reports & AI',  shortName: 'Reports', path: '/reports',      icon: BarChart3,       roles: ['ADMIN', 'ACCOUNTS'] },
  { name: 'Staff Admin',   shortName: 'Staff',   path: '/users',        icon: UserCheck,       roles: ['ADMIN'] },
];

const roleLabel = (role?: string) => {
  if (role === 'ENGINEER') return 'Repair Engineer';
  if (role === 'SUPPORT')  return 'Repair Coordinator';
  return role ?? '';
};

// ─── Component ────────────────────────────────────────────────────────────
const Navigation: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isPortal, updateUser } = useAuth();
  const { toast } = useToast();
  const navigate   = useNavigate();
  const location   = useLocation();

  // Sidebar / drawer
  const [mobileOpen, setMobileOpen] = useState(false);

  // Search
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch,    setShowSearch]    = useState(false);
  const [isSearching,   setIsSearching]   = useState(false);

  // Profile modal
  const [showProfile,    setShowProfile]    = useState(false);
  const [profileForm,    setProfileForm]    = useState({ name: '', email: '', employeeCode: '', mobileNumber: '', department: '', password: '', confirmPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError,   setProfileError]   = useState('');

  // Active job count badge (fetched once)
  const [activeJobCount, setActiveJobCount] = useState<number | null>(null);

  // System Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(true);

  // QR Scanner Modal State
  const [showQRScanner, setShowQRScanner] = useState(false);

  const filteredMenu = ALL_MENU.filter(m => user && m.roles.includes(user.role));

  const fetchNotifications = useCallback(async () => {
    if (!user || isPortal) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }, [user, isPortal]);

  // Fetch active job count for badge & notifications
  useEffect(() => {
    if (!user || isPortal) return;
    api.get('/dashboard/stats').then(r => {
      const s = r.data;
      const active = (s.underInspection ?? 0) + (s.underRepair ?? 0) + (s.awaitingApproval ?? 0) + (s.testing ?? 0);
      setActiveJobCount(active);
    }).catch(() => {});
    fetchNotifications();
  }, [user, isPortal, fetchNotifications]);

  // Native Notification permissions and real-time Socket.IO alerts
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const handleSystemNotification = (data: any) => {
      console.log('Received system alert:', data);
      
      // Trigger native OS notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.body,
          icon: 'logo.png',
          tag: data.referenceId
        });
      }

      // Trigger standard in-app Toast notification
      toast.success(data.title, data.body);
      
      // Refresh notifications lists
      fetchNotifications();
    };

    socket.on('system_notification', handleSystemNotification);

    return () => {
      socket.off('system_notification', handleSystemNotification);
    };
  }, [toast, fetchNotifications]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Debounced search
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length > 1) {
      setIsSearching(true);
      try {
        const res = await api.get(`/search?query=${encodeURIComponent(q)}`);
        setSearchResults(res.data);
        setShowSearch(true);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  }, []);

  const openProfileModal = async () => {
    try {
      const res = await api.get('/auth/profile');
      const d = res.data;
      setProfileForm({ name: d.name ?? '', email: d.email ?? '', employeeCode: d.employeeCode ?? '', mobileNumber: d.mobileNumber ?? '', department: d.department ?? '', password: '', confirmPassword: '' });
      setProfileError('');
      setShowProfile(true);
    } catch { toast.error('Failed to load profile'); }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      setProfileError('Passwords do not match'); return;
    }
    try {
      setProfileLoading(true); setProfileError('');
      const res = await api.put('/auth/profile', {
        name: profileForm.name,
        employeeCode: profileForm.employeeCode,
        mobileNumber: profileForm.mobileNumber,
        department: profileForm.department,
        password: profileForm.password || undefined,
      });
      updateUser(res.data);
      toast.success('Profile updated', 'Your details have been saved.');
      setShowProfile(false);
    } catch (err: any) {
      setProfileError(err.response?.data?.message ?? 'Update failed');
    } finally { setProfileLoading(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // Bottom nav items (max 5 for mobile)
  const bottomNavItems = filteredMenu.slice(0, 4);

  return (
    <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">
      <TechBackground />

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-white/30 backdrop-blur-xl shrink-0 border-r border-slate-200/50 relative z-10">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 bg-white/20 border-b border-slate-200/50 shrink-0">
          <img src="logo.png" className="h-9 w-9 object-contain rounded-xl bg-white border border-white/50 p-0.5 shadow-sm" alt="LEI" />
          <div>
            <span className="font-extrabold text-base tracking-wide text-slate-900 block leading-tight">LEI Repair</span>
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Laser Service Hub</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-3 overflow-y-auto">
          {filteredMenu.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const showBadge = item.path === '/jobs' && activeJobCount && activeJobCount > 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} />
                <span className="flex-1 truncate">{item.name}</span>
                {showBadge && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'}`}>
                    {activeJobCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/40 bg-white/20">
          <button
            onClick={openProfileModal}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/50 transition-all text-left group cursor-pointer mb-2"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
              {(user?.name || 'U').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider truncate">{roleLabel(user?.role)}</p>
            </div>
            <Settings className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/40 hover:bg-rose-50/80 hover:text-rose-600 border border-slate-200/60 hover:border-rose-300/50 rounded-xl text-sm text-slate-600 font-bold transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE SLIDE DRAWER ─────────────────────────────────────── */}
      {mobileOpen && createPortal(
        <div className="fixed inset-0 z-[9990] md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <aside
            className="absolute inset-y-0 left-0 w-72 bg-white/80 backdrop-blur-2xl flex flex-col z-10 border-r border-white/50 animate-slide-left safe-top safe-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-white/30 border-b border-white/40">
              <div className="flex items-center gap-3">
                <img src="logo.png" className="h-9 w-9 object-contain rounded-xl bg-white p-0.5 border border-white/50 shadow-sm" alt="LEI" />
                <div>
                  <span className="font-extrabold text-base text-slate-900">LEI Repair</span>
                  <span className="block text-[9px] text-slate-400 uppercase tracking-widest">Laser Service Hub</span>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="touch-target text-slate-500 hover:text-slate-800 rounded-xl hover:bg-white/50 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
              {filteredMenu.map(item => {
                const Icon = item.icon;
                const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const showBadge = item.path === '/jobs' && activeJobCount && activeJobCount > 0;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all ${
                      active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                    <span className="flex-1">{item.name}</span>
                    {showBadge ? (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'}`}>
                        {activeJobCount}
                      </span>
                    ) : (
                      <ChevronRight className={`h-4 w-4 ${active ? 'text-white/60' : 'text-slate-300'}`} />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-white/40 bg-white/20">
              <button
                onClick={() => { setMobileOpen(false); openProfileModal(); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/50 transition-all text-left cursor-pointer mb-2"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shrink-0">
                  {(user?.name || 'U').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'User'}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold truncate">{roleLabel(user?.role)}</p>
                </div>
                <Settings className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-50/80 text-rose-600 border border-rose-200/50 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}

      {/* ── CONTENT AREA ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Header */}
        <header className="h-14 md:h-16 bg-white/60 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-4 md:px-6 shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Hamburger (mobile only) */}
            {!isPortal && (
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden touch-target -ml-1 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-white/50 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* Mobile: show logo text */}
            <div className="md:hidden flex items-center gap-2 mr-2">
              <img src="logo.png" className="h-7 w-7 object-contain rounded-lg bg-white p-0.5 border border-white/50 shadow-sm" alt="LEI" />
              <span className="font-extrabold text-sm text-slate-900">LEI Repair</span>
            </div>

            {/* Global Search */}
            {!isPortal && (
              <div className="flex items-center gap-2 flex-1 max-w-xs md:max-w-md">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowSearch(true)}
                    onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                    className="w-full pl-9 pr-4 py-2 bg-white/60 border border-slate-200/80 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder={window.innerWidth < 640 ? 'Search…' : 'Search Track ID, serial, customer…'}
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                      <div className="h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                {showSearch && searchResults.length > 0 && (
                  <div className="absolute top-full mt-1.5 left-0 right-0 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl z-[9999] max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map(job => (
                      <button
                        key={job.id}
                        onClick={() => { navigate(`/jobs/${job.id}`); setSearchQuery(''); setShowSearch(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-blue-600 group-hover:text-blue-700">{job.trackId}</span>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            job.status === 'UNDER_REPAIR' ? 'bg-cyan-100 text-cyan-700' :
                            job.status === 'RECEIVED' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{job.status?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{job.customer?.companyName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">S/N: {job.laserSource?.serialNumber} · {job.laserSource?.brand}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowQRScanner(true)}
                className="flex items-center justify-center p-2.5 bg-white/60 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 text-slate-600 rounded-xl transition-all cursor-pointer shadow-sm flex-shrink-0"
                title="Scan Inward Sticker QR Code"
              >
                <Camera className="h-4.5 w-4.5" />
              </button>
            </div>
          )}
          
          {showQRScanner && <QRScannerModal onClose={() => setShowQRScanner(false)} />}
        </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-2">
            {isPortal ? (
              <span className="badge-status badge-ready text-[10px]">Customer Mode</span>
            ) : (
              <>
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setUnreadNotifications(false);
                      fetchNotifications();
                    }}
                    className="touch-target relative text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/50 transition-colors cursor-pointer"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadNotifications && (
                      <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </button>

                  {/* Dropdown panel */}
                  {showNotifications && (
                    <>
                      {/* Invisible click-away overlay */}
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowNotifications(false)} />
                      
                      <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl z-50 py-3 animate-fade-in text-left">
                        <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                          <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">System WhatsApp/Email Alerts</span>
                          <button
                            onClick={() => {
                              setNotifications([]);
                              setUnreadNotifications(false);
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100/75 mt-1">
                          {notifications.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                              No recent system alerts.
                            </div>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className="px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                                <div className="flex justify-between items-start gap-1">
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                    n.type === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                  }`}>
                                    {n.type}
                                  </span>
                                  <span className="text-[9px] text-slate-400">
                                    {new Date(n.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                                {n.job && (
                                  <div className="flex items-center gap-1.5 mt-1 font-bold text-[9px] text-slate-400 uppercase tracking-wide">
                                    <span>{n.job.trackId}</span>
                                    <span>·</span>
                                    <span className="truncate max-w-[120px]">{n.job.customer?.companyName}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {/* Desktop: user avatar */}
                <button
                  onClick={openProfileModal}
                  className="hidden md:flex items-center gap-2 cursor-pointer ml-1"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-md hover:scale-105 transition-transform">
                    {user?.name?.charAt(0)}
                  </div>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10 bg-transparent main-content-area">
          <div className="watermark-logo" />
          <div className="max-w-7xl mx-auto relative z-10">
            {children}
          </div>
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV BAR ───────────────────────────────────── */}
      {!isPortal && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 shadow-lg"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-stretch">
            {bottomNavItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              const showBadge = item.path === '/jobs' && activeJobCount && activeJobCount > 0;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all relative ${
                    active ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-blue-600 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                        {activeJobCount > 99 ? '99+' : activeJobCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold leading-none transition-all ${active ? 'font-bold' : ''}`}>
                    {item.shortName}
                  </span>
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-blue-600 rounded-full" />
                  )}
                </Link>
              );
            })}
            {/* More button (opens drawer) */}
            {filteredMenu.length > 4 && (
              <button
                onClick={() => setMobileOpen(true)}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-slate-500"
              >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-semibold leading-none">More</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* ── PROFILE MODAL ───────────────────────────────────────────── */}
      {showProfile && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-100 animate-slide-up md:animate-scale-in p-6 text-left relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg p-1.5 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg">
                {user?.name?.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Edit Profile</h3>
                <p className="text-xs text-slate-400 mt-0.5">{roleLabel(user?.role)} · {user?.email}</p>
              </div>
            </div>

            {profileError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2">
                <span>⚠</span> {profileError}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input type="text" required value={profileForm.name}
                      onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none text-sm" />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Email (Login ID)</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input type="email" disabled value={profileForm.email}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-sm cursor-not-allowed" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Employee Code</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input type="text" placeholder="EMP-001" value={profileForm.employeeCode}
                      onChange={e => setProfileForm({ ...profileForm, employeeCode: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input type="tel" placeholder="+91 98765 43210" value={profileForm.mobileNumber}
                      onChange={e => setProfileForm({ ...profileForm, mobileNumber: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none text-sm" />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input type="text" placeholder="e.g. Service & Repair" value={profileForm.department}
                      onChange={e => setProfileForm({ ...profileForm, department: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none text-sm" />
                  </div>
                </div>

                <div className="sm:col-span-2 pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-slate-400" /> Change Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input type="password" placeholder="••••••••" value={profileForm.password}
                          onChange={e => setProfileForm({ ...profileForm, password: e.target.value })}
                          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Confirm</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input type="password" placeholder="••••••••" value={profileForm.confirmPassword}
                          onChange={e => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowProfile(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 rounded-xl text-sm cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={profileLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-60">
                  {profileLoading ? (
                    <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Navigation;
