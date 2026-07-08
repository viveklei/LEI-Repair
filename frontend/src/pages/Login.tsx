import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldAlert, Cpu, KeyRound, Smartphone } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { auth } from '../config/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import api from '../services/api';

const Login: React.FC = () => {
  const { login, customerPortalLogin } = useAuth();
  const navigate = useNavigate();

  // Tab switcher: staff vs customer portal
  const [activeTab, setActiveTab] = useState<'staff' | 'customer'>('staff');

  // Staff states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Customer portal states
  const [portalTab, setPortalTab] = useState<'track' | 'otp'>('track');
  const [trackId, setTrackId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      // Clean up recaptcha verifier on unmount
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePortalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (portalTab === 'track') {
        const path = await customerPortalLogin(trackId, undefined, undefined);
        if (path) navigate(path);
      } else {
        if (!otpSent) {
          // Normalize phone number (E.164 format)
          let formattedMobile = mobileNumber.trim();
          if (!formattedMobile.startsWith('+')) {
            // Remove leading zero if present
            if (formattedMobile.startsWith('0')) {
              formattedMobile = formattedMobile.slice(1);
            }
            formattedMobile = '+91' + formattedMobile; // default to India prefix +91
          }

          // First, check backend to see if the mobile number is registered
          try {
            await api.post('/portal/check-mobile', { mobileNumber: formattedMobile });
          } catch (err: any) {
            setError(err.response?.data?.message || 'Phone number is not registered under any job ticket.');
            setLoading(false);
            return;
          }

          // Setup invisible recaptcha verifier
          if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
              callback: () => {}
            });
          }
          const verifier = (window as any).recaptchaVerifier;

          // Request Firebase SMS OTP
          const confirmation = await signInWithPhoneNumber(auth, formattedMobile, verifier);
          setConfirmationResult(confirmation);
          setOtpSent(true);
          setError(null);
          alert('OTP Verification Code has been sent to ' + formattedMobile);
        } else {
          // Verify OTP code entered by the user
          if (!confirmationResult) {
            throw new Error('Authentication session lost. Please request a new OTP.');
          }
          const userCredential = await confirmationResult.confirm(otp.trim());
          const firebaseToken = await userCredential.user.getIdToken();

          // Log in on backend using the validated Firebase token
          const path = await customerPortalLogin(undefined, mobileNumber, undefined, firebaseToken);
          if (path) navigate(path);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-900 rounded-full mix-blend-multiply filter blur-3xl opacity-10 translate-x-1/2 translate-y-1/2"></div>

      <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 relative z-10 animate-fade-in">
        <div className="text-center">
          <div className="inline-flex mb-4">
            <img src={logoImg} className="h-20 w-20 object-contain rounded-2xl border border-slate-700 bg-slate-900/50 p-2 shadow-inner" alt="LEI Repair Logo" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">LEI Repair</h2>
          <p className="mt-1 text-sm text-slate-400">
            LEI Repair Management System
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => { setActiveTab('staff'); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 text-center transition-all ${
              activeTab === 'staff'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Staff Access
          </button>
          <button
            onClick={() => { setActiveTab('customer'); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 text-center transition-all ${
              activeTab === 'customer'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Customer Portal
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-3 flex items-start gap-2.5 text-sm text-red-300">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* --- STAFF LOGIN FORM --- */}
        {activeTab === 'staff' ? (
          <form className="mt-4 space-y-6" onSubmit={handleStaffSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
                  placeholder="name@fsrms.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <KeyRound className="h-4 w-4" />
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
            
            <div className="text-center text-xs text-slate-500">
              Demo logins: admin@fsrms.com / Admin@123 • engineer@fsrms.com / Engineer@123
            </div>
          </form>
        ) : (
          /* --- CUSTOMER PORTAL TRACK FORM --- */
          <form className="mt-4 space-y-6" onSubmit={handlePortalSubmit}>
            <div className="flex bg-slate-700/30 p-1 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => { setPortalTab('track'); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg text-center transition-all ${
                  portalTab === 'track' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Track ID
              </button>
              <button
                type="button"
                onClick={() => { setPortalTab('otp'); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg text-center transition-all ${
                  portalTab === 'otp' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mobile + OTP
              </button>
            </div>

            <div className="space-y-4">
              {portalTab === 'track' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Enter Track ID
                  </label>
                  <input
                    type="text"
                    required
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors uppercase"
                    placeholder="FSR-2026-XXXXX"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      disabled={otpSent}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
                      placeholder="+919876543210"
                    />
                  </div>
                  {otpSent && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        One-Time Passcode (OTP)
                      </label>
                      <input
                        type="text"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors text-center tracking-widest text-lg font-bold"
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                {portalTab === 'otp' && !otpSent ? (
                  <>
                    <Smartphone className="h-4 w-4" />
                    {loading ? 'Sending...' : 'Request OTP'}
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    {loading ? 'Verifying...' : 'Track Repairs'}
                  </>
                )}
              </button>
            </div>
            <div id="recaptcha-container"></div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
