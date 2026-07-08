import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { UserCheck, Plus, Search, ShieldCheck, KeyRound } from 'lucide-react';

const Users: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'ADMIN' | 'SUPPORT' | 'TEAM_A' | 'TEAM_B' | 'OTHERS'>('ADMIN');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleName: 'ENGINEER',
    employeeCode: '',
    mobileNumber: '',
    department: 'Team A'
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    roleName: 'ENGINEER',
    employeeCode: '',
    mobileNumber: '',
    department: 'Team A'
  });

  const handleEditClick = (u: any) => {
    setEditUser(u);
    const role = u.role || 'ENGINEER';
    let dept = u.department || '';
    if (role === 'ENGINEER' && !dept) {
      dept = 'Team A';
    }
    setEditFormData({
      name: u.name || '',
      email: u.email || '',
      roleName: role,
      employeeCode: u.employeeCode || '',
      mobileNumber: u.mobileNumber || '',
      department: dept
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editUser.id}`, editFormData);
      setShowEditModal(false);
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setShowModal(false);
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        roleName: 'ENGINEER',
        employeeCode: '',
        mobileNumber: '',
        department: 'Team A'
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    try {
      await api.post('/users/reset-password', {
        userId: resetUser.id,
        newPassword
      });
      setShowResetModal(false);
      setNewPassword('');
      setResetUser(null);
      alert('Password has been reset successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const getFilteredUsers = () => {
    return users.filter((u: any) => {
      const role = u.role || '';
      const dept = u.department || '';
      if (activeTab === 'ADMIN') return role === 'ADMIN';
      if (activeTab === 'SUPPORT') return role === 'SUPPORT';
      if (activeTab === 'TEAM_A') return role === 'ENGINEER' && (dept.toLowerCase().includes('team a') || dept === 'Team A');
      if (activeTab === 'TEAM_B') return role === 'ENGINEER' && (dept.toLowerCase().includes('team b') || dept === 'Team B');
      return role === 'ACCOUNTS' || (role === 'ENGINEER' && !dept.toLowerCase().includes('team a') && !dept.toLowerCase().includes('team b'));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff Administration</h1>
          <p className="text-sm text-slate-500">Manage user accounts and role permissions (RBAC).</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition-all text-xs shadow-md shadow-blue-600/20"
        >
          <Plus className="h-4 w-4" />
          Create Staff Account
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('ADMIN')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'ADMIN'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Administrators
        </button>
        <button
          onClick={() => setActiveTab('SUPPORT')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'SUPPORT'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Coordinators
        </button>
        <button
          onClick={() => setActiveTab('TEAM_A')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'TEAM_A'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Engineers (Team A)
        </button>
        <button
          onClick={() => setActiveTab('TEAM_B')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'TEAM_B'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Engineers (Team B)
        </button>
        <button
          onClick={() => setActiveTab('OTHERS')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'OTHERS'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Other Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-left">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Staff Member</th>
                  <th className="py-4 px-6">Employee Code</th>
                  <th className="py-4 px-6">Team</th>
                  <th className="py-4 px-6">Mobile</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Role Privilege</th>
                  <th className="py-4 px-6">System Access</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {getFilteredUsers().map((u) => (
                  <tr key={u.id}>
                    <td className="py-4 px-6 font-bold text-slate-950">{u.name}</td>
                    <td className="py-4 px-6 font-mono text-slate-500">{u.employeeCode || 'N/A'}</td>
                    <td className="py-4 px-6 text-slate-500">{u.department || 'N/A'}</td>
                    <td className="py-4 px-6 text-slate-500">{u.mobileNumber || 'N/A'}</td>
                    <td className="py-4 px-6 font-mono">{u.email}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded font-bold uppercase text-[9px] ${
                        u.role === 'ADMIN' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                        u.role === 'ENGINEER' ? 'bg-cyan-50 text-cyan-700 border border-cyan-100' :
                        u.role === 'ACCOUNTS' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                        'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {u.role === 'ENGINEER' ? 'Repair Engineer' : u.role === 'SUPPORT' ? 'Repair Coordinator' : u.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
                        <ShieldCheck className="h-4 w-4" /> Active
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl text-[10px] font-extrabold text-blue-700 shadow-sm transition-all cursor-pointer backdrop-blur-sm"
                        title="Edit Staff Account Details"
                      >
                        <UserCheck className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setResetUser(u);
                          setShowResetModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100/60 hover:bg-amber-50/60 hover:text-amber-600 border border-slate-200/40 hover:border-amber-300/50 rounded-xl text-[10px] font-extrabold text-slate-600 shadow-sm transition-all cursor-pointer backdrop-blur-sm"
                        title="Reset Password"
                      >
                        <KeyRound className="h-3 w-3" />
                        Reset PW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 animate-fade-in p-6">
            <h2 className="text-lg font-black text-slate-950 border-b border-slate-50 pb-3 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Register Staff Member
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text" required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="Steve Rogers"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address *</label>
                <input
                  type="email" required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="steve@fsrms.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password *</label>
                <input
                  type="password" required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Code</label>
                <input
                  type="text"
                  value={formData.employeeCode}
                  onChange={e => setFormData({...formData, employeeCode: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="EMP-001"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={formData.mobileNumber}
                  onChange={e => setFormData({...formData, mobileNumber: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Team</label>
                {formData.roleName === 'ENGINEER' ? (
                  <select
                    value={formData.department || 'Team A'}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white font-bold"
                  >
                    <option value="Team A">Team A</option>
                    <option value="Team B">Team B</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Service & Repair"
                  />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role Privilege *</label>
                <select
                  value={formData.roleName}
                  onChange={e => setFormData({...formData, roleName: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white font-bold"
                >
                  <option value="ENGINEER">Repair Engineer</option>
                  <option value="ACCOUNTS">Accounts Team</option>
                  <option value="SUPPORT">Repair Coordinator</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && resetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 animate-fade-in p-6">
            <h2 className="text-lg font-black text-slate-950 border-b border-slate-50 pb-3 flex items-center gap-2 text-left">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset Password for {resetUser.name}
            </h2>

            <form onSubmit={handleResetPassword} className="space-y-4 mt-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">New Password *</label>
                <input
                  type="password" required minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must be at least 6 characters.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setNewPassword('');
                    setResetUser(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-amber-600/20"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT USER MODAL */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 animate-fade-in p-6">
            <h2 className="text-lg font-black text-slate-950 border-b border-slate-50 pb-3 flex items-center gap-2 text-left">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Edit Staff Member: {editUser.name}
            </h2>

            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text" required
                  value={editFormData.name}
                  onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="Steve Rogers"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address *</label>
                <input
                  type="email" required
                  value={editFormData.email}
                  onChange={e => setEditFormData({...editFormData, email: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="steve@fsrms.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Code</label>
                <input
                  type="text"
                  value={editFormData.employeeCode}
                  onChange={e => setEditFormData({...editFormData, employeeCode: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="EMP-001"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={editFormData.mobileNumber}
                  onChange={e => setEditFormData({...editFormData, mobileNumber: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Team</label>
                {editFormData.roleName === 'ENGINEER' ? (
                  <select
                    value={editFormData.department || 'Team A'}
                    onChange={e => setEditFormData({...editFormData, department: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white font-bold"
                  >
                    <option value="Team A">Team A</option>
                    <option value="Team B">Team B</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editFormData.department}
                    onChange={e => setEditFormData({...editFormData, department: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Service & Repair"
                  />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role Privilege *</label>
                <select
                  value={editFormData.roleName}
                  onChange={e => {
                    const nextRole = e.target.value;
                    setEditFormData({
                      ...editFormData,
                      roleName: nextRole,
                      department: nextRole === 'ENGINEER' ? (editFormData.department || 'Team A') : editFormData.department
                    });
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white font-bold"
                >
                  <option value="ENGINEER">Repair Engineer</option>
                  <option value="ACCOUNTS">Accounts Team</option>
                  <option value="SUPPORT">Repair Coordinator</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditUser(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
