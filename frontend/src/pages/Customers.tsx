import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Search, ChevronRight, UserPlus, ClipboardList, X, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Customers: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // Add Customer modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    companyName: '',
    customerName: '',
    mobileNumber: '',
    email: '',
    address: '',
    billingAddress: '',
    shippingAddress: '',
    billingState: '',
    shippingState: '',
    gstNumber: '',
    contactPerson: ''
  });

  // Zoho autocomplete states
  const [zohoResults, setZohoResults] = useState<any[]>([]);
  const [showZohoDropdown, setShowZohoDropdown] = useState(false);
  const [zohoSearchTimeout, setZohoSearchTimeout] = useState<any>(null);

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewCustomerForm(prev => ({ ...prev, companyName: value }));

    if (zohoSearchTimeout) {
      clearTimeout(zohoSearchTimeout);
    }

    if (value.trim().length >= 2) {
      const timeout = setTimeout(async () => {
        try {
          const res = await api.get(`/zoho/customers?query=${encodeURIComponent(value)}`);
          setZohoResults(res.data);
          setShowZohoDropdown(true);
        } catch (err) {
          console.error('Zoho customer search failed:', err);
        }
      }, 400);
      setZohoSearchTimeout(timeout);
    } else {
      setZohoResults([]);
      setShowZohoDropdown(false);
    }
  };

  const handleSelectZohoCustomer = async (zc: any) => {
    try {
      const res = await api.get(`/zoho/customers/${zc.zohoContactId}`);
      const details = res.data;
      
      setNewCustomerForm(prev => ({
        ...prev,
        companyName: details.companyName || zc.companyName,
        customerName: details.customerName || zc.customerName,
        mobileNumber: details.mobileNumber || zc.mobileNumber,
        email: details.email || zc.email,
        gstNumber: details.gstNumber || zc.gstNumber,
        address: details.billingAddress || details.address || '',
        billingAddress: details.billingAddress || '',
        shippingAddress: details.shippingAddress || '',
        billingState: details.billingState || '',
        shippingState: details.shippingState || '',
        contactPerson: details.customerName || zc.customerName
      }));
    } catch (err) {
      console.error('Failed to fetch Zoho customer details:', err);
      setNewCustomerForm(prev => ({
        ...prev,
        companyName: zc.companyName,
        customerName: zc.customerName,
        mobileNumber: zc.mobileNumber,
        email: zc.email,
        gstNumber: zc.gstNumber,
        address: zc.address || '',
        billingAddress: zc.address || '',
        shippingAddress: zc.address || '',
        billingState: '',
        shippingState: '',
        contactPerson: zc.customerName
      }));
    } finally {
      setZohoResults([]);
      setShowZohoDropdown(false);
    }
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customers', {
        ...newCustomerForm,
        contactPerson: newCustomerForm.customerName
      });
      setShowAddModal(false);
      setNewCustomerForm({
        companyName: '',
        customerName: '',
        mobileNumber: '',
        email: '',
        address: '',
        billingAddress: '',
        shippingAddress: '',
        billingState: '',
        shippingState: '',
        gstNumber: '',
        contactPerson: ''
      });
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add customer');
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (e) {
      console.error('Failed to load customers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSelectCustomer = async (cust: any) => {
    try {
      const res = await api.get(`/customers/${cust.id}/history`);
      setSelectedCustomer(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCustomer = async (cust: any) => {
    if (!window.confirm(`Are you sure you want to delete customer "${cust.companyName}" from the portal? (Note: If this customer was imported from Zoho Books, they will still remain intact in your Zoho Books accounts).`)) {
      return;
    }
    
    try {
      const res = await api.delete(`/customers/${cust.id}`);
      toast.success('Customer Deleted', res.data.message || 'Customer removed from portal database.');
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      toast.error('Deletion Failed', err.response?.data?.message || 'Failed to remove customer.');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.mobileNumber.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Customer Database</h1>
          <p className="text-sm text-slate-500">Trace historical repair records of returning client organizations.</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm text-xs cursor-pointer transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Search & Directory list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 h-9 w-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                placeholder="Search customers..."
              />
            </div>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="py-10 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No customers registered.</p>
              ) : (
                filteredCustomers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectCustomer(cust)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                      selectedCustomer?.id === cust.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-950">{cust.companyName}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{cust.customerName} | {cust.mobileNumber}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Customer Detailed History */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 text-left animate-fade-in">
              <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-950">{selectedCustomer.companyName}</h2>
                  <p className="text-xs text-slate-500 mt-1">Authorized Contact: {selectedCustomer.customerName}</p>
                </div>
                <div className="flex items-center gap-2">
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleDeleteCustomer(selectedCustomer)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-rose-600/5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Client
                    </button>
                  )}
                  <span className="badge-status bg-slate-100 text-slate-700 font-bold text-xs py-1.5 px-2.5 rounded-xl border border-slate-200">
                    Client ID: {selectedCustomer.id.substring(0, 8).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</p>
                  <p className="font-semibold text-slate-800 mt-1">{selectedCustomer.mobileNumber}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                  <p className="font-semibold text-slate-800 mt-1 truncate">{selectedCustomer.email}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GST Registration</p>
                  <p className="font-semibold text-slate-800 mt-1 uppercase">{selectedCustomer.gstNumber || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing Address</p>
                  <p className="font-semibold text-slate-800 mt-1">{selectedCustomer.billingAddress || selectedCustomer.address || 'N/A'}</p>
                  {selectedCustomer.billingState && (
                    <p className="text-[10px] text-blue-600 mt-1 font-bold">Region: {selectedCustomer.billingState}</p>
                  )}
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shipping Address</p>
                  <p className="font-semibold text-slate-800 mt-1">{selectedCustomer.shippingAddress || 'N/A'}</p>
                  {selectedCustomer.shippingState && (
                    <p className="text-[10px] text-blue-600 mt-1 font-bold">Region: {selectedCustomer.shippingState}</p>
                  )}
                </div>
              </div>

              {/* Service jobs timeline history */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ClipboardList className="h-5 w-5 text-slate-400" />
                  Service Record History dossier
                </h3>

                <div className="space-y-3">
                  {selectedCustomer.serviceJobs.length === 0 ? (
                    <p className="text-xs text-slate-400">No repair jobs logged for this customer.</p>
                  ) : (
                    selectedCustomer.serviceJobs.map((job: any) => (
                      <div key={job.id} className="p-4 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-slate-50/50 transition-all flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-blue-600">{job.trackId}</p>
                          <p className="font-semibold text-slate-800">
                            {job.laserSource.brand} {job.laserSource.powerRating} Laser (Model: {job.laserSource.modelNumber})
                          </p>
                          <p className="text-[10px] text-slate-400">Received on: {new Date(job.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="badge-status bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                            {job.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-20 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-400">
              <Users className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold">Select a customer from the left to view lifetime repair history.</p>
            </div>
          )}
        </div>

        </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-fade-in p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Add New Customer
              </h2>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-6 mt-4 text-left">
              {/* 1. Customer Section */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company Name *</label>
                    <input
                      type="text" required
                      value={newCustomerForm.companyName}
                      onChange={handleCompanyNameChange}
                      onBlur={() => setTimeout(() => setShowZohoDropdown(false), 200)}
                      onFocus={() => setShowZohoDropdown(true)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Laser Cutting Ltd"
                    />
                    {showZohoDropdown && zohoResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {zohoResults.map((zc: any, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectZohoCustomer(zc)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex flex-col focus:outline-none cursor-pointer"
                          >
                            <span className="text-[11px] font-bold text-slate-900">{zc.companyName}</span>
                            <span className="text-[9px] text-slate-500 mt-0.5">{zc.customerName} | {zc.mobileNumber || zc.email || 'No contact details'}</span>
                            {zc.gstNumber && <span className="text-[9px] font-bold text-blue-600 tracking-wider mt-0.5">GST: {zc.gstNumber}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Contact Name *</label>
                    <input
                      type="text" required
                      value={newCustomerForm.customerName}
                      onChange={e => setNewCustomerForm({...newCustomerForm, customerName: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mobile Number *</label>
                    <input
                      type="tel" required
                      value={newCustomerForm.mobileNumber}
                      onChange={e => setNewCustomerForm({...newCustomerForm, mobileNumber: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="+919999999999"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                    <input
                      type="email"
                      value={newCustomerForm.email}
                      onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="john@lasercut.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">GST Number</label>
                    <input
                      type="text"
                      value={newCustomerForm.gstNumber}
                      onChange={e => setNewCustomerForm({...newCustomerForm, gstNumber: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="07AAAAA1111A1Z1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Billing Address *</label>
                    <textarea
                      required rows={2}
                      value={newCustomerForm.billingAddress}
                      onChange={e => setNewCustomerForm({...newCustomerForm, billingAddress: e.target.value, address: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Billing Address"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shipping Address *</label>
                    <textarea
                      required rows={2}
                      value={newCustomerForm.shippingAddress}
                      onChange={e => setNewCustomerForm({...newCustomerForm, shippingAddress: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Shipping Address"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Billing State (Region)</label>
                    <input
                      type="text"
                      value={newCustomerForm.billingState}
                      onChange={e => setNewCustomerForm({...newCustomerForm, billingState: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Maharashtra"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shipping State (Region)</label>
                    <input
                      type="text"
                      value={newCustomerForm.shippingState}
                      onChange={e => setNewCustomerForm({...newCustomerForm, shippingState: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Maharashtra"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
