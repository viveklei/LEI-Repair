import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeCode?: string | null;
  mobileNumber?: string | null;
  department?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  isPortal: boolean;
  portalJobId: string | null;
  customerPortalLogin: (trackId?: string, mobileNumber?: string, otp?: string) => Promise<string | null>;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPortal, setIsPortal] = useState<boolean>(false);
  const [portalJobId, setPortalJobId] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const savedPortal = localStorage.getItem('isPortal') === 'true';
      const savedJobId = localStorage.getItem('portalJobId');

      if (savedPortal && savedJobId) {
        setIsPortal(true);
        setPortalJobId(savedJobId);
        setUser({ id: 'portal', name: 'Customer Viewer', email: 'portal@fsrms.com', role: 'CUSTOMER' });
        setLoading(false);
        return;
      }

      if (token) {
        try {
          const res = await api.get('/auth/profile');
          setUser(res.data);
        } catch (e) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.post('/auth/login', { email, password: pass });
    const { accessToken, refreshToken, user: userData } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.removeItem('isPortal');
    localStorage.removeItem('portalJobId');
    setIsPortal(false);
    setPortalJobId(null);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('isPortal');
    localStorage.removeItem('portalJobId');
    setUser(null);
    setIsPortal(false);
    setPortalJobId(null);
  };

  const customerPortalLogin = async (trackId?: string, mobileNumber?: string, otp?: string, firebaseToken?: string): Promise<string | null> => {
    const res = await api.post('/portal/login', { trackId, mobileNumber, otp, firebaseToken });
    const { token, jobId, customerId } = res.data;
    
    localStorage.setItem('accessToken', token);
    localStorage.setItem('isPortal', 'true');
    setIsPortal(true);

    if (jobId) {
      localStorage.setItem('portalJobId', jobId);
      setPortalJobId(jobId);
      setUser({ id: 'portal', name: 'Customer Portal', email: 'portal@fsrms.com', role: 'CUSTOMER' });
      return `/portal/job/${jobId}`;
    }

    if (customerId) {
      localStorage.setItem('portalCustomerId', customerId);
      setUser({ id: 'portal', name: 'Customer Portal', email: 'portal@fsrms.com', role: 'CUSTOMER' });
      return `/portal/customer/${customerId}`;
    }

    return '/portal';
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updatedUser } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isPortal, portalJobId, customerPortalLogin, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
