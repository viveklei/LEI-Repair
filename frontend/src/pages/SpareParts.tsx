import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Package, AlertTriangle, RefreshCw, Trash2, X, Search, TrendingDown, BarChart3, IndianRupee, Eye, Pencil, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SpareParts: React.FC = () => {
  const { user } = useAuth();
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LOW' | 'OK'>('ALL');
  // Logs Modal States
  const [poLoading, setPoLoading] = useState(false);
  const [syncingZoho, setSyncingZoho] = useState(false);
  
  // Add Part Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPartForm, setNewPartForm] = useState({
    partName: '',
    partNumber: '',
    hsnSac: '',
    description: '',
    manufacturer: '',
    quantity: '',
    stockLevel: '',
    cost: ''
  });

  // Zoho Items Autocomplete Suggestions
  const [zohoItems, setZohoItems] = useState<any[]>([]);
  const [showZohoItemsDropdown, setShowZohoItemsDropdown] = useState(false);
  const [zohoItemSearchTimeout, setZohoItemSearchTimeout] = useState<any>(null);
  const [zohoSearchError, setZohoSearchError] = useState<string | null>(null);

  const handlePartNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPartForm(prev => ({ ...prev, partName: value }));

    if (zohoItemSearchTimeout) {
      clearTimeout(zohoItemSearchTimeout);
    }

    if (value.trim().length >= 3) {
      const timeout = setTimeout(async () => {
        try {
          setZohoSearchError(null);
          const res = await api.get(`/zoho/items?query=${encodeURIComponent(value)}`);
          setZohoItems(res.data);
          setShowZohoItemsDropdown(true);
        } catch (err: any) {
          console.error('Zoho items search failed:', err);
          const errMsg = err.response?.data?.message || 'Failed to search Zoho items.';
          if (errMsg.includes('You are not authorized') || errMsg.includes('code: 57') || errMsg.includes('code":57')) {
            setZohoSearchError("You are not authorized to view Zoho items. Please regenerate your Zoho Books OAuth Refresh Token with 'ZohoBooks.items.READ' scope.");
          } else {
            setZohoSearchError(errMsg);
          }
          setZohoItems([]);
          setShowZohoItemsDropdown(true);
        }
      }, 400);
      setZohoItemSearchTimeout(timeout);
    } else {
      setZohoItems([]);
      setShowZohoItemsDropdown(false);
      setZohoSearchError(null);
    }
  };

  const handleSelectZohoItem = (item: any) => {
    const cleanName = item.name || '';
    let detectedManufacturer = 'Generic';
    const brands = ['Raycus', 'IPG', 'Maxphotonics', 'Endura', 'JPT', 'BWT', 'Reci', 'Super'];
    for (const brand of brands) {
      if (new RegExp('\\\b' + brand + '\\\b', 'i').test(cleanName)) {
        detectedManufacturer = brand;
        break;
      }
    }
    if (detectedManufacturer === 'Generic') {
      const firstWord = cleanName.trim().split(' ')[0];
      if (firstWord && /^[a-zA-Z]{3,}/.test(firstWord)) {
        detectedManufacturer = firstWord;
      }
    }

    setNewPartForm({
      partName: item.name,
      partNumber: item.sku || '',
      hsnSac: item.hsnSac || '',
      description: item.description || '',
      manufacturer: detectedManufacturer,
      quantity: '',
      stockLevel: '5',
      cost: String(item.rate)
    });
    setZohoItems([]);
    setShowZohoItemsDropdown(false);
  };
  
  const handleSyncZoho = async () => {
    setSyncingZoho(true);
    try {
      const res = await api.post('/zoho/spares/sync');
      alert(`Sync completed! Added ${res.data.added} new spares, updated ${res.data.updated} existing spares.`);
      fetchParts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to sync spare parts from Zoho Books.');
    } finally {
      setSyncingZoho(false);
    }
  };

  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedPartLogs, setSelectedPartLogs] = useState<any[]>([]);
  const [logsPartName, setLogsPartName] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // Custom PO Wizard Modal States
  const [showPoModal, setShowPoModal] = useState(false);
  const [poForm, setPoForm] = useState<any>({
    poNumber: '',
    poDate: '',
    refNo: '',
    placeOfSupply: 'Tamil Nadu (33)',
    vendorName: '',
    vendorAddress: '',
    items: [],
    notes: 'Delivery of materials should be made within the said time bound, if not the supplier must take responsibility.\nMention GST no: 33AAGFL9943F1Z6 in Invoice.'
  });

  const [zohoVendors, setZohoVendors] = useState<any[]>([]);
  const [showZohoVendorsDropdown, setShowZohoVendorsDropdown] = useState(false);
  const [zohoVendorSearchTimeout, setZohoVendorSearchTimeout] = useState<any>(null);


  // Edit Part Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any>(null);
  const [editPartForm, setEditPartForm] = useState({
    partName: '',
    partNumber: '',
    hsnSac: '',
    description: '',
    manufacturer: '',
    quantity: '',
    stockLevel: '',
    cost: ''
  });

  const fetchParts = async () => {
    try {
      const res = await api.get('/spare-parts');
      setParts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const handleEditClick = (part: any) => {
    setEditingPart(part);
    setEditPartForm({
      partName: part.partName || '',
      partNumber: part.partNumber || '',
      hsnSac: part.hsnSac || '',
      description: part.description || '',
      manufacturer: part.manufacturer || '',
      quantity: String(part.quantity),
      stockLevel: String(part.stockLevel),
      cost: String(part.cost)
    });
    setShowEditModal(true);
  };

  const handleEditPartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/spare-parts/${editingPart.id}`, {
        partName: editPartForm.partName,
        partNumber: editPartForm.partNumber || null,
        hsnSac: editPartForm.hsnSac || null,
        description: editPartForm.description || null,
        manufacturer: editPartForm.manufacturer,
        quantity: parseInt(editPartForm.quantity) || 0,
        stockLevel: parseInt(editPartForm.stockLevel) || 0,
        cost: parseFloat(editPartForm.cost) || 0
      });
      setShowEditModal(false);
      setEditingPart(null);
      fetchParts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update spare part');
    }
  };

  const handleViewLogs = async (part: any) => {
    setLogsPartName(part.partName);
    setShowLogsModal(true);
    setLogsLoading(true);
    try {
      const res = await api.get(`/spare-parts/${part.id}/logs`);
      setSelectedPartLogs(res.data);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleOpenPoWizard = () => {
    const dateFormatted = new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
    const yearCode = new Date().getFullYear().toString().substring(2);
    
    // Auto-generate order metrics
    const generatedPoNo = `LEIPO${yearCode}-${yearCode}/${Math.floor(Math.random() * 90 + 10)}`;
    const generatedRefNo = `AL${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-001`;

    const lowParts = parts
      .filter(p => p.quantity <= p.stockLevel)
      .map(p => ({
        name: p.partName,
        description: p.partNumber || '',
        qty: p.stockLevel - p.quantity > 0 ? p.stockLevel - p.quantity : 1,
        rate: p.cost || 0
      }));

    setPoForm({
      poNumber: generatedPoNo,
      poDate: dateFormatted,
      refNo: generatedRefNo,
      placeOfSupply: 'Tamil Nadu (33)',
      vendorName: '',
      vendorAddress: '',
      items: lowParts,
      notes: 'Delivery of materials should be made within the said time bound, if not the supplier must take responsibility.\nMention GST no: 33AAGFL9943F1Z6 in Invoice.'
    });

    setShowPoModal(true);
  };

  const handleGenerateCustomPo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoLoading(true);
    try {
      const res = await api.post('/spare-parts/low-stock/pdf', poForm);
      if (res.data.pdfUrl) {
        window.open(`http://localhost:5000${res.data.pdfUrl}`, '_blank');
        setShowPoModal(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to compile custom PO document');
    } finally {
      setPoLoading(false);
    }
  };

  const handleVendorNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPoForm(prev => ({ ...prev, vendorName: value }));

    if (zohoVendorSearchTimeout) {
      clearTimeout(zohoVendorSearchTimeout);
    }

    if (value.trim().length >= 3) {
      const timeout = setTimeout(async () => {
        try {
          const res = await api.get(`/zoho/vendors?query=${encodeURIComponent(value)}`);
          setZohoVendors(res.data);
          setShowZohoVendorsDropdown(true);
        } catch (err) {
          console.error('Zoho vendor search failed:', err);
        }
      }, 400);
      setZohoVendorSearchTimeout(timeout);
    } else {
      setZohoVendors([]);
      setShowZohoVendorsDropdown(false);
    }
  };

  const handleSelectZohoVendor = async (v: any) => {
    try {
      const res = await api.get(`/zoho/vendors/${v.zohoContactId}`);
      const details = res.data;
      setPoForm(prev => ({
        ...prev,
        vendorName: details.companyName || details.customerName,
        vendorAddress: details.billingAddress || details.shippingAddress || v.address,
        placeOfSupply: details.billingState ? `${details.billingState}` : prev.placeOfSupply
      }));
      setShowZohoVendorsDropdown(false);
    } catch (err) {
      console.error('Failed to retrieve Zoho vendor details:', err);
    }
  };

  const handleDeletePart = async (partId: string) => {
    if (!window.confirm('Are you sure you want to delete this spare part from the inventory? This will also clear any records of its usage in past repairs.')) return;
    try {
      await api.delete(`/spare-parts/${partId}`);
      fetchParts();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Deletion failed');
    }
  };

  const handleAddPartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/spare-parts', {
        partName: newPartForm.partName,
        partNumber: newPartForm.partNumber || null,
        hsnSac: newPartForm.hsnSac || null,
        description: newPartForm.description || null,
        manufacturer: newPartForm.manufacturer,
        quantity: parseInt(newPartForm.quantity) || 0,
        stockLevel: parseInt(newPartForm.stockLevel) || 0,
        cost: parseFloat(newPartForm.cost) || 0
      });
      setShowAddModal(false);
      setNewPartForm({
        partName: '',
        partNumber: '',
        hsnSac: '',
        description: '',
        manufacturer: '',
        quantity: '',
        stockLevel: '',
        cost: ''
      });
      fetchParts();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to add spare part');
    }
  };

  // Derived filtered list
  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchSearch = !search ||
        p.partName?.toLowerCase().includes(search.toLowerCase()) ||
        (p.partNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.manufacturer || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.hsnSac || '').toLowerCase().includes(search.toLowerCase());
      const isLow = p.quantity <= p.stockLevel;
      const matchFilter = filterStatus === 'ALL' || (filterStatus === 'LOW' ? isLow : !isLow);
      return matchSearch && matchFilter;
    });
  }, [parts, search, filterStatus]);

  const lowStockCount = parts.filter(p => p.quantity <= p.stockLevel).length;
  const totalValue = parts.reduce((s, p) => s + (p.cost * p.quantity), 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Spare Parts Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage diode modules, collimators, and consumables. Critical stock warnings trigger alert flags.</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTS') && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncZoho}
              disabled={syncingZoho}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncingZoho ? 'animate-spin' : ''}`} />
              {syncingZoho ? 'Syncing...' : 'Sync from Zoho'}
            </button>
            <button
              onClick={handleOpenPoWizard}
              disabled={poLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold rounded-xl text-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              {poLoading ? 'Generating...' : '📄 Generate PO'}
            </button>
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow text-xs cursor-pointer transition-colors"
              >
                <Package className="h-4 w-4" />
                Add Spare Part
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl"><BarChart3 className="h-5 w-5 text-blue-600" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total SKUs</p>
            <p className="text-2xl font-black text-slate-900">{parts.length}</p>
          </div>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 flex items-center gap-3 ${lowStockCount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
          <div className={`p-2.5 rounded-xl ${lowStockCount > 0 ? 'bg-rose-100' : 'bg-emerald-50'}`}>
            <TrendingDown className={`h-5 w-5 ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Stock Alerts</p>
            <p className={`text-2xl font-black ${lowStockCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{lowStockCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 rounded-xl"><IndianRupee className="h-5 w-5 text-violet-600" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory Value</p>
            <p className="text-2xl font-black text-slate-900">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, part no., manufacturer, HSN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white shadow-sm font-medium"
          />
        </div>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm text-xs font-bold">
          {(['ALL', 'LOW', 'OK'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-4 py-2.5 transition-colors cursor-pointer ${
                filterStatus === f
                  ? f === 'LOW' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'LOW' ? '⚠ Low Stock' : '✓ In Stock'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 font-semibold">{filteredParts.length} of {parts.length} parts</p>
      </div>

      {/* ── Cards Grid ── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-xs text-slate-400 mt-3 font-semibold">Loading inventory…</p>
        </div>
      ) : filteredParts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <Package className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">No parts match your search</p>
          <p className="text-xs text-slate-300 mt-1">Try adjusting the search or filter above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredParts.map((part) => {
            const isLow = part.quantity <= part.stockLevel;
            const stockPct = part.stockLevel > 0 ? Math.min((part.quantity / (part.stockLevel * 2)) * 100, 100) : 100;
            return (
              <div
                key={part.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col ${
                  isLow ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-100'
                }`}
              >
                {/* Card Header */}
                <div className={`px-5 pt-4 pb-3 rounded-t-2xl ${ isLow ? 'bg-rose-50/60' : 'bg-slate-50/60'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm leading-tight truncate" title={part.partName}>{part.partName}</p>
                      {part.description && (
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5 line-clamp-1" title={part.description}>{part.description}</p>
                      )}
                    </div>
                    {isLow ? (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full font-black text-[9px] uppercase tracking-wider animate-pulse">
                        <AlertTriangle className="h-3 w-3" /> Low
                      </span>
                    ) : (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-black text-[9px] uppercase tracking-wider">
                        In Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-5 py-3 flex-1 space-y-3">
                  {/* Key Info Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Part No.</p>
                      <p className="font-mono font-bold text-slate-700 truncate">{part.partNumber || <span className="text-slate-300">N/A</span>}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">HSN/SAC</p>
                      <p className="font-mono font-bold text-slate-700">{part.hsnSac || <span className="text-slate-300">N/A</span>}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Manufacturer</p>
                      <p className="font-bold text-slate-700">{part.manufacturer || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Cost / Unit</p>
                      <p className="font-black text-slate-900">₹{Number(part.cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* Stock Level Bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stock Level</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-lg font-black leading-none ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>{part.quantity}</span>
                        <span className="text-[9px] text-slate-400 font-bold">/ min {part.stockLevel}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${ isLow ? 'bg-rose-400' : 'bg-emerald-400'}`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleEditClick(part)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer text-[11px] font-bold"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleViewLogs(part)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-lg transition-all cursor-pointer text-[11px] font-bold"
                  >
                    <Eye className="h-3 w-3" /> History
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleDeletePart(part.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-500 rounded-lg transition-all cursor-pointer text-[11px] font-bold"
                      title="Delete Spare Part"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- ADD NEW SPARE PART MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in text-left">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-extrabold text-sm tracking-wide uppercase flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-400" />
                Add New Spare Part
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddPartSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Part Specification / Name *</label>
                  <div className="relative">
                    <input
                      type="text" required
                      value={newPartForm.partName}
                      onChange={handlePartNameChange}
                      placeholder="e.g., QBH output window protective lens"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    />
                    {showZohoItemsDropdown && (zohoItems.length > 0 || zohoSearchError) && (
                      <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto text-left p-1">
                        {zohoSearchError ? (
                          <div className="p-3 text-[11px] text-slate-500">
                            <p className="font-bold text-rose-600 mb-1">Zoho Search Blocked</p>
                            <p className="leading-relaxed">{zohoSearchError}</p>
                          </div>
                        ) : (
                          zohoItems.map((item) => (
                            <button
                              key={item.zohoItemId}
                              type="button"
                              onClick={() => handleSelectZohoItem(item)}
                              className="w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left flex justify-between items-center border-b border-slate-100 last:border-0 cursor-pointer"
                            >
                              <div>
                                <p className="font-bold text-slate-800">{item.name}</p>
                                {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                              </div>
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                ₹{item.rate}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PART NUMBER</label>
                  <input
                    type="text"
                    value={newPartForm.partNumber}
                    onChange={e => setNewPartForm({ ...newPartForm, partNumber: e.target.value })}
                    placeholder="e.g., PL-QBH-20"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">HSN/SAC</label>
                  <input
                    type="text"
                    value={newPartForm.hsnSac}
                    onChange={e => setNewPartForm({ ...newPartForm, hsnSac: e.target.value })}
                    placeholder="e.g., 9013"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Item Description</label>
                  <textarea
                    rows={2}
                    value={newPartForm.description}
                    onChange={e => setNewPartForm({ ...newPartForm, description: e.target.value })}
                    placeholder="Provide additional details or specifications of the item..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Manufacturer *</label>
                <input
                  type="text" required
                  value={newPartForm.manufacturer}
                  onChange={e => setNewPartForm({ ...newPartForm, manufacturer: e.target.value })}
                  placeholder="e.g., Raycus / Maxphotonics / IPG"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">In-Stock Quantity *</label>
                  <input
                    type="number" required min="0"
                    value={newPartForm.quantity}
                    onChange={e => setNewPartForm({ ...newPartForm, quantity: e.target.value })}
                    placeholder="10"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Min Alert level *</label>
                  <input
                    type="number" required min="0"
                    value={newPartForm.stockLevel}
                    onChange={e => setNewPartForm({ ...newPartForm, stockLevel: e.target.value })}
                    placeholder="3"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Per Unit (₹) *</label>
                <input
                  type="number" required min="0" step="0.01"
                  value={newPartForm.cost}
                  onChange={e => setNewPartForm({ ...newPartForm, cost: e.target.value })}
                  placeholder="450.00"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Save Spare Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SPARE PART INVENTORY TRANSACTIONS DETAIL MODAL --- */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in text-left">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm tracking-wide uppercase">
                  Inventory Transaction History
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{logsPartName}</p>
              </div>
              <button
                onClick={() => { setShowLogsModal(false); setSelectedPartLogs([]); }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {logsLoading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-xs text-slate-400 font-bold mt-2">Loading transaction logs...</p>
                </div>
              ) : selectedPartLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No transaction history logged for this item.
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Date &amp; Time</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Quantity Changed</th>
                        <th className="py-3 px-4">Details / Remarks</th>
                        <th className="py-3 px-4 text-right">Job Ticket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {selectedPartLogs.map((log: any) => {
                        const isQtyNegative = log.quantity < 0;
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 text-slate-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                log.changeType === 'CONSUMED' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                  : log.changeType === 'ADDED' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {log.changeType}
                              </span>
                            </td>
                            <td className={`py-3 px-4 font-bold text-sm ${isQtyNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isQtyNegative ? '' : '+'}{log.quantity}
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={log.remarks}>
                              {log.remarks || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold">
                              {log.changeType === 'CONSUMED' && log.referenceId ? (
                                <a 
                                  href={`/jobs/${log.referenceId}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  View Job
                                </a>
                              ) : log.changeType === 'ADDED' && log.remarks?.includes('repair') && log.referenceId ? (
                                <a 
                                  href={`/jobs/${log.referenceId}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  View Job
                                </a>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowLogsModal(false); setSelectedPartLogs([]); }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT SPARE PART MODAL --- */}
      {/* --- CUSTOM PURCHASE ORDER WIZARD MODAL --- */}
      {showPoModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in text-left">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm tracking-wide uppercase">
                  Laser Experts India LLP - Purchase Order Wizard
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Customize vendor info, billing options, and items to order</p>
              </div>
              <button
                onClick={() => setShowPoModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateCustomPo} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Row 1: PO Details */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PO Number *</label>
                  <input
                    type="text" required
                    value={poForm.poNumber}
                    onChange={e => setPoForm({ ...poForm, poNumber: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PO Date *</label>
                  <input
                    type="text" required
                    value={poForm.poDate}
                    onChange={e => setPoForm({ ...poForm, poDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 13.06.2026"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reference Number (Ref#)</label>
                  <input
                    type="text"
                    value={poForm.refNo}
                    onChange={e => setPoForm({ ...poForm, refNo: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Place of Supply *</label>
                  <select
                    value={poForm.placeOfSupply}
                    onChange={e => setPoForm({ ...poForm, placeOfSupply: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Tamil Nadu (33)">Tamil Nadu (33)</option>
                    <option value="Kerala (32)">Kerala (32)</option>
                    <option value="Karnataka (29)">Karnataka (29)</option>
                    <option value="Maharashtra (27)">Maharashtra (27)</option>
                    <option value="Delhi (07)">Delhi (07)</option>
                    <option value="Gujarat (24)">Gujarat (24)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Vendor Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vendor Name *</label>
                  <input
                    type="text" required
                    value={poForm.vendorName}
                    onChange={handleVendorNameChange}
                    onBlur={() => setTimeout(() => setShowZohoVendorsDropdown(false), 200)}
                    onFocus={() => { if (zohoVendors.length > 0) setShowZohoVendorsDropdown(true); }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-bold bg-white"
                    placeholder="Search Zoho vendor..."
                    autoComplete="off"
                  />
                  {showZohoVendorsDropdown && zohoVendors.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[99999] max-h-48 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                      {zohoVendors.map(v => (
                        <button
                          key={v.zohoContactId}
                          type="button"
                          onMouseDown={() => handleSelectZohoVendor(v)}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors text-xs flex flex-col cursor-pointer"
                        >
                          <span className="font-extrabold text-slate-900">{v.companyName}</span>
                          <span className="text-[10px] text-slate-500">{v.customerName} · {v.email || 'No email'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vendor Address *</label>
                  <textarea
                    rows={2} required
                    value={poForm.vendorAddress}
                    onChange={e => setPoForm({ ...poForm, vendorAddress: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Line 1, Line 2, City, ZIP, Country"
                  />
                </div>
              </div>

              {/* Row 3: Items List */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Spares & Items Order List</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setPoForm({
                        ...poForm,
                        items: [...poForm.items, { name: '', description: '', qty: 1, rate: 0 }]
                      });
                    }}
                    className="text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-blue-600 font-bold hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    + Add Custom Item
                  </button>
                </div>

                <div className="space-y-2.5">
                  {poForm.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="md:col-span-2">
                          <input
                            type="text" required
                            placeholder="Item Name / Specification"
                            value={item.name}
                            onChange={e => {
                              const list = [...poForm.items];
                              list[idx].name = e.target.value;
                              setPoForm({ ...poForm, items: list });
                            }}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Part No / Description (optional)"
                            value={item.description}
                            onChange={e => {
                              const list = [...poForm.items];
                              list[idx].description = e.target.value;
                              setPoForm({ ...poForm, items: list });
                            }}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] focus:outline-none focus:border-blue-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold">Qty</label>
                          <input
                            type="number" required min="1"
                            value={item.qty}
                            onChange={e => {
                              const list = [...poForm.items];
                              list[idx].qty = parseInt(e.target.value) || 1;
                              setPoForm({ ...poForm, items: list });
                            }}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold">Rate</label>
                          <input
                            type="number" required min="0" step="any"
                            value={item.rate}
                            onChange={e => {
                              const list = [...poForm.items];
                              list[idx].rate = parseFloat(e.target.value) || 0;
                              setPoForm({ ...poForm, items: list });
                            }}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const list = poForm.items.filter((_: any, i: number) => i !== idx);
                          setPoForm({ ...poForm, items: list });
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer mt-5"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>



              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={poLoading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {poLoading ? 'Compiling PO...' : 'Generate Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingPart && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in text-left">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-extrabold text-sm tracking-wide uppercase flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-400" />
                Edit Spare Part: {editingPart.partName}
              </h3>
              <button
                onClick={() => { setShowEditModal(false); setEditingPart(null); }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditPartSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Part Specification / Name *</label>
                  <input
                    type="text" required
                    value={editPartForm.partName}
                    onChange={e => setEditPartForm({ ...editPartForm, partName: e.target.value })}
                    placeholder="e.g., QBH output window protective lens"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PART NUMBER</label>
                  <input
                    type="text"
                    value={editPartForm.partNumber}
                    onChange={e => setEditPartForm({ ...editPartForm, partNumber: e.target.value })}
                    placeholder="e.g., PL-QBH-20"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">HSN/SAC</label>
                  <input
                    type="text"
                    value={editPartForm.hsnSac}
                    onChange={e => setEditPartForm({ ...editPartForm, hsnSac: e.target.value })}
                    placeholder="e.g., 9013"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Item Description</label>
                  <textarea
                    rows={2}
                    value={editPartForm.description}
                    onChange={e => setEditPartForm({ ...editPartForm, description: e.target.value })}
                    placeholder="Provide additional details or specifications of the item..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Manufacturer *</label>
                <input
                  type="text" required
                  value={editPartForm.manufacturer}
                  onChange={e => setEditPartForm({ ...editPartForm, manufacturer: e.target.value })}
                  placeholder="e.g., Raycus / Maxphotonics / IPG"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">In-Stock Quantity *</label>
                  <input
                    type="number" required min="0"
                    value={editPartForm.quantity}
                    onChange={e => setEditPartForm({ ...editPartForm, quantity: e.target.value })}
                    placeholder="10"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Min Alert level *</label>
                  <input
                    type="number" required min="0"
                    value={editPartForm.stockLevel}
                    onChange={e => setEditPartForm({ ...editPartForm, stockLevel: e.target.value })}
                    placeholder="3"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Per Unit (₹) *</label>
                <input
                  type="number" required min="0" step="0.01"
                  value={editPartForm.cost}
                  onChange={e => setEditPartForm({ ...editPartForm, cost: e.target.value })}
                  placeholder="450.00"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPart(null); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
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

export default SpareParts;
