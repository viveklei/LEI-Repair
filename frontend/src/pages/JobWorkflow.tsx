import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api, { API_URL } from '../services/api';
import { socket } from '../services/socket';
import { fileUrl, portalTrackUrl } from '../utils/urls';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Wrench, 
  User, 
  Cpu, 
  History, 
  FileText, 
  DollarSign, 
  Truck, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileBadge,
  Printer,
  QrCode,
  Download,
  MessageSquare,
  Trash2,
  Upload,
  ChevronDown,
  ChevronUp,
  Camera,
  Phone
} from 'lucide-react';

const STATUS_ORDER = [
  'RECEIVED',
  'INITIAL_DIAGNOSIS',
  'QUOTATION_GENERATED',
  'UNDER_REPAIR',
  'TESTING_BURN_IN',
  'READY_FOR_DISPATCH',
  'PAYMENT_COMPLETED',
  'DISPATCHED',
  'CLOSED'
];

const JobWorkflow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'actions' | 'timeline'>('actions');
  const [savingDraft, setSavingDraft] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({
    dossier: false,
    specs: false,
    documents: false,
    history: false,
    chat: false
  });

  const [showBypassModal, setShowBypassModal] = useState(false);
  const [bypassTarget, setBypassTarget] = useState('');
  const [bypassReason, setBypassReason] = useState('');
  const [bypassing, setBypassing] = useState(false);

  const handleBypassStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bypassTarget || !bypassReason.trim() || bypassReason.trim().length < 5) {
      toast.error('Invalid Input', 'Please select a target stage and specify a reason of at least 5 characters.');
      return;
    }
    try {
      setBypassing(true);
      const res = await api.post(`/jobs/${id}/bypass-stage`, {
        targetStatus: bypassTarget,
        reason: bypassReason.trim()
      });
      toast.success('Stage Bypassed', res.data.message);
      setShowBypassModal(false);
      setBypassReason('');
      fetchJobDetails();
    } catch (err: any) {
      toast.error('Bypass Failed', err.response?.data?.message || 'Could not bypass stage.');
    } finally {
      setBypassing(false);
    }
  };

  const togglePanel = (panel: string) => {
    setCollapsedPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Serial history stats (serial intelligence)
  const [serialHistory, setSerialHistory] = useState<any>(null);

  // Forms states
  const [inspectionForm, setInspectionForm] = useState({
    physicalCondition: '',
    internalFindings: '',
    faultAnalysis: '',
    initialDiagnosis: '',
    inspectionNotes: ''
  });
  const [inspectionPhotos, setInspectionPhotos] = useState<FileList | null>(null);

  // Quotation items
  const [spareParts, setSpareParts] = useState<any[]>([]);
  const [quoteItems, setQuoteItems] = useState<any[]>([
    { name: 'Labour charges', category: 'LABOUR', quantity: 1, unitCost: 150, partNumber: '', hsnSac: '', manufacturer: '' }
  ]);

  // Quotation Autocomplete Suggestions
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);
  const [suggestionList, setSuggestionList] = useState<any[]>([]);
  const [suggestionSearchTimeout, setSuggestionSearchTimeout] = useState<any>(null);

  // Repair
  const [repairNotes, setRepairNotes] = useState('');
  const [repairDuration, setRepairDuration] = useState('60');
  const [repairPartsUsed, setRepairPartsUsed] = useState<any[]>([
    { sparePartId: '', quantityUsed: 1 }
  ]);

  // Testing
  const [testingForm, setTestingForm] = useState({
    outputPowerTest: 'PASS - Stable 3.02kW output',
    stabilityTest: 'PASS - Less than 1% variance over 2 hours',
    burnInTest: 'PASS - 4 hour burn-in validation completed',
    alarmVerification: 'PASS - Interlocks and back-reflection alarms clear',
    temperatureTest: 'PASS - Max module temp 24.5C',
    communicationTest: 'PASS - RS232 and EtherCAT state operational',
    testNotes: '',
    result: 'PASS' // PASS or FAIL
  });

  // Service Report compile
  const [reportForm, setReportForm] = useState({
    faultFound: 'Burned optical collimator lens and degraded pump diode modules.',
    rootCauseAnalysis: 'Water chiller failure caused heat accumulation on QBH connector.',
    repairActions: 'Replaced collimator lens assembly and Raycus pump diodes. Re-aligned optical path.',
    finalOutcome: 'Laser source outputs rated power of 3kW stably.',
    signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' // Mock base64 sign
  });

  // Payment
  const [paymentForm, setPaymentForm] = useState({
    invoiceNumber: '',
    invoiceAmount: '0',
    paidAmount: '0',
    overrideReason: ''
  });

  // QC Technical Assessment Modal & Form
  const [showQcModal, setShowQcModal] = useState(false);
  const [qcActiveTab, setQcActiveTab] = useState(1);
  const [qcAssessment, setQcAssessment] = useState<any>(null);

  // Manual WhatsApp Modal State
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState('RECEIVED');
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [qcForm, setQcForm] = useState<any>({
    tarNo: '',
    startDate: '',
    endDate: '',
    department: 'SERVICE & REPAIR',
    reportedByName: '',
    employeeId: '',
    team: 'TEAM_A', // TEAM_A, TEAM_B
    location: 'IN-HOUSE_REPAIR', // IN-HOUSE_REPAIR, ONSITE
    uae: false,
    moduleDetails: 'SINGLE-MODULE', // SINGLE-MODULE, MULTI-MODULE
    qbhCableSpot: false,
    combinerProblem: false,
    psuControlBoard: false,
    lowPower: false,
    activeFiber: false,
    othersProblem: false,
    condition: '', // GOOD, FAIR, POOR
    previousRepair: '', // AVAILABLE, NA
    warranty: '', // UNDER_WARRANTY, NO_WARRANTY
    customerType: '', // CUSTOMER, DEALER, STANDBY, FREELANCER
    sourcePackage: '', // OK, NOT_OK
    qbhCondition: '', // OK, NOT_OK
    externalDamage: '', // YES, NO
    internalDamage: '', // YES, NO
    powerCable: '', // YES, NO
    interfaceCable: '', // YES, NO
    sourceKey: '', // YES, NO
    othersObservation: '',
    emergencySwitch: '', // OK, NOT_OK
    laserButtonOnKey: '', // OK, NOT_OK
    sourceStartKey: '', // OK, NOT_OK
    mainMcb: '', // OK, NOT_OK
    problemIn: '', // OPTICAL_SECTION, ELECTRICAL_SECTION
    observationReportedBy: '',
    immediateActionTaken: '',
    requiredSpareParts: '',
    estimatedDownTime: '1-2 Days',
    redlightVisibility: '', // GOOD, FAIR, POOR
    laserOutput0: '0',
    laserOutput25: '25%',
    laserOutput50: '50%',
    laserOutput75: '75%',
    laserOutput100: '100%',
    powerMeter0: '0W',
    powerMeter25: '750W',
    powerMeter50: '1500W',
    powerMeter75: '2250W',
    powerMeter100: '3000W',
    pumpAmps0: '0 A',
    pumpAmps25: '2.5 A',
    pumpAmps50: '5 A',
    pumpAmps75: '7.5 A',
    pumpAmps100: '10 A',
    optSecTemp: '24',
    optSecTempSt: '', // GOOD, FAIR, POOR
    elecSecTemp: '25',
    elecSecTempSt: '',
    laserPumpTemp: '26',
    laserPumpTempSt: '',
    humidityOpt: '35',
    humidityOptSt: '',
    humidityElec: '36',
    humidityElecSt: '',
    waterFlowQbh: '1.2',
    waterFlowQbhSt: '',
    waterFlowSource: '4.0',
    waterFlowSourceSt: '',
    tempSplicing: '298',
    tempSplicingSt: '',
    tempQbh: '295',
    tempQbhSt: '',
    problemAnalysis: '',
    rootCauseAnalysis: '',
    failHuman: false,
    failMechanical: false,
    failElectrical: false,
    failSoftware: false,
    failEnvironmental: false,
    failSpareLifetime: false,
    failExternal: false,
    repairActionTaken: '', // YES, NO
    partsReplaced: '', // YES, NO
    postRepairTesting: '', // PASS, FAIL
    trailRunningDuration: '',
    runningCondition: '', // OK, NOT_OK
    verifiedBy: '',
    approvedBy: '',
    remark: '',
    paymentType: 'INVOICE', // INVOICE, NON-INVOICE
    invoiceNo: '',
    dispatchMethod: 'TRANSPORT/COURIER' // TRANSPORT/COURIER, CUSTOMER VEHICLE, PORTER
  });

  const requiredQcFields = [
    'tarNo', 'reportedByName', 'employeeId',
    'condition', 'previousRepair', 'warranty', 'customerType', 'sourcePackage',
    'qbhCondition', 'externalDamage', 'internalDamage', 'problemIn', 'observationReportedBy',
    'problemAnalysis', 'rootCauseAnalysis', 'redlightVisibility', 'repairActionTaken', 'partsReplaced',
    'postRepairTesting', 'trailRunningDuration', 'runningCondition', 'verifiedBy', 'approvedBy'
  ];
  const qcCompletedCount = requiredQcFields.filter(f => qcForm[f] && String(qcForm[f]).trim() !== '').length;
  const qcPercent = Math.round((qcCompletedCount / requiredQcFields.length) * 100);

  const tabFields: Record<number, string[]> = {
    1: ['tarNo', 'reportedByName', 'employeeId'],
    2: ['condition', 'previousRepair', 'warranty', 'customerType', 'sourcePackage', 'qbhCondition', 'externalDamage', 'internalDamage'],
    3: ['problemIn', 'observationReportedBy', 'problemAnalysis', 'rootCauseAnalysis'],
    4: ['redlightVisibility', 'repairActionTaken', 'partsReplaced', 'postRepairTesting', 'trailRunningDuration', 'runningCondition', 'verifiedBy', 'approvedBy', 'remark']
  };
  const isFieldEmpty = (f: string) => !qcForm[f] || String(qcForm[f]).trim() === '';
  const isTabIncomplete = (tabId: number) => tabFields[tabId]?.some(isFieldEmpty);
  
  const fieldClass = (fieldName: string, baseClass: string) => 
    isFieldEmpty(fieldName) 
      ? `${baseClass} border-rose-300 bg-rose-50/10 focus:border-rose-500 focus:ring-rose-500` 
      : baseClass;
      
  const labelClass = (fieldName: string, baseClass: string) => 
    isFieldEmpty(fieldName) 
      ? `${baseClass} text-rose-600 font-extrabold flex items-center gap-1` 
      : baseClass;

  // Dispatch
  const [dispatchForm, setDispatchForm] = useState({
    courierName: 'DHL Express',
    awbNumber: ''
  });

  const [engineers, setEngineers] = useState<any[]>([]);
  const [assigningEngineer, setAssigningEngineer] = useState(false);

  const fetchEngineers = async () => {
    try {
      const res = await api.get('/engineers');
      setEngineers(res.data);
    } catch (e) {
      console.error('Failed to fetch engineers:', e);
    }
  };

  const handleAssignEngineer = async (engineerId: string) => {
    try {
      setAssigningEngineer(true);
      await api.patch(`/jobs/${id}/assign`, { engineerId: engineerId || null });
      toast.success('Engineer Assigned', 'The engineer assignment was updated.');
      fetchJobDetails();
    } catch (err: any) {
      toast.error('Assignment Failed', err.response?.data?.message || 'Could not update engineer assignment.');
    } finally {
      setAssigningEngineer(false);
    }
  };

  const fetchJobDetails = async () => {
    try {
      const res = await api.get(`/jobs/${id}`);
      const jobData = res.data;
      setJob(jobData);
      if (!selectedStage) {
        let defaultStage = jobData.status;
        if (defaultStage === 'REPAIR_INITIATED') defaultStage = 'UNDER_REPAIR';
        if (defaultStage === 'REPAIR_COMPLETED') defaultStage = 'TESTING_BURN_IN';
        setSelectedStage(defaultStage);
      }

      // Pre-fill inspectionForm if exists
      if (jobData.inspections && jobData.inspections.length > 0) {
        const insp = jobData.inspections[0];
        setInspectionForm({
          physicalCondition: insp.physicalCondition || '',
          internalFindings: insp.internalFindings || '',
          faultAnalysis: insp.faultAnalysis || '',
          initialDiagnosis: insp.initialDiagnosis || '',
          inspectionNotes: insp.inspectionNotes || ''
        });
      }

      // Pre-fill quoteItems if exists
      if (jobData.quotations && jobData.quotations.length > 0 && jobData.quotations[0].items) {
        setQuoteItems(jobData.quotations[0].items.map((it: any) => ({
          name: it.name,
          category: it.category,
          quantity: it.quantity,
          unitCost: it.unitCost,
          partNumber: it.partNumber || '',
          hsnSac: it.hsnSac || '',
          manufacturer: it.manufacturer || ''
        })));
      }

      // Pre-fill repairForm if exists
      if (jobData.repairs && jobData.repairs.length > 0) {
        const rep = jobData.repairs[0];
        setRepairNotes(rep.repairNotes || rep.notes || '');
        setRepairDuration(String(rep.repairDuration || rep.durationMinutes || 60));
        if (rep.partsUsed && rep.partsUsed.length > 0) {
          setRepairPartsUsed(rep.partsUsed.map((p: any) => ({
            sparePartId: p.sparePartId,
            quantityUsed: p.quantity
          })));
        }
      }

      // Pre-fill testingForm if exists
      if (jobData.testResults && jobData.testResults.length > 0) {
        const t = jobData.testResults[0];
        setTestingForm({
          outputPowerTest: t.outputPowerTest || '',
          stabilityTest: t.stabilityTest || '',
          burnInTest: t.burnInTest || '',
          alarmVerification: t.alarmVerification || '',
          temperatureTest: t.temperatureTest || '',
          communicationTest: t.communicationTest || '',
          testNotes: t.testNotes || t.notes || '',
          result: t.result || 'PASS'
        });
      }

      // Pre-fill reportForm if exists
      if (jobData.serviceReports && jobData.serviceReports.length > 0) {
        const rep = jobData.serviceReports[0];
        setReportForm({
          faultFound: rep.faultFound || '',
          rootCauseAnalysis: rep.rootCauseAnalysis || '',
          repairActions: rep.repairActions || '',
          finalOutcome: rep.finalOutcome || '',
          signatureData: rep.signatureData || ''
        });
      } else {
        // Try to pre-fill from saved QC Assessment if available
        let qcProblem = '';
        let qcRoot = '';
        let qcAction = '';
        let qcDownTime = '';
        try {
          const qcRes = jobData.qcAssessment || {};
          if (qcRes.assessmentData) {
            const parsed = JSON.parse(qcRes.assessmentData);
            qcProblem = parsed.problemAnalysis || '';
            qcRoot = parsed.rootCauseAnalysis || '';
            qcAction = parsed.immediateActionTaken || '';
            qcDownTime = parsed.estimatedDownTime || '';
          }
        } catch (e) {
          console.error(e);
        }

        setReportForm({
          faultFound: qcProblem || 'Burned optical collimator lens and degraded pump diode modules.',
          rootCauseAnalysis: qcRoot || 'Water chiller failure caused heat accumulation on QBH connector.',
          repairActions: qcAction || 'Replaced collimator lens assembly and Raycus pump diodes. Re-aligned optical path.',
          finalOutcome: qcDownTime || 'Laser source outputs rated power of 3kW stably.',
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        });
      }

      // Pre-fill paymentForm if exists
      if (jobData.payments && jobData.payments.length > 0) {
        const pay = jobData.payments[0];
        setPaymentForm({
          invoiceNumber: pay.invoiceNumber || '',
          invoiceAmount: String(pay.invoiceAmount || 0),
          paidAmount: String(pay.paidAmount || 0),
          overrideReason: pay.overrideReason || ''
        });
      } else if (jobData.quotations && jobData.quotations.length > 0) {
        // Calculate quotation sums for default invoice amount
        const activeQuote = jobData.quotations[0];
        setPaymentForm(prev => ({
          ...prev,
          invoiceAmount: String(activeQuote.grandTotal),
          paidAmount: String(activeQuote.grandTotal)
        }));
      }

      // Pre-fill dispatchForm if exists
      if (jobData.dispatches && jobData.dispatches.length > 0) {
        const disp = jobData.dispatches[0];
        setDispatchForm({
          courierName: disp.courierName || 'DHL Express',
          awbNumber: disp.awbNumber || ''
        });
      }

      // Fetch serial number intelligence
      const serialRes = await api.get(`/laser/verify/${jobData.laserSource.serialNumber}`);
      setSerialHistory(serialRes.data);

      // Fetch QC Assessment
      try {
        const qcRes = await api.get(`/qc-assessment/${jobData.id}`);
        if (qcRes.data) {
          setQcAssessment(qcRes.data);
          setQcForm(JSON.parse(qcRes.data.assessmentData));
        } else {
          // Pre-fill from physical inspection fields & repairs if available
          const latestInsp = jobData.inspections?.[0] || {};
          
          // Gather spare parts used in repairs
          const partsList: string[] = [];
          if (jobData.repairs) {
            jobData.repairs.forEach((rep: any) => {
              if (rep.partsUsed) {
                rep.partsUsed.forEach((pu: any) => {
                  if (pu.sparePart) {
                    partsList.push(`${pu.sparePart.partName} (Qty: ${pu.quantity})`);
                  }
                });
              }
            });
          }
          const defaultSparesText = partsList.length > 0 ? partsList.join(', ') : '';

          setQcForm((prev: any) => ({
            ...prev,
            tarNo: `TAR-${new Date().getFullYear()}-${jobData.trackId.split('-')[2] || '0001'}`,
            startDate: new Date(jobData.createdAt).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            reportedByName: user?.name || '',
            employeeId: user?.id?.substring(0, 8) || '',
            verifiedBy: user?.name || '',
            approvedBy: 'Service Manager',
            condition: latestInsp.physicalCondition || prev.condition || '',
            othersObservation: latestInsp.internalFindings || prev.othersObservation || '',
            emergencySwitch: latestInsp.faultAnalysis ? (latestInsp.faultAnalysis.toUpperCase().includes('NOT') ? 'NOT_OK' : 'OK') : prev.emergencySwitch || '',
            problemAnalysis: latestInsp.inspectionNotes || prev.problemAnalysis || '',
            requiredSpareParts: defaultSparesText,
            remark: ''
          }));
        }
      } catch (err) {
        console.error('Failed to load QC Assessment', err);
      }
    } catch (e: any) {
      console.error(e);
      if (e.response?.status === 403) {
        setUnauthorized(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSpareParts = async () => {
    try {
      const res = await api.get('/spare-parts');
      setSpareParts(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-Save Draft for QC Assessment locally (restores if session closed/reloaded)
  useEffect(() => {
    if (!id || !qcForm || !qcForm.tarNo) return;
    const saveTimeout = setTimeout(() => {
      localStorage.setItem(`qc_draft_${id}`, JSON.stringify(qcForm));
    }, 1000); // Debounce localStorage updates by 1 second
    return () => clearTimeout(saveTimeout);
  }, [qcForm, id]);

  // Restore local draft logic on page mount
  const handleRestoreLocalDraft = () => {
    const saved = localStorage.getItem(`qc_draft_${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setQcForm(parsed);
        toast.success('Draft Restored', 'Restored unsaved local changes successfully.');
      } catch (e) {
        console.error('Failed to parse saved QC draft', e);
      }
    }
  };

  useEffect(() => {
    fetchJobDetails();
    fetchSpareParts();
    if (user && (user.role === 'ADMIN' || user.role === 'SUPPORT' || user.role === 'ENGINEER')) {
      fetchEngineers();
    }
  }, [id, user]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.suggestion-container')) {
        setActiveSuggestionIdx(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleItemNameChange = (idx: number, value: string) => {
    const newItems = [...quoteItems];
    newItems[idx].name = value;
    setQuoteItems(newItems);
    setActiveSuggestionIdx(idx);

    if (suggestionSearchTimeout) {
      clearTimeout(suggestionSearchTimeout);
    }

    // Filter local parts
    const localMatches = spareParts
      .filter(p => 
        (p.partName || '').toLowerCase().includes(value.toLowerCase()) ||
        (p.partNumber || '').toLowerCase().includes(value.toLowerCase())
      )
      .map(p => ({
        id: p.id,
        name: p.partName,
        sku: p.partNumber,
        hsnSac: p.hsnSac,
        manufacturer: p.manufacturer,
        rate: p.cost || 0,
        source: 'local'
      }));

    if (value.trim().length >= 3) {
      const timeout = setTimeout(async () => {
        try {
          const res = await api.get(`/zoho/items?query=${encodeURIComponent(value)}`);
          const zohoMatches = res.data.map((item: any) => ({
            id: item.zohoItemId,
            name: item.name,
            sku: item.sku,
            hsnSac: item.hsnSac,
            manufacturer: item.manufacturer,
            rate: item.rate,
            source: 'zoho'
          }));
          
          // Merge & filter out duplicates
          const seenSkus = new Set(localMatches.map(m => m.sku).filter(Boolean));
          const combined = [...localMatches];
          for (const zm of zohoMatches) {
            if (!zm.sku || !seenSkus.has(zm.sku)) {
              combined.push(zm);
            }
          }
          setSuggestionList(combined.slice(0, 10));
        } catch (err) {
          console.error('Zoho item search failed:', err);
          setSuggestionList(localMatches.slice(0, 10));
        }
      }, 400);
      setSuggestionSearchTimeout(timeout);
    } else {
      setSuggestionList(localMatches.slice(0, 10));
    }
  };

  const handleSelectSuggestion = (idx: number, item: any) => {
    const newItems = [...quoteItems];
    newItems[idx].name = item.name;
    newItems[idx].unitCost = String(item.rate);
    newItems[idx].partNumber = item.sku || '';
    newItems[idx].hsnSac = item.hsnSac || '';
    newItems[idx].manufacturer = item.manufacturer || '';
    
    // Auto-select category based on selection
    if (newItems[idx].category === 'LABOUR') {
      newItems[idx].category = 'SPARE_PART';
    }
    setQuoteItems(newItems);
    setActiveSuggestionIdx(null);
    setSuggestionList([]);
  };

  useEffect(() => {
    if (!id) return;
    socket.emit('join_job', id);

    const handleCommentAdded = (comment: any) => {
      setJob((prev: any) => {
        if (!prev) return prev;
        const exists = prev.comments?.some((c: any) => c.id === comment.id);
        if (exists) return prev;
        return {
          ...prev,
          comments: [...(prev.comments || []), comment]
        };
      });
    };

    const handleFileUploaded = (file: any) => {
      setJob((prev: any) => {
        if (!prev) return prev;
        const exists = prev.files?.some((f: any) => f.id === file.id);
        if (exists) return prev;
        return {
          ...prev,
          files: [...(prev.files || []), file]
        };
      });
    };

    socket.on('comment_added', handleCommentAdded);
    socket.on('file_uploaded', handleFileUploaded);

    return () => {
      socket.off('comment_added', handleCommentAdded);
      socket.off('file_uploaded', handleFileUploaded);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center max-w-lg mx-auto mt-12 animate-scale-in">
        <div className="p-4 bg-rose-50 text-rose-600 rounded-full mb-4 border border-rose-100">
          <XCircle className="h-12 w-12" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Access Denied</h2>
        <p className="text-xs text-slate-500 font-semibold mb-6 leading-relaxed">
          You do not have permission to view or work on this service ticket. Engineers are restricted to accessing their assigned jobs only.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <p className="font-semibold text-lg text-slate-400">Failed to load job details.</p>
        <button 
          onClick={() => navigate('/jobs')} 
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
        >
          Back to Jobs List
        </button>
      </div>
    );
  }

  const handleQcSaveDraft = async () => {
    try {
      setSavingDraft(true);
      const res = await api.post('/qc-assessment', {
        jobId: job.id,
        assessmentData: qcForm,
        draft: true
      });
      setQcAssessment(res.data.assessment);
      toast.success('Draft Saved', 'QC Assessment progress saved successfully.');
      fetchJobDetails();
    } catch (err: any) {
      toast.error('Save Draft Failed', err.response?.data?.message || 'Failed to save draft.');
    } finally {
      setSavingDraft(false);
    }
  };

   const handleQcSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     try {
       const res = await api.post('/qc-assessment', {
         jobId: job.id,
         assessmentData: qcForm
       });
       setQcAssessment(res.data.assessment);
       localStorage.removeItem(`qc_draft_${job.id}`); // Clear local draft cache
       toast.success('QC Assessment Submitted', 'Assessment saved successfully and PDF generated.');
       fetchJobDetails();
     } catch (err: any) {
       toast.error('Submission Failed', err.response?.data?.message || 'Failed to save QC Assessment.');
     }
   };

  // Handle forms submits
  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('jobId', job.id);
    Object.keys(inspectionForm).forEach(k => {
      fd.append(k, (inspectionForm as any)[k]);
    });
    if (inspectionPhotos) {
      for (let i = 0; i < inspectionPhotos.length; i++) {
        fd.append('photos', inspectionPhotos[i]);
      }
    }

    try {
      await api.post('/inspection', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Inspection logged successfully.');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Submission failed');
    }
  };

  const handleQuotationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/quotation', {
        jobId: job.id,
        items: quoteItems
      });
      alert('Quotation generated successfully.');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit quote');
    }
  };

  const handleApproval = async (approve: boolean, reason?: string) => {
    const activeQuote = job.quotations.find((q: any) => q.status === 'PENDING_APPROVAL' || q.status === 'REJECTED');
    if (!activeQuote) {
      toast.error('Override Error', 'No pending or rejected quotation was found for this job ticket.');
      return;
    }

    try {
      await api.post(`/quotation/${activeQuote.id}/approve`, { approve, rejectionReason: reason });
      toast.success(
        approve ? 'Stage Unlocked' : 'Job Put On Hold',
        approve ? 'Quotation approved. Repair stage is now unlocked.' : 'Quotation rejected. Job status updated to On Hold.'
      );
      fetchJobDetails();
    } catch (err: any) {
      toast.error('Action Failed', err.response?.data?.message || 'Failed to update quotation approval status.');
    }
  };

  const handleSendManualWhatsapp = async () => {
    if (!job) return;
    try {
      setWhatsappLoading(true);
      await api.post(`/jobs/${job.id}/whatsapp`, { status: whatsappStatus });
      
      // Clean phone number (digits only)
      let cleanPhone = job.customer.mobileNumber.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone; // Add India code if 10 digits
      }

      // Build text message body
      const portalUrl = portalTrackUrl(job.trackId);
      let message = `Hello ${job.customer.customerName}, your fiber laser source repair job (${job.trackId}) status is now: ${whatsappStatus.replace(/_/g, ' ')}. `;
      
      if (whatsappStatus === 'RECEIVED') {
        message += `We have successfully received your laser source. You can track progress here: ${portalUrl}`;
      } else if (whatsappStatus === 'INITIAL_DIAGNOSIS') {
        message += `Our service engineers are currently inspecting the laser source. Check real-time timeline: ${portalUrl}`;
      } else if (whatsappStatus === 'QUOTATION_GENERATED') {
        message += `A quotation has been generated. Please review and approve it on the customer portal: ${portalUrl}`;
      } else if (whatsappStatus === 'CUSTOMER_APPROVAL') {
        message += `Your job is awaiting approval. Review quote here: ${portalUrl}`;
      } else if (whatsappStatus === 'UNDER_REPAIR') {
        message += `Repair work has started. Our engineer is working on the optical/diodes alignment. Status link: ${portalUrl}`;
      } else if (whatsappStatus === 'WAITING_SPARE_PARTS') {
        message += `⚠️ Repair is on hold waiting for spare parts to arrive. We will notify you once parts are received. Status link: ${portalUrl}`;
      } else if (whatsappStatus === 'TESTING_BURN_IN') {
        message += `Repair completed! The source is now undergoing our mandatory 6-step testing & burn-in phase. Progress: ${portalUrl}`;
      } else if (whatsappStatus === 'READY_FOR_DISPATCH') {
        message += `Your laser source has successfully passed all burn-in tests! It is ready for dispatch pending payment clearance. portal: ${portalUrl}`;
      } else if (whatsappStatus === 'DISPATCHED') {
        message += `🚀 Your repaired laser source has been dispatched! Track courier shipment details here: ${portalUrl}`;
      } else {
        message += `Job is updated. Track live status: ${portalUrl}`;
      }

      // Direct redirect via WhatsApp Web API link
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      toast.success('WhatsApp Redirected', `Opened WhatsApp Web with prefilled message to ${job.customer.companyName}.`);
      setShowWhatsappModal(false);
    } catch (err: any) {
      toast.error('Failed to Send', err.response?.data?.message || 'Unable to dispatch WhatsApp update.');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleWhatsAppQuotation = async () => {
    if (!job) return;
    try {
      await api.post(`/jobs/${job.id}/whatsapp`, { status: 'QUOTATION_GENERATED' });
      let cleanPhone = job.customer.mobileNumber.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      }
      const portalUrl = portalTrackUrl(job.trackId);
      const message = `Hello ${job.customer.customerName}, your fiber laser source repair job (${job.trackId}) status is now: QUOTATION GENERATED. A quotation has been generated. Please review and approve it on the customer portal: ${portalUrl}`;
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      toast.success('WhatsApp Redirected', `Opened WhatsApp Web with prefilled message to ${job.customer.companyName}.`);
    } catch (err: any) {
      toast.error('Failed to Send', err.response?.data?.message || 'Unable to dispatch WhatsApp update.');
    }
  };

  const handleUndoApproval = async () => {
    if (!job || !job.quotations || job.quotations.length === 0) return;
    const q = job.quotations[0];
    if (!window.confirm('Are you sure you want to undo the approval/rejection decision and move this job back to Awaiting Approval?')) {
      return;
    }
    try {
      await api.post(`/quotation/${q.id}/undo`);
      toast.success('Decision Undone', 'Job moved back to Quotation Awaiting Approval.');
      fetchJobDetails();
    } catch (err: any) {
      toast.error('Action Failed', err.response?.data?.message || 'Unable to undo decision.');
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    if (!window.confirm(`Are you sure you want to permanently delete repair job ticket ${job.trackId}? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await api.delete(`/jobs/${job.id}`);
      toast.success('Ticket Deleted', res.data.message || 'Job ticket removed successfully.');
      navigate('/jobs');
    } catch (err: any) {
      toast.error('Deletion Failed', err.response?.data?.message || 'Unable to delete job ticket.');
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    try {
      await api.patch(`/jobs/${job.id}/priority`, { priority: newPriority });
      toast.success('Priority Updated', `Job priority changed to ${newPriority}.`);
      fetchJobDetails();
    } catch (err: any) {
      toast.error('Failed to Update', err.response?.data?.message || 'Unable to update priority.');
    }
  };

  const handleRepairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/repair/step', {
        jobId: job.id,
        repairNotes,
        repairDuration: parseInt(repairDuration),
        partsUsed: repairPartsUsed
          .filter(p => p.sparePartId)
          .map(p => ({ sparePartId: p.sparePartId, quantityUsed: parseInt(p.quantityUsed) }))
      });
      alert('Repair step logged.');
      fetchJobDetails();
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.status === 'WAITING_SPARE_PARTS') {
        alert(err.response.data.message);
        fetchJobDetails();
      } else {
        alert(err.response?.data?.message || 'Failed to log repair details');
      }
    }
  };

  const handleCompleteRepair = async () => {
    try {
      await api.post('/repair/complete', { jobId: job.id });
      alert('Repair stage completed successfully. QC Testing unlocked!');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete repair');
    }
  };

  const handleTestingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/testing', {
        jobId: job.id,
        ...testingForm
      });
      alert(testingForm.result === 'PASS' ? 'QC Verification PASSED! Invoice unlocked.' : 'QC FAILED! Job moved back to Under Repair.');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Validation failed');
    }
  };
  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/qc-assessment/verification', {
        jobId: job.id,
        runningCondition: qcForm.runningCondition,
        verifiedBy: qcForm.verifiedBy,
        approvedBy: qcForm.approvedBy,
        remark: qcForm.remark
      });
      toast.success('Verification Submitted', res.data.message);
      fetchJobDetails();
    } catch (err: any) {
      toast.error('Submission Failed', err.response?.data?.message || 'Verification submission failed.');
    }
  };


  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/report', {
        jobId: job.id,
        ...reportForm
      });
      alert('Service Report generated successfully.');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Report compilation failed');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payment', {
        jobId: job.id,
        invoiceNumber: paymentForm.invoiceNumber || `INV-${Date.now().toString().substring(6)}`,
        invoiceAmount: parseFloat(paymentForm.invoiceAmount),
        paidAmount: parseFloat(paymentForm.paidAmount),
        overrideReason: paymentForm.overrideReason
      });
      alert('Invoice payment updated.');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Payment capture failed');
    }
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/dispatch', {
        jobId: job.id,
        courierName: dispatchForm.courierName,
        awbNumber: dispatchForm.awbNumber
      });
      alert('Laser source marked as DISPATCHED.');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Dispatch logging failed');
    }
  };

  const handleCloseJob = async () => {
    try {
      await api.post('/dispatch/close', { jobId: job.id });
      alert('Job successfully closed.');
      fetchJobDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Close failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-5 rounded-3xl border border-slate-150 shadow-sm gap-4">
        
        {/* Left Section: Info and Status Badges */}
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Active Repair Job</span>
            <h1 className="text-2xl font-black text-slate-900 leading-none">{job.trackId}</h1>
          </div>
          
          {/* Priority Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Priority:</span>
            {user?.role === 'ADMIN' ? (
              <select
                value={job.priority || 'NORMAL'}
                onChange={e => handleUpdatePriority(e.target.value)}
                className={`text-xs font-extrabold bg-transparent border-none p-0 focus:outline-none cursor-pointer uppercase ${
                  job.priority === 'URGENT' ? 'text-rose-600' : job.priority === 'HIGH' ? 'text-amber-600' : 'text-slate-600'
                }`}
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            ) : (
              <span className={`text-xs font-extrabold uppercase ${
                job.priority === 'URGENT' ? 'text-rose-600' : job.priority === 'HIGH' ? 'text-amber-600' : 'text-slate-600'
              }`}>
                {job.priority || 'NORMAL'}
              </span>
            )}
          </div>

          {/* Engineer Assignment */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Engineer:</span>
            {user?.role === 'ADMIN' || user?.role === 'SUPPORT' || user?.role === 'ENGINEER' ? (
              <select
                value={job.currentEngineerId || ''}
                onChange={e => handleAssignEngineer(e.target.value)}
                disabled={assigningEngineer}
                className="text-xs font-extrabold bg-transparent border-none p-0 focus:outline-none cursor-pointer uppercase text-blue-600"
              >
                <option value="">Unassigned</option>
                {engineers.map((eng: any) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-extrabold uppercase text-slate-600">
                {job.currentEngineer?.name || 'Unassigned'}
              </span>
            )}
          </div>
        </div>

        {/* Right Section: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            onClick={() => {
              const latestInsp = job?.inspections?.[0] || {};
              const latestRepair = job?.repairs?.[0] || {};
              const latestTest = job?.testResults?.[0] || {};
              
              setQcForm((prev: any) => {
                const updated = {
                  ...prev,
                  condition: latestInsp.physicalCondition || prev.condition || '',
                  othersObservation: latestInsp.internalFindings || prev.othersObservation || '',
                  emergencySwitch: latestInsp.faultAnalysis ? (latestInsp.faultAnalysis.toUpperCase().includes('NOT') ? 'NOT_OK' : 'OK') : prev.emergencySwitch || '',
                  problemAnalysis: latestInsp.inspectionNotes || prev.problemAnalysis || '',
                  
                  // Pre-fill repair details if available
                  repairActionTaken: latestRepair.id ? 'YES' : prev.repairActionTaken || '',
                  partsReplaced: (latestRepair.partsUsed && latestRepair.partsUsed.length > 0) ? 'YES' : prev.partsReplaced || '',
                  trailRunningDuration: latestRepair.durationMinutes ? `${latestRepair.durationMinutes} Minutes` : prev.trailRunningDuration || '',
                  
                  // Pre-fill testing details if available
                  postRepairTesting: latestTest.result || prev.postRepairTesting || '',
                  runningCondition: latestTest.result === 'PASS' ? 'OK' : (latestTest.result === 'FAIL' ? 'NOT_OK' : prev.runningCondition || ''),
                  remark: latestTest.testNotes || latestRepair.notes || prev.remark || ''
                };
                return updated;
              });
              setShowQcModal(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer"
          >
            <FileText className="h-4 w-4 text-slate-400" />
            QC Assessment
          </button>

          <button
            onClick={() => {
              setWhatsappStatus(job?.status || 'RECEIVED');
              setShowWhatsappModal(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-emerald-100 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50 rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer"
          >
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            Send WhatsApp Update
          </button>

          {user?.role === 'ADMIN' && (
            <button
              onClick={handleDeleteJob}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-rose-100 text-rose-700 bg-rose-50/30 hover:bg-rose-50 rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-rose-500" />
              Delete Ticket
            </button>
          )}

          {qcAssessment?.pdfUrl && (
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem('accessToken');
                  const response = await fetch(fileUrl(qcAssessment.pdfUrl), {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                  });
                  if (!response.ok) throw new Error('Download failed');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `QC_Assessment_${job.trackId}.pdf`);
                  document.body.appendChild(link);
                  link.click();
                  link.parentNode?.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (e) {
                  alert('Failed to download QC PDF');
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-sm text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Download QC PDF
            </button>
          )}
        </div>
      </div>

      {/* --- PIPELINE VISUAL TIMELINE BAR --- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <div className="flex justify-between items-center min-w-[900px] relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
          {STATUS_ORDER.map((st, index) => {
            let activeStatus = job.status;
            if (activeStatus === 'REPAIR_INITIATED') activeStatus = 'UNDER_REPAIR';
            if (activeStatus === 'REPAIR_COMPLETED') activeStatus = 'TESTING_BURN_IN';
            
            const activeIndex = STATUS_ORDER.indexOf(activeStatus);
            const isCompleted = activeIndex >= index;
            const isActualActive = activeStatus === st;
            const isSelected = selectedStage === st;

            // Engineers cannot view future stages beyond active index
            const isBypassRole = ['ADMIN', 'COORDINATOR', 'SUPPORT', 'ACCOUNTS'].includes(user?.role || '');
            const isLocked = !isCompleted && !isBypassRole;

            const handleStageClick = () => {
              if (isLocked) {
                toast.error('Stage Locked', 'This stage is locked. Work must progress sequentially.');
                return;
              }
              if (!isCompleted && !isActualActive && isBypassRole) {
                // Trigger Bypass Flow
                setBypassTarget(st);
                setShowBypassModal(true);
                return;
              }
              setSelectedStage(st);
            };

            return (
              <button
                key={st}
                onClick={handleStageClick}
                className={`flex flex-col items-center relative z-10 focus:outline-none transition-transform hover:scale-105 ${
                  isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white ring-4 ring-blue-200 scale-110 shadow-md'
                    : isActualActive
                      ? 'bg-blue-500 text-white ring-2 ring-blue-100'
                      : isCompleted 
                        ? 'bg-emerald-500 text-white' 
                        : isBypassRole 
                          ? 'bg-amber-150 text-amber-700 border-2 border-dashed border-amber-300' 
                          : 'bg-slate-200 text-slate-500'
                }`}>
                  {isLocked ? '🔒' : index + 1}
                </div>
                <span className={`text-[9px] font-bold mt-2 uppercase tracking-wide text-center w-16 ${
                  isSelected ? 'text-blue-600 font-extrabold' : isActualActive ? 'text-blue-500' : 'text-slate-400'
                }`}>
                  {st === 'RECEIVED' 
                    ? 'INSPECTION' 
                    : st === 'INITIAL_DIAGNOSIS'
                      ? 'REQUIRED SPARES'
                      : st === 'QUOTATION_GENERATED' 
                        ? 'QUOTATION & CUSTOMER APPROVAL' 
                        : st === 'UNDER_REPAIR'
                          ? 'REPAIRING'
                          : st === 'TESTING_BURN_IN'
                            ? 'QC TESTING'
                            : st === 'READY_FOR_DISPATCH'
                              ? 'FINAL VERIFICATION & PAYMENT CONFIRMATION'
                              : st === 'PAYMENT_COMPLETED'
                                ? 'DISPATCHING TO CUSTOMER'
                                : st === 'DISPATCHED'
                                  ? 'FINAL CONFIRMATION'
                                  : st === 'CLOSED'
                                    ? 'SUCCESSFULLY REPAIRED'
                                    : st.replace('_', ' ')}
                </span>
                {!isCompleted && isBypassRole && (
                  <span className="absolute -top-3 text-[7px] font-bold text-amber-600 bg-amber-50 px-1 border border-amber-200 rounded">BYPASS</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- WORKSPACE LAYOUT (2 Columns) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Laser specifications & Client dossier */}
        <div className="space-y-6">
          
          {/* Client Dossier */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 
              onClick={() => togglePanel('dossier')} 
              className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center justify-between cursor-pointer hover:text-slate-600 transition-colors select-none"
            >
              <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-slate-400" /> Client Dossier</span>
              {collapsedPanels.dossier ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </h3>
            {!collapsedPanels.dossier && (
              <div className="text-xs space-y-2 text-slate-600 font-medium animate-fade-in">
                <p className="text-sm font-bold text-slate-900">{job.customer.companyName}</p>
                <p>Contact: {job.customer.customerName}</p>
                <p>Mobile: {job.customer.mobileNumber}</p>
                <p>Email: {job.customer.email}</p>
                <p>GST No: {job.customer.gstNumber || 'N/A'}</p>
                <p>Address: {job.customer.address}</p>
              </div>
            )}
          </div>

          {/* Laser Source Technical Specs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 
              onClick={() => togglePanel('specs')} 
              className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center justify-between cursor-pointer hover:text-slate-600 transition-colors select-none"
            >
              <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-slate-400" /> Laser Source Specifications</span>
              {collapsedPanels.specs ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </h3>
            {!collapsedPanels.specs && (
              <div className="text-xs space-y-2 text-slate-600 font-medium animate-fade-in">
                <p className="text-sm font-bold text-slate-900">{job.laserSource.brand} ({job.laserSource.powerRating})</p>
                <p>Model Number: {job.laserSource.modelNumber}</p>
                <p className="bg-blue-50 text-blue-800 p-1.5 rounded font-mono font-bold text-[10px]">
                  Serial No: {job.laserSource.serialNumber}
                </p>
                <p>Source Type: {job.laserSource.sourceType}</p>
                <p>Mfg Year: {job.laserSource.mfgYear}</p>
                <p>Machine Manufacturer: {job.laserSource.machineManufacturer || 'N/A'}</p>
              </div>
            )}
          </div>

          {/* Documents & Photos */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 
              onClick={() => togglePanel('documents')} 
              className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center justify-between cursor-pointer hover:text-slate-600 transition-colors select-none"
            >
              <span className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-slate-400" /> Documents & Photos</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{(job.files || []).length}</span>
                {collapsedPanels.documents ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </div>
            </h3>
            
            {!collapsedPanels.documents && (
              <div className="animate-fade-in space-y-3">
                {(!job.files || job.files.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No attachments uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                    {job.files.map((file: any) => {
                      const isImg = file.fileType === 'IMAGE';
                      return (
                        <div key={file.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            {isImg ? (
                              <img src={fileUrl(file.fileUrl)} className="h-8 w-8 object-cover rounded-lg border border-slate-200 shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 border border-blue-100">PDF</div>
                            )}
                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]" title={file.originalName}>
                              {file.originalName}
                            </span>
                          </div>
                          <a
                            href={fileUrl(file.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors shrink-0"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Serial Intelligence history */}
          {serialHistory && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 
                onClick={() => togglePanel('history')} 
                className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center justify-between cursor-pointer hover:text-slate-600 transition-colors select-none"
              >
                <span className="flex items-center gap-1.5"><History className="h-4 w-4 text-slate-400" /> Lifetime Service History</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[10px]">{serialHistory.repairCount}</span>
                  {collapsedPanels.history ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </div>
              </h3>
              {!collapsedPanels.history && (
                <div className="text-xs space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Total Repair Visits:</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">{serialHistory.repairCount}</span>
                  </div>
                  {serialHistory.history && serialHistory.history.some((h: any) => h.id !== job.id) && (
                    <div className="space-y-2 pt-2 border-t border-slate-50">
                      <p className="text-[10px] text-slate-400 font-semibold">Previous Failures & Reports:</p>
                      {serialHistory.history.filter((h: any) => h.id !== job.id).map((prevJob: any, i: number) => (
                        <div key={prevJob.id} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-[10px] text-slate-800">{prevJob.trackId}</span>
                            <span className="text-[9px] text-slate-400 font-semibold">
                              {new Date(prevJob.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium italic">&quot;{prevJob.complaintDescription || 'No description'}&quot;</p>
                          {/* Display spare parts used in previous jobs if available */}
                          {prevJob.repairs && prevJob.repairs.some((r: any) => r.partsUsed && r.partsUsed.length > 0) && (
                            <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200">
                              <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Spares Replaced:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {prevJob.repairs.flatMap((r: any) => r.partsUsed).map((pu: any, idx: number) => (
                                  <span key={idx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[8px] font-bold">
                                    {pu.sparePart?.partName || 'Spare Part'} (x{pu.quantity})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Live Customer Chat & Collaboration */}
          <div className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col ${collapsedPanels.chat ? 'h-auto space-y-0' : 'h-[400px] space-y-3'}`}>
            <h3 
              onClick={() => togglePanel('chat')} 
              className="font-extrabold text-slate-900 text-xs uppercase tracking-widest pb-2 flex items-center justify-between cursor-pointer select-none"
            >
              <span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-slate-400" /> Customer Support Chat</span>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {collapsedPanels.chat ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </div>
            </h3>
            
            {!collapsedPanels.chat && (
              <>
                {/* Chat messages list */}
                <div className="flex-1 overflow-y-auto py-3 space-y-2.5 text-xs text-left scrollbar-thin">
                  {(!job.comments || job.comments.length === 0) ? (
                    <div className="h-full flex items-center justify-center text-slate-400 italic">
                      No messages yet. Send a message to initiate support chat.
                    </div>
                  ) : (
                    job.comments.map((c: any) => {
                      const isMe = c.sender === 'STAFF';
                      return (
                        <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-2xl max-w-[85%] font-medium ${
                            isMe 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                          }`}>
                            <p>{c.message}</p>
                          </div>
                          <span className="text-[9px] text-slate-400 mt-1 px-1">
                            {c.senderName} ({c.sender === 'STAFF' ? 'Staff' : 'Client'}) · {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat input form */}
                <div className="border-t border-slate-100 pt-3 flex gap-2 items-center">
                  <label className="flex items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 cursor-pointer transition-all shadow-sm shrink-0">
                    <input type="file" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        const res = await api.post(`/jobs/${job.id}/upload`, fd, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        setJob((prev: any) => ({
                          ...prev,
                          files: [...(prev.files || []), res.data]
                        }));
                        toast.success('Upload Success', 'Document attached to ticket.');
                      } catch (err) {
                        toast.error('Upload Failed', 'Failed to upload document.');
                      }
                    }} className="hidden" accept=".pdf,image/*" />
                    <Upload className="h-4.5 w-4.5" />
                  </label>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('staffMsg') as HTMLInputElement;
                    const text = input.value;
                    if (!text.trim()) return;
                    input.value = ''; // Clear immediately before async call
                    try {
                      const res = await api.post(`/jobs/${job.id}/comments`, { message: text });
                      setJob((prev: any) => ({
                        ...prev,
                        comments: [...(prev.comments || []), res.data]
                      }));
                    } catch (err) {
                      input.value = text; // Restore on failure
                      console.error(err);
                    }
                  }} className="flex-1 flex gap-2">
                    <input
                      name="staffMsg"
                      type="text"
                      placeholder="Type message to client..."
                      className="flex-1 border border-slate-200 rounded-xl px-3 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Right column: Main active stage Workspace Action Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header Tabs */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-extrabold text-sm tracking-wide uppercase">Active Stage Execution Panel</h3>
              <span className="badge-status bg-white/20 text-white font-bold">
                {selectedStage === 'READY_FOR_DISPATCH' 
                  ? 'FINAL VERIFICATION & PAYMENT CONFIRMATION' 
                  : selectedStage === 'PAYMENT_COMPLETED'
                    ? 'DISPATCHING TO CUSTOMER'
                    : selectedStage === 'DISPATCHED'
                      ? 'FINAL CONFIRMATION'
                      : selectedStage === 'RECEIVED'
                        ? 'INSPECTION'
                        : selectedStage === 'INITIAL_DIAGNOSIS'
                          ? 'REQUIRED SPARES'
                          : selectedStage === 'UNDER_REPAIR'
                            ? 'REPAIRING'
                          : selectedStage === 'TESTING_BURN_IN'
                            ? 'QC TESTING'
                            : selectedStage === 'CLOSED'
                              ? 'SUCCESSFULLY REPAIRED'
                              : selectedStage?.replace('_', ' ')}
              </span>
            </div>

            <div className="p-6">
              {/* Draft Restoration Notice Banner */}
              {localStorage.getItem(`qc_draft_${id}`) && (
                <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200/50 rounded-xl text-xs flex justify-between items-center text-blue-700 animate-fade-in font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-ping"></span>
                    💡 Unsaved local assessment changes detected for this ticket.
                  </span>
                  <button 
                    onClick={handleRestoreLocalDraft}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Restore Draft
                  </button>
                </div>
              )}

              {user?.role === 'SUPPORT' && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-semibold text-amber-700">
                  ⚠️ View-only Mode: Repair Coordinators do not have permission to log operations.
                </div>
              )}
              <fieldset disabled={user?.role === 'SUPPORT'} className="space-y-6">
              {/* --- 1. INSPECTION & DIAGNOSIS ACTIONS --- */}
              {(selectedStage === 'RECEIVED' || selectedStage === 'VISUAL_INSPECTION') && (
                <form onSubmit={handleInspectionSubmit} className="space-y-4 text-left">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm mb-1">Log Engineering Physical Inspection</h4>
                    <p className="text-xs text-slate-400">Fill in diagnostics details to complete inspection. Minimum 1 photo required.</p>
                  </div>
                  
                  {/* PRE-REPAIR INSPECTION SECTION */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">PRE-REPAIR INSPECTION</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">EQUIPMENT/SOURCE CONDITION</label>
                        <div className="flex gap-4">
                          {['GOOD', 'FAIR', 'POOR'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input type="radio" name="condition" value={opt} checked={qcForm.condition === opt} onChange={e => {
                                setQcForm({...qcForm, condition: e.target.value});
                                setInspectionForm(prev => ({...prev, physicalCondition: `Condition: ${e.target.value}`}));
                              }} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PREVIOUS REPAIR DETAILS</label>
                        <div className="flex gap-4">
                          {['AVAILABLE', 'NA'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input type="radio" name="previousRepair" value={opt} checked={qcForm.previousRepair === opt} onChange={e => setQcForm({...qcForm, previousRepair: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">WARRANTY STATUS</label>
                        <div className="flex gap-4">
                          {[['UNDER_WARRANTY', 'UNDER WARRANTY'], ['NO_WARRANTY', 'NO WARRANTY']].map(([val, label]) => (
                            <label key={val} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input type="radio" name="warranty" value={val} checked={qcForm.warranty === val} onChange={e => setQcForm({...qcForm, warranty: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">CLIENT TYPE</label>
                        <div className="flex gap-4 flex-wrap">
                          {['CUSTOMER', 'DEALER', 'STANDBY', 'FREELANCER'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input type="radio" name="customerType" value={opt} checked={qcForm.customerType === opt} onChange={e => setQcForm({...qcForm, customerType: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* INITIAL OBSERVATION BY REPAIR ENGINEERS SECTION */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">INITIAL OBSERVATION BY REPAIR ENGINEERS</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'sourcePackage', label: 'SOURCE PACKAGE CONDITION', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'qbhCondition', label: 'QBH CONDITION', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'externalDamage', label: 'EXTERNAL DAMAGE', opt1: 'YES', opt2: 'NO' },
                        { key: 'internalDamage', label: 'INTERNAL DAMAGE', opt1: 'YES', opt2: 'NO' },
                        { key: 'powerCable', label: 'POWER CABLE', opt1: 'YES', opt2: 'NO' },
                        { key: 'interfaceCable', label: 'INTERFACE CABLE', opt1: 'YES', opt2: 'NO' },
                        { key: 'sourceKey', label: 'SOURCE KEY', opt1: 'YES', opt2: 'NO' }
                      ].map(obs => (
                        <div key={obs.key} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200/60 text-xs">
                          <span className="font-bold text-slate-600">{obs.label}</span>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={`insp_${obs.key}`} value={obs.opt1} checked={qcForm[obs.key] === obs.opt1 || (obs.opt1 === 'NOT OK' && qcForm[obs.key] === 'NOT_OK')} onChange={e => {
                                const val = e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value;
                                setQcForm(prev => ({...prev, [obs.key]: val}));
                                setInspectionForm(prev => ({...prev, internalFindings: `Checked Obs: ${obs.label} is ${val}`}));
                              }} className="text-blue-600 focus:ring-blue-500" />
                              {obs.opt1}
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={`insp_${obs.key}`} value={obs.opt2} checked={qcForm[obs.key] === obs.opt2 || (obs.opt2 === 'NOT OK' && qcForm[obs.key] === 'NOT_OK')} onChange={e => {
                                const val = e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value;
                                setQcForm(prev => ({...prev, [obs.key]: val}));
                                setInspectionForm(prev => ({...prev, internalFindings: `Checked Obs: ${obs.label} is ${val}`}));
                              }} className="text-blue-600 focus:ring-blue-500" />
                              {obs.opt2}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">OTHERS OBSERVATION</label>
                      <input type="text" value={qcForm.othersObservation} onChange={e => {
                        setQcForm({...qcForm, othersObservation: e.target.value});
                        setInspectionForm(prev => ({...prev, internalFindings: e.target.value}));
                      }} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white" placeholder="Any additional visual damage findings..." />
                    </div>
                  </div>

                  {/* FUNCTIONAL TEST POINT SECTION */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">FUNCTIONAL TEST POINT</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'emergencySwitch', label: 'EMERGENCY SWITCH', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'sourceStartKey', label: 'SOURCE START KEY', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'laserButtonOnKey', label: 'LASER BUTTON ON KEY', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'mainMcb', label: 'MAIN MCB', opt1: 'OK', opt2: 'NOT OK' }
                      ].map(test => (
                        <div key={test.key} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200/60 text-xs">
                          <span className="font-bold text-slate-600">{test.label}</span>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={`insp_${test.key}`} value={test.opt1} checked={qcForm[test.key] === test.opt1 || (test.opt1 === 'NOT OK' && qcForm[test.key] === 'NOT_OK')} onChange={e => {
                                const val = e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value;
                                setQcForm(prev => ({...prev, [test.key]: val}));
                                setInspectionForm(prev => ({...prev, faultAnalysis: `Test: ${test.label} is ${val}`}));
                              }} className="text-blue-600 focus:ring-blue-500" />
                              {test.opt1}
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={`insp_${test.key}`} value={test.opt2} checked={qcForm[test.key] === test.opt2 || (test.opt2 === 'NOT OK' && qcForm[test.key] === 'NOT_OK')} onChange={e => {
                                const val = e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value;
                                setQcForm(prev => ({...prev, [test.key]: val}));
                                setInspectionForm(prev => ({...prev, faultAnalysis: `Test: ${test.label} is ${val}`}));
                              }} className="text-blue-600 focus:ring-blue-500" />
                              {test.opt2}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PROBLEM IDENTIFIED IN</label>
                        <div className="flex gap-4 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input type="radio" name="insp_problemIn" value="OPTICAL_SECTION" checked={qcForm.problemIn === 'OPTICAL_SECTION'} onChange={e => setQcForm({...qcForm, problemIn: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                            OPTICAL
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input type="radio" name="insp_problemIn" value="ELECTRICAL_SECTION" checked={qcForm.problemIn === 'ELECTRICAL_SECTION'} onChange={e => setQcForm({...qcForm, problemIn: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                            ELECTRICAL
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Initial Diagnosis *</label>
                        <input
                          type="text" required
                          value={inspectionForm.initialDiagnosis}
                          onChange={e => setInspectionForm({...inspectionForm, initialDiagnosis: e.target.value})}
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 bg-white"
                          placeholder="Replace QBH collimator assembly"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Inspection Notes *</label>
                    <textarea
                      rows={3} required
                      value={inspectionForm.inspectionNotes}
                      onChange={e => setInspectionForm({...inspectionForm, inspectionNotes: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                      placeholder="Enter detailed diagnostics log..."
                    ></textarea>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Upload Inspection Photos *</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="file" multiple required={!inspectionPhotos || inspectionPhotos.length === 0}
                        accept="image/*"
                        onChange={e => setInspectionPhotos(e.target.files)}
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-slate-50 cursor-pointer"
                      />
                      <label className="flex items-center justify-center gap-1.5 px-4 py-2 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm shrink-0">
                        <Camera className="h-4 w-4" />
                        Take Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={e => {
                            if (e.target.files) {
                              setInspectionPhotos(e.target.files);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md"
                  >
                    Complete Inspection & Log Initial Diagnostics
                  </button>
                </form>
              )}

              {/* --- 2. QUOTATION GENERATION --- */}
              {selectedStage === 'INITIAL_DIAGNOSIS' && (
                <div className="space-y-6 text-left">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm mb-1">Generate Service Quotation Estimate</h4>
                    <p className="text-xs text-slate-400">Add parts, labor costs, and consumables. Calculations will auto-sum.</p>
                  </div>

                  <div className="space-y-3">
                    {quoteItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-2 relative suggestion-container">
                          <input
                            type="text"
                            value={item.name}
                            placeholder="Item Name"
                            onChange={e => handleItemNameChange(idx, e.target.value)}
                            onFocus={() => {
                              if (item.name) {
                                handleItemNameChange(idx, item.name);
                              }
                            }}
                            className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                          />
                          {activeSuggestionIdx === idx && suggestionList.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                              {suggestionList.map((s, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => handleSelectSuggestion(idx, s)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex flex-col gap-0.5 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 truncate">{s.name}</span>
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                      s.source === 'local' 
                                        ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    }`}>
                                      {s.source === 'local' ? 'Local' : 'Zoho'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                                    <span>Part #: {s.sku || 'N/A'} {s.manufacturer ? `· Make: ${s.manufacturer}` : ''}</span>
                                    <span className="font-bold text-slate-700">₹{s.rate}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <select
                          value={item.category}
                          onChange={e => {
                            const newItems = [...quoteItems];
                            newItems[idx].category = e.target.value;
                            setQuoteItems(newItems);
                          }}
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="SPARE_PART">Spare Part</option>
                          <option value="PUMP_DIODE">Pump Diode</option>
                          <option value="LASER_MODULE">Laser Module</option>
                          <option value="PCB_BOARD">PCB Board</option>
                          <option value="CONSUMABLE">Consumables</option>
                          <option value="LABOUR">Labour</option>
                        </select>
                        <input
                          type="number"
                          value={item.quantity}
                          placeholder="Qty"
                          onChange={e => {
                            const newItems = [...quoteItems];
                            newItems[idx].quantity = e.target.value;
                            setQuoteItems(newItems);
                          }}
                          className="w-16 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="number"
                          value={item.unitCost}
                          placeholder="Cost"
                          onChange={e => {
                            const newItems = [...quoteItems];
                            newItems[idx].unitCost = e.target.value;
                            setQuoteItems(newItems);
                          }}
                          className="w-24 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setQuoteItems(quoteItems.filter((_, i) => i !== idx));
                          }}
                          className="text-red-500 hover:text-red-700 font-bold px-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => setQuoteItems([...quoteItems, { name: '', category: 'SPARE_PART', quantity: 1, unitCost: 0, partNumber: '', hsnSac: '', manufacturer: '' }])}
                      className="text-blue-600 font-bold text-xs hover:underline cursor-pointer"
                    >
                      + Add Estimate Item Line
                    </button>
                  </div>

                  <button
                    onClick={handleQuotationSubmit}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md"
                  >
                    Compile Quote & Request Customer Approval
                  </button>
                </div>
              )}

              {/* --- 3. QUOTATION AWAITING APPROVAL --- */}
              {selectedStage === 'QUOTATION_GENERATED' && (
                <div className="space-y-6 text-left animate-fade-in">
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-start gap-3">
                    <FileText className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-purple-950 text-sm">Quotation Estimate Generated</h4>
                      <p className="text-xs text-purple-800 mt-1">A quotation has been compiled. You can preview/download the invoice or simulate the customer approval logic below.</p>
                      
                      {job.quotations && job.quotations.length > 0 && (
                        <div className="mt-3 flex items-center gap-4">
                          <button
                            onClick={async () => {
                              const q = job.quotations[0];
                              try {
                                const res = await api.get(`/quotation/${q.id}/pdf`);
                                const token = localStorage.getItem('accessToken');
                                const pdfResponse = await fetch(fileUrl(res.data.pdfUrl), {
                                  headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                                });
                                if (!pdfResponse.ok) throw new Error('Download failed');
                                const blob = await pdfResponse.blob();
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', `Quotation_${job.trackId}.pdf`);
                                document.body.appendChild(link);
                                link.click();
                                link.parentNode?.removeChild(link);
                                window.URL.revokeObjectURL(url);
                              } catch (e) {
                                alert('Failed to download Quote PDF');
                              }
                            }}
                            className="bg-white border border-purple-200 text-purple-700 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download Quote PDF
                          </button>
                          <span className="text-xs font-bold text-purple-950">Grand Total: ₹{job.quotations[0].grandTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-700">Simulate Customer Decision Response:</p>
                    
                    {job.quotations && job.quotations.length > 0 && (job.quotations[0].status === 'APPROVED' || job.quotations[0].status === 'REJECTED') ? (
                      <div className="space-y-3 text-left">
                        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
                          job.quotations[0].status === 'APPROVED' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          <span>
                            Quotation {job.quotations[0].status === 'APPROVED' ? 'Approved' : 'Rejected'} by{' '}
                            <strong className="uppercase">
                              {job.quotations[0].approvedBy === 'ADMIN' ? 'Admin' : 
                               job.quotations[0].approvedBy === 'COORDINATOR' ? 'Coordinator' : 'Customer'}
                            </strong>
                            {job.quotations[0].rejectionReason && ` (Reason: "${job.quotations[0].rejectionReason}")`}
                          </span>
                          
                          {(user?.role === 'ADMIN' || user?.role === 'SUPPORT') && (
                            <button
                              onClick={handleUndoApproval}
                              className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors shadow-sm"
                            >
                              Undo Decision
                            </button>
                          )}
                        </div>
                      </div>
                    ) : user?.role === 'ENGINEER' ? (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-semibold text-center">
                        ⚠️ Please contact the Repair Coordinator or Admin/Manager to Approve/Reject this quotation.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleApproval(true)}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve (Unlock Repairs)
                          </button>
                          <button
                            onClick={() => {
                              const r = window.prompt('Enter rejection reason:');
                              if (r) handleApproval(false, r);
                            }}
                            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject Quote (Move to On-Hold)
                          </button>
                        </div>

                        {/* Contact & WhatsApp options for admin / coordinator */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <a
                            href={`tel:${job.customer.mobileNumber}`}
                            className="flex-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-center"
                          >
                            <Phone className="h-4 w-4" />
                            Call Customer ({job.customer.mobileNumber})
                          </a>
                          <button
                            type="button"
                            onClick={handleWhatsAppQuotation}
                            className="flex-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <MessageSquare className="h-4 w-4" />
                            WhatsApp Customer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- 4. REPAIR INITIATED / UNDER REPAIR / WAITING PARTS --- */}
              {(selectedStage === 'REPAIR_INITIATED' || selectedStage === 'UNDER_REPAIR' || selectedStage === 'WAITING_SPARE_PARTS') && (
                <div className="space-y-6 text-left">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm mb-1">In-Progress Repair Logs</h4>
                    <p className="text-xs text-slate-400">Record modules repaired and spare parts consumed. Low stock parts automatically toggle &quot;WAITING SPARE PARTS&quot; status.</p>
                  </div>

                  <form onSubmit={handleRepairSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Repair Step Actions & Notes</label>
                      <textarea
                        rows={2} required
                        value={repairNotes}
                        onChange={e => setRepairNotes(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                        placeholder="Replaced burned water sensor, re-aligned fiber collimator lenses..."
                      ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Repair Duration (Minutes)</label>
                        <input
                          type="number" required
                          value={repairDuration}
                          onChange={e => setRepairDuration(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Spare parts used selector */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Spare Parts Consumed</p>
                      {repairPartsUsed.map((p, idx) => (
                        <div key={idx} className="flex gap-3 items-center">
                          <select
                            value={p.sparePartId}
                            onChange={e => {
                              const newParts = [...repairPartsUsed];
                              newParts[idx].sparePartId = e.target.value;
                              setRepairPartsUsed(newParts);
                            }}
                            className="flex-2 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 bg-white"
                          >
                            <option value="">-- Choose Spare Part --</option>
                            {spareParts.map((sp) => (
                              <option key={sp.id} value={sp.id}>{sp.partName} (Stock: {sp.quantity})</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={p.quantityUsed}
                            onChange={e => {
                              const newParts = [...repairPartsUsed];
                              newParts[idx].quantityUsed = e.target.value;
                              setRepairPartsUsed(newParts);
                            }}
                            className="w-20 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                            placeholder="Qty"
                          />
                          <button
                            type="button"
                            onClick={() => setRepairPartsUsed(repairPartsUsed.filter((_, i) => i !== idx))}
                            className="text-red-500 font-bold hover:text-red-700"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setRepairPartsUsed([...repairPartsUsed, { sparePartId: '', quantityUsed: 1 }])}
                        className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        + Add Spare Part Line
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md"
                    >
                      Log Repair Step & Save Parts Used
                    </button>
                  </form>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Done repairing all elements?</p>
                      <p className="text-[10px] text-slate-400">Lock the repair logs and unlock testing.</p>
                    </div>
                    <button
                      onClick={handleCompleteRepair}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer shadow-md"
                    >
                      Submit & Lock Repair
                    </button>
                  </div>
                </div>
              )}

              {/* --- 5. QC TESTING AND BURN-IN --- */}
              {(selectedStage === 'REPAIR_COMPLETED' || selectedStage === 'TESTING_BURN_IN') && (
                <form onSubmit={handleTestingSubmit} className="space-y-4 text-left">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm mb-1">Log Mandatory Validation Tests</h4>
                    <p className="text-xs text-slate-400">Enforce the 6 required tests below. Output PASS to unlock dispatch, or FAIL to return to Repair.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                  </div>
                  {/* FAILURE TYPE CLASSIFICATION SECTION */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">FAILURE TYPE CLASSIFICATION</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PROBLEM ANALYSIS</label>
                        <textarea value={qcForm.problemAnalysis} onChange={e => {
                          setQcForm({...qcForm, problemAnalysis: e.target.value});
                          setTestingForm(prev => ({...prev, testNotes: e.target.value}));
                        }} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white h-14 resize-none" placeholder="Failure diagnosis..."></textarea>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ROOT CAUSE ANALYSIS</label>
                        <textarea value={qcForm.rootCauseAnalysis} onChange={e => setQcForm({...qcForm, rootCauseAnalysis: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white h-14 resize-none" placeholder="Root cause..."></textarea>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">FAILURE CLASSIFICATION</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'failHuman', label: 'HUMAN ERROR' },
                          { key: 'failMechanical', label: 'MECHANICAL ERROR' },
                          { key: 'failElectrical', label: 'ELECTRICAL ERROR' },
                          { key: 'failSoftware', label: 'SOFTWARE ISSUE' },
                          { key: 'failEnvironmental', label: 'ENVIRONMENTAL' },
                          { key: 'failSpareLifetime', label: 'SPARE LIFETIME EXPIRY' },
                          { key: 'failExternal', label: 'EXTERNAL PROBLEM' }
                        ].map(c => (
                          <label key={c.key} className="flex items-center gap-1.5 cursor-pointer font-semibold text-[10px] text-slate-600 bg-white p-1.5 rounded-lg border border-slate-100">
                            <input type="checkbox" checked={qcForm[c.key]} onChange={e => setQcForm({...qcForm, [c.key]: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* REPAIR AND TESTING CHECKPOINTS SECTION */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">REPAIR & TESTING CHECKPOINTS</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">REPAIR ACTION TAKEN</label>
                        <div className="flex gap-4">
                          {['YES', 'NO'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input type="radio" name="repairActionTaken" value={opt} checked={qcForm.repairActionTaken === opt} onChange={e => setQcForm({...qcForm, repairActionTaken: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PARTS REPLACED</label>
                        <div className="flex gap-4">
                          {['YES', 'NO'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input type="radio" name="partsReplaced" value={opt} checked={qcForm.partsReplaced === opt} onChange={e => setQcForm({...qcForm, partsReplaced: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">POST REPAIR TESTING RESULT</label>
                        <div className="flex gap-4">
                          {['PASS', 'FAIL'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input type="radio" name="postRepairTesting" value={opt} checked={qcForm.postRepairTesting === opt} onChange={e => {
                                setQcForm({...qcForm, postRepairTesting: e.target.value});
                                setTestingForm(prev => ({...prev, result: e.target.value}));
                              }} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">TRAIL RUNNING DURATION</label>
                        <input type="text" value={qcForm.trailRunningDuration} onChange={e => {
                          setQcForm({...qcForm, trailRunningDuration: e.target.value});
                          setTestingForm(prev => ({...prev, burnInTest: e.target.value}));
                        }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none bg-white" placeholder="e.g. 2 Hours" />
                      </div>
                    </div>
                  </div>

                  {/* FINAL TEST REPORT SECTION */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">FINAL TEST REPORT & METRICS</h5>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">REDLIGHT VISIBILITY</label>
                      <div className="flex gap-4">
                        {['GOOD', 'FAIR', 'POOR'].map(opt => (
                          <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input type="radio" name="redlightVisibility" value={opt} checked={qcForm.redlightVisibility === opt} onChange={e => setQcForm({...qcForm, redlightVisibility: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-6 gap-2 font-bold text-slate-500 text-center text-[9px] border-b border-slate-100 pb-1">
                        <span className="text-left col-span-1">METRIC</span>
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                      <div className="grid grid-cols-6 gap-2 items-center text-[10px]">
                        <span className="font-bold text-slate-600">POWER</span>
                        {['laserOutput0', 'laserOutput25', 'laserOutput50', 'laserOutput75', 'laserOutput100'].map(f => (
                          <input key={f} type="text" value={qcForm[f]} onChange={e => {
                            setQcForm({...qcForm, [f]: e.target.value});
                            if (f === 'laserOutput100') setTestingForm(prev => ({...prev, outputPowerTest: e.target.value}));
                          }} className="border border-slate-200 rounded-lg px-1.5 py-1 text-center text-xs focus:outline-none bg-white" />
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-2 items-center text-[10px]">
                        <span className="font-bold text-slate-600">METER</span>
                        {['powerMeter0', 'powerMeter25', 'powerMeter50', 'powerMeter75', 'powerMeter100'].map(f => (
                          <input key={f} type="text" value={qcForm[f]} onChange={e => setQcForm({...qcForm, [f]: e.target.value})} className="border border-slate-200 rounded-lg px-1.5 py-1 text-center text-xs focus:outline-none bg-white" />
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-2 items-center text-[10px]">
                        <span className="font-bold text-slate-600">PUMP AMPS</span>
                        {['pumpAmps0', 'pumpAmps25', 'pumpAmps50', 'pumpAmps75', 'pumpAmps100'].map(f => (
                          <input key={f} type="text" value={qcForm[f]} onChange={e => setQcForm({...qcForm, [f]: e.target.value})} className="border border-slate-200 rounded-lg px-1.5 py-1 text-center text-xs focus:outline-none bg-white" />
                        ))}
                      </div>
                    </div>

                    {/* Checklist Grid */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="grid grid-cols-12 gap-2 font-black text-slate-500 text-[9px] uppercase border-b border-slate-100 pb-1 text-left">
                        <span className="col-span-4">CHECKLIST ITEM</span>
                        <span className="col-span-3">OBSERVED VALUE</span>
                        <span className="col-span-2">MAX VALUE</span>
                        <span className="col-span-3 text-center">STATUS</span>
                      </div>
                      {[
                        { key: 'optSecTemp', keySt: 'optSecTempSt', label: 'OPTICAL SECTION TEMP', unit: '°C', max: '32°C' },
                        { key: 'elecSecTemp', keySt: 'elecSecTempSt', label: 'ELECTRICAL SECTION TEMP', unit: '°C', max: '32°C' },
                        { key: 'laserPumpTemp', keySt: 'laserPumpTempSt', label: 'LASER PUMP TEMP', unit: '°C', max: '40°C' },
                        { key: 'humidityOpt', keySt: 'humidityOptSt', label: 'HUMIDITY (OPTICAL SEC)', unit: '%', max: '50%' },
                        { key: 'humidityElec', keySt: 'humidityElecSt', label: 'HUMIDITY (ELECTRICAL SEC)', unit: '%', max: '50%' },
                        { key: 'waterFlowQbh', keySt: 'waterFlowQbhSt', label: 'WATER FLOW IN QBH', unit: 'Lpm', max: '1.4Lpm' },
                        { key: 'waterFlowSource', keySt: 'waterFlowSourceSt', label: 'WATER FLOW IN SOURCE', unit: 'Lpm', max: '4.2Lpm' },
                        { key: 'tempSplicing', keySt: 'tempSplicingSt', label: 'TEMP IN SPLICING POINT', unit: 'K', max: '320K' },
                        { key: 'tempQbh', keySt: 'tempQbhSt', label: 'TEMP IN QBH CONNECTOR', unit: 'K', max: '300K' }
                      ].map(item => (
                        <div key={item.key} className="grid grid-cols-12 gap-2 items-center text-xs text-left">
                          <span className="col-span-4 font-semibold text-slate-600">{item.label}</span>
                          <div className="col-span-3 flex items-center gap-1">
                            <input type="text" value={qcForm[item.key]} onChange={e => {
                              setQcForm({...qcForm, [item.key]: e.target.value});
                              if (item.key === 'optSecTemp') setTestingForm(prev => ({...prev, temperatureTest: `Optical Temp: ${e.target.value}C`}));
                            }} className="w-16 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none bg-white text-xs" />
                            <span className="font-bold text-slate-400 text-[10px]">{item.unit}</span>
                          </div>
                          <span className="col-span-2 font-bold text-slate-500">{item.max}</span>
                          <div className="col-span-3 flex justify-around">
                            {['GOOD', 'FAIR', 'POOR'].map(st => (
                              <label key={st} className="flex items-center gap-0.5 cursor-pointer scale-90 text-[10px]">
                                <input type="radio" name={`tst_${item.keySt}`} value={st} checked={qcForm[item.keySt] === st} onChange={e => setQcForm({...qcForm, [item.keySt]: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                                {st}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">QC Decision Result</label>
                      <select
                        value={testingForm.result}
                        onChange={e => {
                          setTestingForm({...testingForm, result: e.target.value});
                          setQcForm(prev => ({...prev, postRepairTesting: e.target.value === 'PASS' ? 'PASS' : 'FAIL'}));
                        }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white font-bold"
                      >
                        <option value="PASS">PASS (Proceed to Dispatch Ready)</option>
                        <option value="FAIL">FAIL (Return to Under Repair)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Failure Reason</label>
                      <input
                        type="text"
                        value={testingForm.testNotes}
                        onChange={e => {
                          setTestingForm({...testingForm, testNotes: e.target.value});
                          setQcForm(prev => ({...prev, problemAnalysis: e.target.value}));
                        }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white"
                        placeholder="Add failure details if QC fails..."
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md"
                  >
                    Log QC Results
                  </button>
                </form>
              )}

              {/* --- 6. READY FOR DISPATCH / SERVICE REPORT AND PAYMENT STAGE --- */}
              {selectedStage === 'READY_FOR_DISPATCH' && (
                <div className="space-y-6 text-left">
                  


                  {/* 1. FINAL VERIFICATION (Checkpoints from Tab 4) */}
                  <form onSubmit={handleVerificationSubmit} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/50 space-y-4">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">1. QC Final Verification Checkpoints</h4>
                      <p className="text-[10px] text-slate-400">Complete the signing metrics matching Tab 4 checklist parameters.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="col-span-2">
                        <label className="block font-bold text-slate-500 mb-2">EQUIPMENT RUNNING CONDITION</label>
                        <div className="flex gap-4">
                          {[['OK', 'OK'], ['NOT_OK', 'NOT OK']].map(([val, label]) => (
                            <label key={val} className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="runningCondition_stage" value={val} checked={qcForm.runningCondition === val} onChange={e => setQcForm({...qcForm, runningCondition: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">VERIFIED BY *</label>
                        <input type="text" required value={qcForm.verifiedBy} onChange={e => setQcForm({...qcForm, verifiedBy: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white text-xs" />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">APPROVED BY *</label>
                        <input type="text" required value={qcForm.approvedBy} onChange={e => setQcForm({...qcForm, approvedBy: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white text-xs" />
                      </div>
                      <div className="col-span-2">
                        <label className="block font-bold text-slate-500 mb-1">FINAL REMARK</label>
                        <textarea value={qcForm.remark} onChange={e => setQcForm({...qcForm, remark: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white h-14 resize-none text-xs" placeholder="Overall quality check summary..."></textarea>
                      </div>
                      <div className="col-span-2 pt-2">
                        <button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-sm"
                        >
                          Send Approval to Manager
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* 2. Accounts Invoice & Payment Logging */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/50 space-y-4">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">2. Accounts Invoice & Payment Logging</h4>
                      <p className="text-[10px] text-slate-400">Log invoice details. Payment must be fully PAID before dispatch, unless admin override is recorded.</p>
                    </div>

                    <form onSubmit={handlePaymentSubmit} className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Number</label>
                          <input
                            type="text"
                            placeholder="INV-XXXXX"
                            value={paymentForm.invoiceNumber}
                            onChange={e => {
                              setPaymentForm({...paymentForm, invoiceNumber: e.target.value});
                              setQcForm(prev => ({...prev, invoiceNo: e.target.value}));
                            }}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Amount (₹) *</label>
                          <input
                            type="number" required
                            value={paymentForm.invoiceAmount}
                            onChange={e => setPaymentForm({...paymentForm, invoiceAmount: e.target.value})}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Paid Amount (₹) *</label>
                          <input
                            type="number" required
                            value={paymentForm.paidAmount}
                            onChange={e => setPaymentForm({...paymentForm, paidAmount: e.target.value})}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white"
                          />
                        </div>
                      </div>

                      {parseFloat(paymentForm.invoiceAmount) > parseFloat(paymentForm.paidAmount) && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] font-extrabold text-rose-950 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-rose-500" /> ADMIN OVERRIDE REQUIRED FOR DISPATCH
                          </p>
                          <input
                            type="text"
                            placeholder="Enter administrative override justification reason..."
                            value={paymentForm.overrideReason}
                            onChange={e => setPaymentForm({...paymentForm, overrideReason: e.target.value})}
                            className="w-full border border-rose-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white text-rose-950"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        className="bg-emerald-500 text-white text-xs px-4 py-2 rounded-xl font-bold hover:bg-emerald-600 cursor-pointer shadow-sm"
                      >
                        Register Invoice Payment
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* --- 7. PAYMENT COMPLETED / DISPATCH ROUTE --- */}
              {selectedStage === 'PAYMENT_COMPLETED' && (
                <div className="space-y-6 text-left">
                  {/* Service Report compilation */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/50 space-y-4">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">1. Compile Service Report & QC Signature</h4>
                      <p className="text-[10px] text-slate-400">Generate a permanent PDF service report outlining actions and validation results.</p>
                    </div>

                    {job.serviceReports && job.serviceReports.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <span className="badge-status badge-approved flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Service Report Compiled
                        </span>
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('accessToken');
                              const response = await fetch(fileUrl(job.serviceReports[0].pdfUrl), {
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                              });
                              if (!response.ok) throw new Error('Download failed');
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', `ServiceReport_${job.trackId}.pdf`);
                              document.body.appendChild(link);
                              link.click();
                              link.parentNode?.removeChild(link);
                              window.URL.revokeObjectURL(url);
                            } catch (e) {
                              alert('Failed to download service report PDF');
                            }
                          }}
                          className="text-xs text-blue-600 font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                        >
                          Download Report PDF &rarr;
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleReportSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fault Found (Problem Analysis) *</label>
                            <input
                              type="text" required
                              value={reportForm.faultFound}
                              onChange={e => setReportForm({...reportForm, faultFound: e.target.value})}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Root Cause Analysis *</label>
                            <input
                              type="text" required
                              value={reportForm.rootCauseAnalysis}
                              onChange={e => setReportForm({...reportForm, rootCauseAnalysis: e.target.value})}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Actions Performed (Immediate Action Taken) *</label>
                            <input
                              type="text" required
                              value={reportForm.repairActions}
                              onChange={e => setReportForm({...reportForm, repairActions: e.target.value})}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estimated Down Time / Outcome *</label>
                            <input
                              type="text" required
                              value={reportForm.finalOutcome}
                              onChange={e => setReportForm({...reportForm, finalOutcome: e.target.value})}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-bold"
                        >
                          Generate PDF Service Report
                        </button>
                      </form>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="font-extrabold text-slate-800 text-sm mb-1">2. Courier Shipping (Dispatch)</h4>
                    <p className="text-xs text-slate-400">Fill in shipping credentials. Service Report must be generated and Payment status must be fully PAID.</p>
                  </div>

                  <form onSubmit={handleDispatchSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Courier Service Name *</label>
                        <select
                          value={dispatchForm.courierName}
                          onChange={e => setDispatchForm({...dispatchForm, courierName: e.target.value})}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white"
                        >
                          <option value="Blue Dart">Blue Dart (Live Tracking)</option>
                          <option value="ST Couriers">ST Couriers (Live Tracking)</option>
                          <option value="DHL Express">DHL Express (Live Tracking)</option>
                          <option value="FedEx">FedEx (Live Tracking)</option>
                          <option value="DTDC">DTDC (Live Tracking)</option>
                          <option value="THIRUPATHI COURIERS">THIRUPATHI COURIERS</option>
                          <option value="METTUR PARCEL SERVICE">METTUR PARCEL SERVICE</option>
                          <option value="AVINASH CARGO PRIVATE LTD (ACPL)">AVINASH CARGO PRIVATE LTD (ACPL)</option>
                          <option value="VRL LOGISTICS">VRL LOGISTICS</option>
                          <option value="SEENSU TRANSPORT">SEENSU TRANSPORT</option>
                          <option value="PNS COURIERS">PNS COURIERS</option>
                          <option value="A1 TRAVELS">A1 TRAVELS</option>
                          <option value="BALAJI TRAVELS">BALAJI TRAVELS</option>
                          <option value="ROYAL TRAVELS">ROYAL TRAVELS</option>
                          <option value="DREAMLINE TRAVELS">DREAMLINE TRAVELS</option>
                          <option value="ARK TRAVELS">ARK TRAVELS</option>
                          <option value="PADMESH TRAVELS">PADMESH TRAVELS</option>
                          <option value="AK TRAVELS">AK TRAVELS</option>
                          <option value="Self Pickup">Self Pickup</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Courier AWB / Tracking Number *</label>
                        <input
                          type="text" required
                          value={dispatchForm.awbNumber}
                          onChange={e => setDispatchForm({...dispatchForm, awbNumber: e.target.value})}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                          placeholder="AWB11029312"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md"
                    >
                      Confirm Dispatch In-Transit
                    </button>
                  </form>
                </div>
              )}

              {/* --- 8. DISPATCHED / CLOSE TICKET --- */}
              {selectedStage === 'DISPATCHED' && (
                <div className="space-y-6 text-left">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                    <Truck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-950 text-sm">Laser Source Dispatched</h4>
                      {job.dispatches && job.dispatches.length > 0 && (
                        <p className="text-xs text-emerald-800 mt-1">
                          Shipped via {job.dispatches[0].courierName} | Tracking: {job.dispatches[0].awbNumber}.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Close Inward Job Ticket?</p>
                      <p className="text-[10px] text-slate-400">Confirms delivery with client and marks job as CLOSED.</p>
                    </div>
                    <button
                      onClick={handleCloseJob}
                      className="bg-slate-900 hover:bg-slate-950 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
                    >
                      Close Job Ticket
                    </button>
                  </div>
                </div>
              )}

              {/* --- 9. CLOSED TICKET --- */}
              {selectedStage === 'CLOSED' && (
                <div className="py-8 text-center text-slate-500 animate-fade-in space-y-4">
                  <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Job Ticket Fully Resolved & Closed</h3>
                    <p className="text-xs text-slate-400 mt-1">This laser source has been repaired, tested, paid, shipped, and closed.</p>
                  </div>
                  {job.serviceReports && job.serviceReports.length > 0 && (
                    <div className="inline-block pt-2">
                      <button
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('accessToken');
                            const response = await fetch(fileUrl(job.serviceReports[0].pdfUrl), {
                              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                            });
                            if (!response.ok) throw new Error('Download failed');
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', `ServiceReport_${job.trackId}.pdf`);
                            document.body.appendChild(link);
                            link.click();
                            link.parentNode?.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (e) {
                            alert('Failed to download final service report PDF');
                          }
                        }}
                        className="text-xs text-blue-600 font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                      >
                        Download Final Service Report PDF &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ON HOLD */}
              {selectedStage === 'ON_HOLD' && (
                <div className="py-8 text-center text-slate-500 space-y-3">
                  <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Job On Hold</h3>
                  <p className="text-xs text-slate-400">This repair is locked because the quotation estimate was rejected by the customer.</p>
                  <button
                    onClick={() => handleApproval(true)}
                    className="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-bold mt-2"
                  >
                    Force Customer Approval Override
                  </button>
                </div>
              )}

              </fieldset>
            </div>
          </div>
          
        </div>

      </div>

      {/* --- AUDIT TIMELINE LOGS LIST --- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
          <FileBadge className="h-5 w-5 text-slate-400" />
          System Transition Audit Logs (Permanently Stored)
        </h3>
        <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6 text-left">
          {job.auditLogs && job.auditLogs.length > 0 ? (
            job.auditLogs.map((log: any) => (
              <div key={log.id} className="relative">
                <div className="absolute -left-[30px] top-1 h-3.5 w-3.5 bg-blue-500 rounded-full border-2 border-white"></div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800">
                    Status: <span className="text-blue-600 uppercase">{log.oldStatus}</span> &rarr; <span className="text-emerald-600 uppercase">{log.newStatus}</span>
                  </p>
                  <p className="text-slate-500 mt-0.5">{log.remarks}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Logged by {log.user.name} ({log.user.email}) on {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">No status transitions logged yet.</p>
          )}
        </div>
      </div>

      {showBypassModal && createPortal((
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-scale-in p-6 text-left relative">
            <button
              onClick={() => { setShowBypassModal(false); setBypassReason(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-extrabold text-sm border border-slate-200 rounded-lg p-1.5 cursor-pointer hover:bg-slate-50"
            >
              ✕
            </button>

            <div className="mb-4">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Workflow Stage Bypass
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                You are about to advance this job status directly to <strong>{bypassTarget}</strong>, bypassing intermediate workflow checks.
              </p>
            </div>

            <form onSubmit={handleBypassStage} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Status</label>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 text-xs font-bold text-blue-600 uppercase">
                  {bypassTarget.replace(/_/g, ' ')}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reason for Bypass *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify why this stage bypass is required (e.g. approved by manager verbally, customer request)..."
                  value={bypassReason}
                  onChange={e => setBypassReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                />
                <span className="text-[9px] text-slate-450 font-semibold">Min. 5 characters. This reason will be logged in the permanent audit trail.</span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowBypassModal(false); setBypassReason(''); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bypassing || bypassReason.trim().length < 5}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md disabled:opacity-50"
                >
                  {bypassing ? 'Processing...' : 'Confirm Bypass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {showWhatsappModal && createPortal((
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-scale-in p-6 text-left relative">
            <button
              onClick={() => setShowWhatsappModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-extrabold text-sm border border-slate-200 rounded-lg p-1.5 cursor-pointer hover:bg-slate-50"
            >
              ✕
            </button>

            <div className="mb-4">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-600 animate-pulse" />
                Send Manual WhatsApp Alert
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Select a lifecycle stage template to dispatch updates to the customer's registered WhatsApp number.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company / Customer Name</label>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 text-xs font-semibold text-slate-800">
                  {job.customer.companyName} ({job.customer.customerName})
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Registered Phone Number</label>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 text-xs font-semibold text-slate-800">
                  {job.customer.mobileNumber}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Alert Template Status</label>
                <select
                  value={whatsappStatus}
                  onChange={e => setWhatsappStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white font-semibold"
                >
                  <option value="RECEIVED">Received & Inwarded</option>
                  <option value="INITIAL_DIAGNOSIS">Diagnostics & Inspection In Progress</option>
                  <option value="QUOTATION_GENERATED">Estimate / Quotation Generated</option>
                  <option value="CUSTOMER_APPROVAL">Awaiting Approval Notice</option>
                  <option value="UNDER_REPAIR">Active Repair Phase Initiated</option>
                  <option value="WAITING_SPARE_PARTS">Awaiting Spare Parts Allocation</option>
                  <option value="TESTING_BURN_IN">QC Testing & 6-Step Burn-In</option>
                  <option value="READY_FOR_DISPATCH">Ready for Dispatch (Awaiting Payment)</option>
                  <option value="DISPATCHED">Dispatched & In Transit</option>
                </select>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3">
                <label className="block text-[9px] font-black text-emerald-800 uppercase tracking-wider mb-1.5">WhatsApp Message Preview</label>
                <p className="text-[11px] text-emerald-950 font-medium leading-relaxed">
                  Hello {job.customer.customerName}, your fiber laser source repair job ({job.trackId}) status is now: <strong className="text-emerald-800 uppercase">{whatsappStatus.replace('_', ' ')}</strong>.
                  {whatsappStatus === 'RECEIVED' ? ' We have successfully received your laser source. You can track progress here: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'INITIAL_DIAGNOSIS' ? ' Our service engineers are currently inspecting the laser source. Check real-time timeline: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'QUOTATION_GENERATED' ? ' A quotation has been generated. Please review and approve it on the customer portal: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'CUSTOMER_APPROVAL' ? ' Your job is awaiting approval. Review quote here: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'UNDER_REPAIR' ? ' Repair work has started. Our engineer is working on the optical/diodes alignment. Status link: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'WAITING_SPARE_PARTS' ? ' ⚠️ Repair is on hold waiting for spare parts to arrive. We will notify you once parts are received. Status link: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'TESTING_BURN_IN' ? ' Repair completed! The source is now undergoing our mandatory 6-step testing & burn-in phase. Progress: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'READY_FOR_DISPATCH' ? ' Your laser source has successfully passed all burn-in tests! It is ready for dispatch pending payment clearance. portal: ' + portalTrackUrl(job.trackId) :
                   whatsappStatus === 'DISPATCHED' ? ' 🚀 Your repaired laser source has been dispatched! Track courier shipment details here: ' + portalTrackUrl(job.trackId) :
                   ' Job is updated. Track live status: ' + portalTrackUrl(job.trackId)
                  }
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowWhatsappModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendManualWhatsapp}
                disabled={whatsappLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-60"
              >
                {whatsappLoading ? 'Sending...' : 'Send WhatsApp Alert'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {showQcModal && createPortal((
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-fade-in p-6">
              
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 text-left">QC Technical Assessment Report Compilation</h3>
                  <p className="text-xs text-slate-400 text-left">Compile the detailed 2-page Laser Source Technical Assessment & Final Test Report.</p>
                </div>
                <button 
                  onClick={() => setShowQcModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-extrabold text-sm border border-slate-200 rounded-lg p-1.5 cursor-pointer hover:bg-slate-50"
                >
                  ✕
                </button>
              </div>

              {/* Completion Progress Bar */}
              <div className="mb-6 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 text-left">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-black text-slate-800">Assessment Form Progress</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${qcPercent === 100 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'} border`}>
                      {qcPercent}% Complete ({qcCompletedCount}/{requiredQcFields.length} Fields)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${qcPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                      style={{ width: `${qcPercent}%` }}
                    />
                  </div>
                </div>
                {qcPercent < 100 && (
                  <div className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-xl px-3 py-1.5 shrink-0 max-w-xs text-left">
                    ⚠️ Complete all tabs to reach 100% and generate the QC Assessment PDF report.
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 mb-6 gap-2 text-xs font-bold text-slate-500">
              {[
                { id: 1, label: '1. General & Source' },
                { id: 2, label: '2. Problems & Pre-Repair' },
                { id: 3, label: '3. Observations' },
                { id: 4, label: '4. Final Test & Verification' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQcActiveTab(tab.id)}
                  className={`pb-2 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    qcActiveTab === tab.id 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isTabIncomplete(tab.id) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Incomplete required fields in this tab" />
                  )}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleQcSubmit} className="space-y-6 text-left text-xs">
              
              {/* TAB 1 */}
              {qcActiveTab === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-slate-800 text-sm">Basic Details</h4>
                      <div>
                        <label className={labelClass('tarNo', 'block font-bold text-slate-500 mb-1')}>TAR NO *</label>
                        <input type="text" required value={qcForm.tarNo} onChange={e => setQcForm({...qcForm, tarNo: e.target.value})} className={fieldClass('tarNo', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white font-bold')} />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">START DATE *</label>
                        <input type="date" required value={qcForm.startDate} onChange={e => setQcForm({...qcForm, startDate: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">END DATE *</label>
                        <input type="date" required value={qcForm.endDate} onChange={e => setQcForm({...qcForm, endDate: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">DEPARTMENT *</label>
                        <input type="text" required value={qcForm.department} onChange={e => setQcForm({...qcForm, department: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-extrabold text-slate-800 text-sm">Reported By & Module</h4>
                      <div>
                        <label className={labelClass('reportedByName', 'block font-bold text-slate-500 mb-1')}>ENGINEER NAME *</label>
                        <input type="text" required value={qcForm.reportedByName} onChange={e => setQcForm({...qcForm, reportedByName: e.target.value})} className={fieldClass('reportedByName', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white')} />
                      </div>
                      <div>
                        <label className={labelClass('employeeId', 'block font-bold text-slate-500 mb-1')}>EMPLOYEE ID *</label>
                        <input type="text" required value={qcForm.employeeId} onChange={e => setQcForm({...qcForm, employeeId: e.target.value})} className={fieldClass('employeeId', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white')} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">TEAM *</label>
                          <select value={qcForm.team} onChange={e => setQcForm({...qcForm, team: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white">
                            <option value="TEAM_A">TEAM A</option>
                            <option value="TEAM_B">TEAM B</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">REPAIR LOCATION *</label>
                          <select value={qcForm.location} onChange={e => setQcForm({...qcForm, location: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white">
                            <option value="IN-HOUSE_REPAIR">IN-HOUSE REPAIR</option>
                            <option value="ONSITE">ONSITE</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-6 pt-4 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-600">
                          <input type="checkbox" checked={qcForm.uae} onChange={e => setQcForm({...qcForm, uae: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                          UAE REPAIR
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm">Source Details</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block font-bold text-slate-400 mb-1">MAKE</label>
                        <input type="text" disabled value={job.laserSource.brand} className="w-full border border-slate-200/50 rounded-xl px-3 py-2 bg-slate-100 text-slate-400" />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-400 mb-1">MODEL NO</label>
                        <input type="text" disabled value={job.laserSource.modelNumber} className="w-full border border-slate-200/50 rounded-xl px-3 py-2 bg-slate-100 text-slate-400" />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-400 mb-1">SERIAL NO</label>
                        <input type="text" disabled value={job.laserSource.serialNumber} className="w-full border border-slate-200/50 rounded-xl px-3 py-2 bg-slate-100 text-slate-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">MODULE TYPE *</label>
                        <select value={qcForm.moduleDetails} onChange={e => setQcForm({...qcForm, moduleDetails: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white">
                          <option value="SINGLE-MODULE">SINGLE MODULE</option>
                          <option value="MULTI-MODULE">MULTI MODULE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-400 mb-1">CUSTOMER REPORTED PROBLEM</label>
                        <textarea disabled value={job.complaintDescription} className="w-full border border-slate-200/50 rounded-xl px-3 py-2 bg-slate-100 text-slate-400 h-10 resize-none"></textarea>
                      </div>
                    </div>
                  </div>

                  {/* Tab 1 Footer */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-6">
                    <button
                      type="button"
                      onClick={handleQcSaveDraft}
                      disabled={savingDraft}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm text-xs transition-all disabled:opacity-50"
                    >
                      {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQcActiveTab(2)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm text-xs transition-all"
                    >
                      Next Tab →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2 */}
              {qcActiveTab === 2 && (
                <div className="space-y-6">
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm">Types of Problems (Select all that apply)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'qbhCableSpot', label: 'QBH/LOE/QD+/Q+ CABLE SPOT' },
                        { key: 'combinerProblem', label: 'COMBINER PROBLEM' },
                        { key: 'psuControlBoard', label: 'PSU/CONTROL BOARD ISSUE' },
                        { key: 'lowPower', label: 'LOW POWER' },
                        { key: 'activeFiber', label: 'ACTIVE FIBER PROBLEM' },
                        { key: 'othersProblem', label: 'OTHERS' }
                      ].map(prob => (
                        <label key={prob.key} className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 bg-white p-3 rounded-xl border border-slate-200/60 hover:bg-slate-50">
                          <input type="checkbox" checked={qcForm[prob.key]} onChange={e => setQcForm({...qcForm, [prob.key]: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                          {prob.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase">PRE-REPAIR INSPECTION</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div className={fieldClass('condition', 'p-3.5 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('condition', 'block font-bold text-slate-500 mb-2')}>EQUIPMENT/SOURCE CONDITION *</label>
                        <div className="flex gap-4">
                          {['GOOD', 'FAIR', 'POOR'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="condition" value={opt} checked={qcForm.condition === opt} onChange={e => setQcForm({...qcForm, condition: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={fieldClass('previousRepair', 'p-3.5 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('previousRepair', 'block font-bold text-slate-500 mb-2')}>PREVIOUS REPAIR DETAILS *</label>
                        <div className="flex gap-4">
                          {['AVAILABLE', 'NA'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="previousRepair" value={opt} checked={qcForm.previousRepair === opt} onChange={e => setQcForm({...qcForm, previousRepair: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={fieldClass('warranty', 'p-3.5 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('warranty', 'block font-bold text-slate-500 mb-2')}>WARRANTY STATUS *</label>
                        <div className="flex gap-4">
                          {[['UNDER_WARRANTY', 'UNDER WARRANTY'], ['NO_WARRANTY', 'NO WARRANTY']].map(([val, label]) => (
                            <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="warranty" value={val} checked={qcForm.warranty === val} onChange={e => setQcForm({...qcForm, warranty: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={fieldClass('customerType', 'p-3.5 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('customerType', 'block font-bold text-slate-500 mb-2')}>CLIENT TYPE *</label>
                        <div className="flex gap-4 flex-wrap">
                          {['CUSTOMER', 'DEALER', 'STANDBY', 'FREELANCER'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="customerType" value={opt} checked={qcForm.customerType === opt} onChange={e => setQcForm({...qcForm, customerType: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab 2 Footer */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-6">
                    <button
                      type="button"
                      onClick={() => setQcActiveTab(1)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer text-xs transition-all border border-slate-200"
                    >
                      ← Prev Tab
                    </button>
                    <button
                      type="button"
                      onClick={handleQcSaveDraft}
                      disabled={savingDraft}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm text-xs transition-all disabled:opacity-50"
                    >
                      {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQcActiveTab(3)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm text-xs transition-all"
                    >
                      Next Tab →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3 */}
              {qcActiveTab === 3 && (
                <div className="space-y-6">
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase">INITIAL OBSERVATION BY REPAIR ENGINEERS</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'sourcePackage', label: 'SOURCE PACKAGE CONDITION *', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'qbhCondition', label: 'QBH CONDITION *', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'externalDamage', label: 'EXTERNAL DAMAGE *', opt1: 'YES', opt2: 'NO' },
                        { key: 'internalDamage', label: 'INTERNAL DAMAGE *', opt1: 'YES', opt2: 'NO' },
                        { key: 'powerCable', label: 'POWER CABLE', opt1: 'YES', opt2: 'NO' },
                        { key: 'interfaceCable', label: 'INTERFACE CABLE', opt1: 'YES', opt2: 'NO' },
                        { key: 'sourceKey', label: 'SOURCE KEY', opt1: 'YES', opt2: 'NO' }
                      ].map(obs => (
                        <div key={obs.key} className={fieldClass(obs.key, 'flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/60 transition-all')}>
                          <span className={labelClass(obs.key, 'font-bold text-slate-700')}>{obs.label}</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={obs.key} value={obs.opt1} checked={qcForm[obs.key] === obs.opt1 || (obs.opt1 === 'NOT OK' && qcForm[obs.key] === 'NOT_OK')} onChange={e => setQcForm({...qcForm, [obs.key]: e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {obs.opt1}
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={obs.key} value={obs.opt2} checked={qcForm[obs.key] === obs.opt2 || (obs.opt2 === 'NOT OK' && qcForm[obs.key] === 'NOT_OK')} onChange={e => setQcForm({...qcForm, [obs.key]: e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {obs.opt2}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">OTHERS OBSERVATION</label>
                      <input type="text" value={qcForm.othersObservation} onChange={e => setQcForm({...qcForm, othersObservation: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white" placeholder="Any additional packaging or visual damage findings..." />
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase">FUNCTIONAL TEST POINT</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'emergencySwitch', label: 'EMERGENCY SWITCH', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'sourceStartKey', label: 'SOURCE START KEY', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'laserButtonOnKey', label: 'LASER BUTTON ON KEY', opt1: 'OK', opt2: 'NOT OK' },
                        { key: 'mainMcb', label: 'MAIN MCB', opt1: 'OK', opt2: 'NOT OK' }
                      ].map(test => (
                        <div key={test.key} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/60">
                          <span className="font-bold text-slate-700">{test.label}</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={test.key} value={test.opt1} checked={qcForm[test.key] === test.opt1 || (test.opt1 === 'NOT OK' && qcForm[test.key] === 'NOT_OK')} onChange={e => setQcForm({...qcForm, [test.key]: e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {test.opt1}
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={test.key} value={test.opt2} checked={qcForm[test.key] === test.opt2 || (test.opt2 === 'NOT OK' && qcForm[test.key] === 'NOT_OK')} onChange={e => setQcForm({...qcForm, [test.key]: e.target.value === 'NOT OK' ? 'NOT_OK' : e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {test.opt2}
                            </label>
                          </div>
                        </div>
                      ))}
                      <div className={fieldClass('problemIn', 'flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/60 col-span-2 transition-all')}>
                        <span className={labelClass('problemIn', 'font-bold text-slate-700')}>PROBLEM IDENTIFIED IN *</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                            <input type="radio" name="problemIn" value="OPTICAL_SECTION" checked={qcForm.problemIn === 'OPTICAL_SECTION'} onChange={e => setQcForm({...qcForm, problemIn: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                            OPTICAL SECTION
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                            <input type="radio" name="problemIn" value="ELECTRICAL_SECTION" checked={qcForm.problemIn === 'ELECTRICAL_SECTION'} onChange={e => setQcForm({...qcForm, problemIn: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                            ELECTRICAL SECTION
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass('observationReportedBy', 'block font-bold text-slate-500 mb-1')}>INITIAL OBSERVATION REPORTED BY *</label>
                        <input type="text" value={qcForm.observationReportedBy} onChange={e => setQcForm({...qcForm, observationReportedBy: e.target.value})} className={fieldClass('observationReportedBy', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white')} placeholder="Engineer name..." />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">ESTIMATED DOWN TIME</label>
                        <input type="text" value={qcForm.estimatedDownTime} onChange={e => setQcForm({...qcForm, estimatedDownTime: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">IMMEDIATE ACTION TAKEN</label>
                      <textarea value={qcForm.immediateActionTaken} onChange={e => setQcForm({...qcForm, immediateActionTaken: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white h-16 resize-none" placeholder="Actions taken..."></textarea>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">REQUIRED SPARE PARTS / TOOLS</label>
                      <textarea value={qcForm.requiredSpareParts} onChange={e => setQcForm({...qcForm, requiredSpareParts: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white h-16 resize-none" placeholder="Required parts list..."></textarea>
                    </div>
                  </div>

                  {/* Tab 3 Footer */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-6">
                    <button
                      type="button"
                      onClick={() => setQcActiveTab(2)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer text-xs transition-all border border-slate-200"
                    >
                      ← Prev Tab
                    </button>
                    <button
                      type="button"
                      onClick={handleQcSaveDraft}
                      disabled={savingDraft}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm text-xs transition-all disabled:opacity-50"
                    >
                      {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQcActiveTab(4)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm text-xs transition-all"
                    >
                      Next Tab →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4 */}
              {qcActiveTab === 4 && (
                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2">
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm">Final Test Report & Power Metrics</h4>
                    
                    <div className={fieldClass('redlightVisibility', 'p-3 rounded-xl border border-slate-200/50 transition-all')}>
                      <label className={labelClass('redlightVisibility', 'block font-bold text-slate-500 mb-2')}>REDLIGHT VISIBILITY *</label>
                      <div className="flex gap-4">
                        {['GOOD', 'FAIR', 'POOR'].map(opt => (
                          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="redlightVisibility" value={opt} checked={qcForm.redlightVisibility === opt} onChange={e => setQcForm({...qcForm, redlightVisibility: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-6 gap-2 font-bold text-slate-500 text-center border-b border-slate-100 pb-1">
                        <span className="text-left col-span-1 text-[10px]">METRIC</span>
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                      <div className="grid grid-cols-6 gap-2 items-center">
                        <span className="font-bold text-slate-700">OUTPUT POWER</span>
                        {['laserOutput0', 'laserOutput25', 'laserOutput50', 'laserOutput75', 'laserOutput100'].map(f => (
                          <input key={f} type="text" value={qcForm[f]} onChange={e => setQcForm({...qcForm, [f]: e.target.value})} className="border border-slate-200 rounded-lg px-2 py-1 text-center focus:outline-none" />
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-2 items-center">
                        <span className="font-bold text-slate-700">METER READING</span>
                        {['powerMeter0', 'powerMeter25', 'powerMeter50', 'powerMeter75', 'powerMeter100'].map(f => (
                          <input key={f} type="text" value={qcForm[f]} onChange={e => setQcForm({...qcForm, [f]: e.target.value})} className="border border-slate-200 rounded-lg px-2 py-1 text-center focus:outline-none" />
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-2 items-center">
                        <span className="font-bold text-slate-700">PUMP AMPS</span>
                        {['pumpAmps0', 'pumpAmps25', 'pumpAmps50', 'pumpAmps75', 'pumpAmps100'].map(f => (
                          <input key={f} type="text" value={qcForm[f]} onChange={e => setQcForm({...qcForm, [f]: e.target.value})} className="border border-slate-200 rounded-lg px-2 py-1 text-center focus:outline-none" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Checklist Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm">Checklist Status & Observed Values</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-12 gap-2 font-black text-slate-500 border-b border-slate-200 pb-2 text-[10px] uppercase tracking-wider text-left">
                        <span className="col-span-4">CHECKLIST ITEM</span>
                        <span className="col-span-3">OBSERVED VALUE</span>
                        <span className="col-span-2">MAX VALUE</span>
                        <span className="col-span-3 text-center">STATUS</span>
                      </div>
                      {[
                        { key: 'optSecTemp', keySt: 'optSecTempSt', label: 'OPTICAL SECTION TEMP', unit: '°C', max: '32°C' },
                        { key: 'elecSecTemp', keySt: 'elecSecTempSt', label: 'ELECTRICAL SECTION TEMP', unit: '°C', max: '32°C' },
                        { key: 'laserPumpTemp', keySt: 'laserPumpTempSt', label: 'LASER PUMP TEMP', unit: '°C', max: '40°C' },
                        { key: 'humidityOpt', keySt: 'humidityOptSt', label: 'HUMIDITY (OPTICAL SEC)', unit: '%', max: '50%' },
                        { key: 'humidityElec', keySt: 'humidityElecSt', label: 'HUMIDITY (ELECTRICAL SEC)', unit: '%', max: '50%' },
                        { key: 'waterFlowQbh', keySt: 'waterFlowQbhSt', label: 'WATER FLOW IN QBH', unit: 'Lpm', max: '1.4Lpm' },
                        { key: 'waterFlowSource', keySt: 'waterFlowSourceSt', label: 'WATER FLOW IN SOURCE', unit: 'Lpm', max: '4.2Lpm' },
                        { key: 'tempSplicing', keySt: 'tempSplicingSt', label: 'TEMP IN SPLICING POINT', unit: 'K', max: '320K' },
                        { key: 'tempQbh', keySt: 'tempQbhSt', label: 'TEMP IN QBH CONNECTOR', unit: 'K', max: '300K' }
                      ].map(item => (
                        <div key={item.key} className="grid grid-cols-12 gap-2 items-center text-xs text-left">
                          <span className="col-span-4 font-semibold text-slate-700">{item.label}</span>
                          <div className="col-span-3 flex items-center gap-1">
                            <input type="text" value={qcForm[item.key]} onChange={e => setQcForm({...qcForm, [item.key]: e.target.value})} className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
                            <span className="font-bold text-slate-400">{item.unit}</span>
                          </div>
                          <span className="col-span-2 font-bold text-slate-500">{item.max}</span>
                          <div className="col-span-3 flex justify-around">
                            {['GOOD', 'FAIR', 'POOR'].map(st => (
                              <label key={st} className="flex items-center gap-1 cursor-pointer scale-90 text-[10px]">
                                <input type="radio" name={item.keySt} value={st} checked={qcForm[item.keySt] === st} onChange={e => setQcForm({...qcForm, [item.keySt]: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                                {st}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm">Problem Analysis & Failure Type</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass('problemAnalysis', 'block font-bold text-slate-500 mb-1')}>PROBLEM ANALYSIS *</label>
                        <textarea value={qcForm.problemAnalysis} onChange={e => setQcForm({...qcForm, problemAnalysis: e.target.value})} className={fieldClass('problemAnalysis', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white h-16 resize-none')} placeholder="Failure diagnosis analysis..."></textarea>
                      </div>
                      <div>
                        <label className={labelClass('rootCauseAnalysis', 'block font-bold text-slate-500 mb-1')}>ROOT CAUSE ANALYSIS *</label>
                        <textarea value={qcForm.rootCauseAnalysis} onChange={e => setQcForm({...qcForm, rootCauseAnalysis: e.target.value})} className={fieldClass('rootCauseAnalysis', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white h-16 resize-none')} placeholder="Root cause details..."></textarea>
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-2">FAILURE CLASSIFICATION</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'failHuman', label: 'HUMAN ERROR' },
                          { key: 'failMechanical', label: 'MECHANICAL ERROR' },
                          { key: 'failElectrical', label: 'ELECTRICAL ERROR' },
                          { key: 'failSoftware', label: 'SOFTWARE ISSUE' },
                          { key: 'failEnvironmental', label: 'ENVIRONMENTAL' },
                          { key: 'failSpareLifetime', label: 'SPARE LIFETIME EXPIRY' },
                          { key: 'failExternal', label: 'EXTERNAL PROBLEM' }
                        ].map(c => (
                          <label key={c.key} className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600 bg-white p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                            <input type="checkbox" checked={qcForm[c.key]} onChange={e => setQcForm({...qcForm, [c.key]: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm">Verification, Payment & Dispatch</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={fieldClass('repairActionTaken', 'p-3 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('repairActionTaken', 'block font-bold text-slate-500 mb-2')}>REPAIR ACTION TAKEN *</label>
                        <div className="flex gap-4">
                          {['YES', 'NO'].map(opt => (
                            <label key={opt} className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="repairActionTaken" value={opt} checked={qcForm.repairActionTaken === opt} onChange={e => setQcForm({...qcForm, repairActionTaken: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className={fieldClass('partsReplaced', 'p-3 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('partsReplaced', 'block font-bold text-slate-500 mb-2')}>PARTS REPLACED *</label>
                        <div className="flex gap-4">
                          {['YES', 'NO'].map(opt => (
                            <label key={opt} className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="partsReplaced" value={opt} checked={qcForm.partsReplaced === opt} onChange={e => setQcForm({...qcForm, partsReplaced: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className={fieldClass('postRepairTesting', 'p-3 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('postRepairTesting', 'block font-bold text-slate-500 mb-2')}>POST REPAIR TESTING RESULT *</label>
                        <div className="flex gap-4">
                          {['PASS', 'FAIL'].map(opt => (
                            <label key={opt} className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="postRepairTesting" value={opt} checked={qcForm.postRepairTesting === opt} onChange={e => setQcForm({...qcForm, postRepairTesting: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass('trailRunningDuration', 'block font-bold text-slate-500 mb-1')}>TRAIL RUNNING DURATION *</label>
                        <input type="text" value={qcForm.trailRunningDuration} onChange={e => setQcForm({...qcForm, trailRunningDuration: e.target.value})} className={fieldClass('trailRunningDuration', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white')} placeholder="e.g. 2 Hours" />
                      </div>
                      <div className={fieldClass('runningCondition', 'col-span-2 p-3 rounded-xl border border-slate-200/50 transition-all')}>
                        <label className={labelClass('runningCondition', 'block font-bold text-slate-500 mb-2')}>EQUIPMENT RUNNING CONDITION *</label>
                        <div className="flex gap-4">
                          {[['OK', 'OK'], ['NOT_OK', 'NOT OK']].map(([val, label]) => (
                            <label key={val} className="flex items-center gap-1 cursor-pointer">
                              <input type="radio" name="runningCondition" value={val} checked={qcForm.runningCondition === val} onChange={e => setQcForm({...qcForm, runningCondition: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass('verifiedBy', 'block font-bold text-slate-500 mb-1')}>VERIFIED BY *</label>
                        <input type="text" required value={qcForm.verifiedBy} onChange={e => setQcForm({...qcForm, verifiedBy: e.target.value})} className={fieldClass('verifiedBy', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white')} />
                      </div>
                      <div>
                        <label className={labelClass('approvedBy', 'block font-bold text-slate-500 mb-1')}>APPROVED BY *</label>
                        <input type="text" required value={qcForm.approvedBy} onChange={e => setQcForm({...qcForm, approvedBy: e.target.value})} className={fieldClass('approvedBy', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white')} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass('remark', 'block font-bold text-slate-500 mb-1')}>FINAL REMARK *</label>
                        <textarea value={qcForm.remark} onChange={e => setQcForm({...qcForm, remark: e.target.value})} className={fieldClass('remark', 'w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white h-12 resize-none')} placeholder="Overall quality check summary..."></textarea>
                      </div>
                      <div className="pt-2 border-t border-slate-100 col-span-2 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-bold text-slate-500 mb-2">PAYMENT TYPE</label>
                          <div className="flex gap-4">
                            {[['INVOICE', 'INVOICE'], ['NON-INVOICE', 'NON-INVOICE']].map(([val, label]) => (
                              <label key={val} className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="paymentType" value={val} checked={qcForm.paymentType === val} onChange={e => setQcForm({...qcForm, paymentType: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">INVOICE NO</label>
                          <input type="text" value={qcForm.invoiceNo} onChange={e => setQcForm({...qcForm, invoiceNo: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none bg-white" placeholder="INV-2026-..." />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 col-span-2">
                        <label className="block font-bold text-slate-500 mb-2">DISPATCH METHOD</label>
                        <div className="flex gap-4">
                          {['TRANSPORT/COURIER', 'CUSTOMER VEHICLE', 'PORTER'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="dispatchMethod" value={opt} checked={qcForm.dispatchMethod === opt} onChange={e => setQcForm({...qcForm, dispatchMethod: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission Row */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 w-full mt-6">
                    {qcPercent < 100 && (
                      <div className="text-[10px] text-slate-450 font-bold text-left">
                        ⚠️ Lock active: Please complete remaining {requiredQcFields.length - qcCompletedCount} fields to generate the PDF report (Current: {qcPercent}%).
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQcActiveTab(3)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer text-xs transition-all border border-slate-200"
                      >
                        ← Prev Tab
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleQcSaveDraft}
                          disabled={savingDraft}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm text-xs transition-all disabled:opacity-50"
                        >
                          {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                        </button>
                        <button 
                          type="submit" 
                          disabled={qcPercent < 100}
                          className={`font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md ${
                            qcPercent < 100 
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                          }`}
                        >
                          Save & Generate 2-Page QC PDF Report
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </form>
          </div>
        </div>
      ), document.body)}

    </div>
  );
};

export default JobWorkflow;
