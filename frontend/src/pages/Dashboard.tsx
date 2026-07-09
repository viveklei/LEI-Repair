import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { socket } from '../services/socket';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  IndianRupee, 
  Cpu, 
  Wrench, 
  Activity, 
  Calendar, 
  UserCheck,
  Play,
  Brain,
  Terminal,
  Gauge,
  ShieldAlert,
  ArrowRight,
  Search,
  SlidersHorizontal,
  RefreshCw,
  X,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface DashboardData {
  totalJobs: number;
  receivedToday: number;
  underInspection: number;
  awaitingApproval: number;
  underRepair: number;
  waitingParts: number;
  testing: number;
  readyDispatch: number;
  dispatched: number;
  closed: number;
  pendingPayments: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  brandStats: Record<string, number>;
  engineerProductivity: Array<{
    id: string;
    name: string;
    repairsCompleted: number;
    testsLogged: number;
    inspectionsLogged: number;
  }>;
}

interface TelemetryPoint {
  time: number;
  current: number;
  reflection: number;
  power: number;
}

// 6-Month Operations Trend Data for SVG Area Chart
const monthlyTrends = [
  { month: 'Dec', inward: 18, completed: 12, revenue: 125000 },
  { month: 'Jan', inward: 24, completed: 19, revenue: 240000 },
  { month: 'Feb', inward: 15, completed: 16, revenue: 198000 },
  { month: 'Mar', inward: 32, completed: 25, revenue: 380000 },
  { month: 'Apr', inward: 28, completed: 30, revenue: 410000 },
  { month: 'May', inward: 42, completed: 35, revenue: 650000 },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Dashboard Tabs: 'hub' (stats/productivity) | 'queue' (active jobs list) | 'telemetry' (calibration simulation) | 'ai' (failure logs)
  const [currentTab, setCurrentTab] = useState<'hub' | 'queue' | 'telemetry' | 'ai'>('hub');

  useEffect(() => {
    if (user?.role === 'ENGINEER') {
      setCurrentTab('queue');
    }
  }, [user]);

  // Sparkline data sequences
  const sparklineJobs = [12, 19, 15, 27, 32, 45, 52];
  const sparklineToday = [2, 4, 1, 5, 3, 2, 4];
  const sparklineRevenue = [180, 240, 210, 390, 480, 620, 650];

  // Active Critical Alarms Drawer State
  const [activeAlarms, setActiveAlarms] = useState<Array<{ id: string; msg: string; priority: 'CRITICAL' | 'WARNING'; jobTrack: string }>>([
    { id: '1', msg: 'Raycus 3kW high back-reflection detected on calibration check.', priority: 'CRITICAL', jobTrack: 'FSR-2026-0004' },
    { id: '2', msg: 'IPG 4kW coolant pressure decay below 2.4 bar threshold.', priority: 'WARNING', jobTrack: 'FSR-2026-0012' },
  ]);

  // Operations Queue Search & Advanced Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [queueStatusFilter, setQueueStatusFilter] = useState<'ALL' | 'INSPECTION' | 'REPAIR' | 'TESTING' | 'DISPATCH'>('ALL');
  const [queuePriorityFilter, setQueuePriorityFilter] = useState<'ALL' | 'URGENT' | 'HIGH' | 'NORMAL'>('ALL');
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(true);

  // Diagnostics & Calibration Settings
  const [diodeLimit, setDiodeLimit] = useState(80); // Target Current max (0A - 100A)
  const [coolantFlow, setCoolantFlow] = useState(15.0); // Flow rate L/min (0 - 25)
  const [tempThreshold, setTempThreshold] = useState(42); // Alarm temp (30°C - 50°C)
  const [diagnosticState, setDiagnosticState] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [telemetry, setTelemetry] = useState({
    power: 0,
    current: 0,
    reflection: 0.0,
    temp: 22.0
  });

  // Real-time trace sweep history points
  const [traceHistory, setTraceHistory] = useState<TelemetryPoint[]>([]);
  
  // 2D Diode Array thermal values
  const [diodeArrayTemps, setDiodeArrayTemps] = useState<number[]>(Array(16).fill(22.0));

  // AI Diagnostic Wizard State
  const [selectedBrand, setSelectedBrand] = useState('Raycus');
  const [selectedPower, setSelectedPower] = useState('3kW');
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiAnalysisLogs, setAiAnalysisLogs] = useState<string[]>([]);
  const [aiReport, setAiReport] = useState<{
    risk: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
    breakdown: { fiber: number; combiner: number; diode: number; cooling: number };
    checklist: string[];
  } | null>(null);

  // SVG Area Chart Hover State
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, jobsRes, insightsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/jobs'),
        api.get('/reports/ai-insights')
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setInsights(insightsRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time events via Socket.IO
    socket.on('dashboard_update', () => {
      console.log('🔄 Dashboard update event received. Fetching new metrics...');
      fetchData();
    });

    return () => {
      socket.off('dashboard_update');
    };
  }, []);

  // Diode array thermal dynamics logic loop when sliders change
  useEffect(() => {
    if (diagnosticState === 'scanning') return; // Diagnostics controller overrides array values
    
    // Simulate natural thermal load based on current slider and coolant flow rate
    // Temperature rises with current, decreases with coolant flow.
    const heatCoefficient = (diodeLimit * 0.28) - (coolantFlow * 0.35);
    const nominalTemp = Math.max(22.0, parseFloat((22.0 + heatCoefficient).toFixed(1)));
    
    // Generate slight noise in chips
    const updatedArray = diodeArrayTemps.map((_, i) => {
      const noise = Math.sin(i * 45) * 0.9 + Math.cos(i * 12) * 0.4;
      return parseFloat((nominalTemp + noise).toFixed(1));
    });
    setDiodeArrayTemps(updatedArray);
    
    // Update live indicators
    setTelemetry(prev => ({
      ...prev,
      current: 0, // In idle power off
      power: 0,
      temp: parseFloat(nominalTemp.toFixed(1))
    }));

  }, [diodeLimit, coolantFlow, diagnosticState]);

  // Execute Telemetry Calibration Sweeps
  const runDiagnostics = () => {
    if (diagnosticState === 'scanning') return;
    
    setDiagnosticState('scanning');
    setTraceHistory([]);
    setDiagnosticLogs(['[INFO] Diode Sweeper Core Online. Initializing loop sequence...']);

    let step = 0;
    const totalSteps = 30;
    const sweepInterval = setInterval(() => {
      step++;
      
      // Calculate current ramp
      const currentRamp = parseFloat(((step / totalSteps) * diodeLimit).toFixed(1));
      
      // Calculate power ramp
      const targetPowerValue = Math.round(currentRamp * 58); // approx 58W per amp
      
      // Calculate thermal load dynamically
      const ambientTemp = 22.0;
      const heatFactor = (currentRamp * 0.32) - (coolantFlow * 0.4);
      const cellTemps = Array(16).fill(0).map((_, idx) => {
        const localHeatNoise = Math.sin(idx + step) * 1.5;
        return parseFloat((ambientTemp + heatFactor + localHeatNoise).toFixed(1));
      });
      setDiodeArrayTemps(cellTemps);
      const avgTemp = parseFloat((cellTemps.reduce((a, b) => a + b, 0) / 16).toFixed(1));

      // Calculate reflection. Spikes if current is high (>70A) or coolant is low (<10 L/min)
      let backReflection = parseFloat((0.02 + (currentRamp * 0.0005) + (Math.sin(step) * 0.005)).toFixed(3));
      if (currentRamp > 70 && coolantFlow < 10) {
        backReflection = parseFloat((backReflection * 3.2).toFixed(3));
      }

      const point: TelemetryPoint = {
        time: step,
        current: currentRamp,
        reflection: backReflection,
        power: targetPowerValue
      };

      setTraceHistory(prev => [...prev, point]);
      setTelemetry({
        power: targetPowerValue,
        current: currentRamp,
        reflection: backReflection,
        temp: avgTemp
      });

      // Appending logs
      if (step === 5) {
        setDiagnosticLogs(prev => [...prev, `[INFO] Pump loops calibrated. Output locked at ${targetPowerValue}W.`]);
      } else if (step === 12) {
        setDiagnosticLogs(prev => [...prev, `[INFO] Thermals feedback: Avg cooling core at ${avgTemp}°C.`]);
        if (avgTemp > tempThreshold) {
          setDiagnosticLogs(prev => [...prev, `[CRITICAL ALARM] Core temp ${avgTemp}°C exceeded safety limit ${tempThreshold}°C!`]);
        }
      } else if (step === 20) {
        setDiagnosticLogs(prev => [...prev, `[INFO] QBH Optical alignment feedback: Reflection level = ${backReflection}%`]);
        if (backReflection > 0.12) {
          setDiagnosticLogs(prev => [...prev, `[WARNING] QBH optical backscatter is critical: ${backReflection}%. Adjust coolant flow!`]);
        }
      }

      if (step >= totalSteps) {
        clearInterval(sweepInterval);
        setDiagnosticState('complete');
        setDiagnosticLogs(prev => [
          ...prev, 
          `[SUCCESS] Sweeper cycle finalized. Target Power ${targetPowerValue}W stabilized. Diode current = ${currentRamp}A.`
        ]);
      }
    }, 120);
  };

  // Run AI Predictive Report
  const runAIWizard = () => {
    if (isAnalyzingAI) return;
    setIsAnalyzingAI(true);
    setAiReport(null);
    setAiAnalysisLogs(['Scanning serial databases for brand alignment...', 'Evaluating pump diode run-hour indices...']);

    setTimeout(() => {
      setAiAnalysisLogs(prev => [...prev, 'Running MTBF matrix coefficient calculations...', 'Cross-referencing similar complaint categories...']);
    }, 800);

    setTimeout(() => {
      let riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'MODERATE';
      let fiberRisk = 25;
      let combinerRisk = 30;
      let diodeRisk = 20;
      let coolingRisk = 15;
      let checklist: string[] = [];

      if (selectedBrand === 'Raycus') {
        if (selectedPower === '3kW' || selectedPower === '6kW') {
          riskLevel = 'HIGH';
          fiberRisk = 65;
          combinerRisk = 40;
          diodeRisk = 25;
          checklist = [
            'Inspect QBH fiber input connector quartz end-cap for contaminants.',
            'Perform thermal imaging on the high-power combiner splice points under load.',
            'Calibrate the coolant water flow rate strictly to 18 L/min (min: 15 L/min).'
          ];
        } else {
          riskLevel = 'MODERATE';
          fiberRisk = 40;
          combinerRisk = 30;
          checklist = [
            'Clean water cooling line filters.',
            'Verify laser guide beam diode alignment.'
          ];
        }
      } else if (selectedBrand === 'IPG') {
        riskLevel = 'LOW';
        diodeRisk = 15;
        combinerRisk = 18;
        checklist = [
          'Verify control system communication protocols.',
          'Execute standard 24-hour burn-in stress test.'
        ];
      } else if (selectedBrand === 'JPT') {
        riskLevel = 'CRITICAL';
        diodeRisk = 75;
        coolingRisk = 50;
        checklist = [
          'Critical check: Evaluate pump diode drive board circuitry for resistance variance.',
          'Replace cooling block thermo-conductive paste immediately.',
          'Inspect combiner internal cladding light strippers.'
        ];
      } else {
        // Maxphotonics
        riskLevel = 'MODERATE';
        combinerRisk = 45;
        checklist = [
          'Check combiner output fiber cladding containment.',
          'Test laser source interlock loop integrity.'
        ];
      }

      setAiReport({
        risk: riskLevel,
        breakdown: { fiber: fiberRisk, combiner: combinerRisk, diode: diodeRisk, cooling: coolingRisk },
        checklist
      });
      setIsAnalyzingAI(false);
      setAiAnalysisLogs([]);
    }, 1800);
  };

  // Resolve priority tags dynamically for jobs list
  const getJobPriority = (job: any) => {
    return job.priority || 'NORMAL';
  };

  // Filter queue jobs list
  const getFilteredJobs = () => {
    if (!Array.isArray(jobs)) return [];
    return jobs.filter(job => {
      // 1. Search Query Match
      const searchMatch = 
        job.trackId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.customer.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.laserSource.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.laserSource.brand.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!searchMatch) return false;

      // 2. Status Category Tabs
      if (queueStatusFilter === 'INSPECTION') {
        if (job.status !== 'INITIAL_DIAGNOSIS' && job.status !== 'RECEIVED') return false;
      } else if (queueStatusFilter === 'REPAIR') {
        if (job.status !== 'UNDER_REPAIR' && job.status !== 'WAITING_SPARE_PARTS' && job.status !== 'REPAIR_INITIATED') return false;
      } else if (queueStatusFilter === 'TESTING') {
        if (job.status !== 'TESTING_BURN_IN') return false;
      } else if (queueStatusFilter === 'DISPATCH') {
        if (job.status !== 'READY_FOR_DISPATCH' && job.status !== 'DISPATCHED') return false;
      }

      // 3. Priority Tag Filter
      const jobPriority = getJobPriority(job);
      if (queuePriorityFilter !== 'ALL' && jobPriority !== queuePriorityFilter) return false;

      // 4. Engineer Filter (if role is ENGINEER, check if showOnlyAssigned is checked)
      if (user?.role === 'ENGINEER') {
        if (showOnlyAssigned) {
          if (job.currentEngineerId !== user.id) return false;
        } else {
          // If viewing all, exclude jobs assigned to other engineers (keep unassigned jobs)
          if (job.currentEngineerId && job.currentEngineerId !== user.id) return false;
        }
      }

      return true;
    });
  };

  // Draw simple visual sparkline inside metric cards
  const renderSparkline = (points: number[], strokeColor: string) => {
    const width = 120;
    const height = 32;
    const maxVal = Math.max(...points, 1);
    const minVal = Math.min(...points, 0);
    const range = maxVal - minVal;
    
    const xStep = width / (points.length - 1);
    const coords = points.map((val, idx) => {
      const x = idx * xStep;
      const y = height - ((val - minVal) / range) * height + 1; // 1px padding
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible opacity-80 group-hover:opacity-100 transition-opacity">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    );
  };

  // Draw custom radial circular SLA progress gauge
  const renderRadialGauge = (percentage: number, label: string, strokeColor: string) => {
    const radius = 34;
    const strokeWidth = 7;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between card-premium hover:shadow-cyan-500/5 group h-full">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{percentage}%</h3>
        </div>
        <div className="relative flex items-center justify-center h-20 w-20">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-slate-100"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="transition-all duration-1000 ease-out"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-xs font-black text-slate-800">{percentage}%</span>
          </div>
        </div>
      </div>
    );
  };

  // Engineer personal stats calculations
  const myAssignedJobs = Array.isArray(jobs) ? jobs.filter(j => j.currentEngineerId === user?.id && j.status !== 'CLOSED' && j.status !== 'DISPATCHED') : [];
  const myInspections = myAssignedJobs.filter(j => ['RECEIVED', 'VISUAL_INSPECTION', 'INITIAL_DIAGNOSIS'].includes(j.status));
  const myRepairs = myAssignedJobs.filter(j => ['REPAIR_INITIATED', 'UNDER_REPAIR', 'WAITING_SPARE_PARTS'].includes(j.status));
  const myTesting = myAssignedJobs.filter(j => ['REPAIR_COMPLETED', 'TESTING_BURN_IN'].includes(j.status));

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left block">
            {user?.role === 'ENGINEER' ? 'Repair & Service Department' : 'Operations & Management Hub'}
          </span>
          <h1 className="text-2xl font-black text-slate-900 text-left">
            {user?.role === 'ENGINEER' ? `Welcome back, Eng. ${user?.name}` : 'Laser Repair Service Hub'}
          </h1>
        </div>
      </div>

      {/* --- TOP METRICS CARDS WITH SVG SPARKLINES --- */}
      {user?.role === 'ENGINEER' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: My Active Jobs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between card-premium hover:shadow-blue-500/5 group h-full">
            <div className="flex items-center justify-between w-full">
              <div className="p-3.5 bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-600 rounded-2xl transition-all duration-300 group-hover:scale-105 border border-blue-100">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">My Active Jobs</p>
                <h3 className="text-2xl font-black text-slate-900 text-right mt-0.5">{myAssignedJobs.length}</h3>
              </div>
            </div>
            <div className="mt-3 mb-1">
              <p className="text-[10px] text-slate-400 font-semibold">Total active repair tasks assigned to you.</p>
            </div>
            <div className="flex items-end justify-between mt-2 w-full">
              <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active workload
              </span>
              {renderSparkline([2, 3, 2, 4, 3, 5, myAssignedJobs.length], '#3b82f6')}
            </div>
          </div>

          {/* Card 2: My Inspections */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between card-premium hover:shadow-indigo-500/5 group h-full">
            <div className="flex items-center justify-between w-full">
              <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 rounded-2xl transition-all duration-300 group-hover:scale-105 border border-indigo-100">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">My Inspections</p>
                <h3 className="text-2xl font-black text-slate-900 text-right mt-0.5">{myInspections.length}</h3>
              </div>
            </div>
            <div className="mt-3 mb-1">
              <p className="text-[10px] text-slate-400 font-semibold">Jobs assigned to you awaiting initial physical inspection & diagnosis.</p>
            </div>
            <div className="flex items-end justify-between mt-2 w-full">
              <span className="text-[10px] text-slate-400 font-extrabold">Inward diagnosis queue</span>
              {renderSparkline([1, 2, 1, 3, 2, 1, myInspections.length], '#6366f1')}
            </div>
          </div>

          {/* Card 3: My Repairs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between card-premium hover:shadow-emerald-500/5 group h-full">
            <div className="flex items-center justify-between w-full">
              <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 rounded-2xl transition-all duration-300 group-hover:scale-105 border border-emerald-100">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">My Active Repairs</p>
                <h3 className="text-2xl font-black text-slate-900 text-right mt-0.5">{myRepairs.length}</h3>
              </div>
            </div>
            <div className="mt-3 mb-1">
              <p className="text-[10px] text-slate-400 font-semibold">Jobs actively undergoing fiber/combiner/diode repairs.</p>
            </div>
            <div className="flex items-end justify-between mt-2 w-full">
              <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                Active repairs
              </span>
              {renderSparkline([0, 1, 2, 1, 3, 2, myRepairs.length], '#10b981')}
            </div>
          </div>

          {/* Card 4: My Testing */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between card-premium hover:shadow-cyan-500/5 group h-full">
            <div className="flex items-center justify-between w-full">
              <div className="p-3.5 bg-gradient-to-br from-cyan-50 to-cyan-100/50 text-cyan-600 rounded-2xl transition-all duration-300 group-hover:scale-105 border border-cyan-100">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">My Testing & Burn-In</p>
                <h3 className="text-2xl font-black text-slate-900 text-right mt-0.5">{myTesting.length}</h3>
              </div>
            </div>
            <div className="mt-3 mb-1">
              <p className="text-[10px] text-slate-400 font-semibold">Repaired units undergoing burn-in stress testing and load calibration.</p>
            </div>
            <div className="flex items-end justify-between mt-2 w-full">
              <span className="text-[10px] text-cyan-600 font-extrabold flex items-center gap-1">
                Awaiting validation
              </span>
              {renderSparkline([1, 0, 1, 2, 1, 1, myTesting.length], '#06b6d4')}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Repairs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between card-premium hover:shadow-blue-500/5 group h-full">
            <div className="flex items-center justify-between w-full">
              <div className="p-3.5 bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-600 rounded-2xl transition-all duration-300 group-hover:scale-105 border border-blue-100">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">All-Time Inward Jobs</p>
                <h3 className="text-2xl font-black text-slate-900 text-right mt-0.5">{stats.totalJobs}</h3>
              </div>
            </div>
            <div className="mt-3 mb-1">
              <p className="text-[10px] text-slate-400 font-semibold">Total laser sources received across all stages of the repair workflow.</p>
            </div>
            <div className="flex items-end justify-between mt-2 w-full">
              <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                +12% vs last month
              </span>
              {renderSparkline(sparklineJobs, '#3b82f6')}
            </div>
          </div>

        {/* Card 2: Received Today */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between card-premium hover:shadow-indigo-500/5 group h-full">
          <div className="flex items-center justify-between w-full">
            <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 rounded-2xl transition-all duration-300 group-hover:scale-105 border border-indigo-100">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Received Today</p>
              <h3 className="text-2xl font-black text-slate-900 text-right mt-0.5">{stats.receivedToday}</h3>
            </div>
          </div>
          <div className="mt-3 mb-1">
            <p className="text-[10px] text-slate-400 font-semibold">New laser sources logged into the repair system today (inward sticker issued).</p>
          </div>
          <div className="flex items-end justify-between mt-2 w-full">
            <span className="text-[10px] text-slate-400 font-extrabold">Live inward load</span>
            {renderSparkline(sparklineToday, '#6366f1')}
          </div>
        </div>

        {/* Card 3: Monthly Revenue (INR) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between card-premium hover:shadow-emerald-500/5 group h-full">
          <div className="flex items-center justify-between w-full">
            <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 rounded-2xl transition-all duration-300 group-hover:scale-105 border border-emerald-100">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Revenue This Month</p>
              <h3 className="text-xl font-black text-slate-900 text-right mt-0.5">₹{stats.revenueThisMonth.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-3 mb-1 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-semibold">Billed amount from closed/dispatched jobs this calendar month.</p>
          </div>
          <div className="flex items-end justify-between mt-2 w-full">
            <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
              YTD: ₹{stats.revenueThisYear?.toLocaleString() ?? '—'}
            </span>
            {renderSparkline(sparklineRevenue, '#10b981')}
          </div>
        </div>

        {/* Card 4: SLA Compliance radial gauge */}
        {renderRadialGauge(94, 'Quality Control Pass Rate', '#06b6d4')}
      </div>
      )}

      {/* --- QUICK INSIGHTS / AT-A-GLANCE BAR --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Awaiting Parts</p>
            <p className="text-xl font-black text-amber-700 mt-0.5">{stats.waitingParts}</p>
            <p className="text-[9px] text-amber-600 font-semibold mt-0.5">Jobs blocked — spares not yet received</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200/60 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-rose-100 rounded-lg flex-shrink-0">
            <IndianRupee className="h-4 w-4 text-rose-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-rose-800 uppercase tracking-wider">Pending Payments</p>
            <p className="text-xl font-black text-rose-700 mt-0.5">{stats.pendingPayments}</p>
            <p className="text-[9px] text-rose-600 font-semibold mt-0.5">Jobs with unpaid or partial amounts</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200/60 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg flex-shrink-0">
            <Wrench className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-cyan-800 uppercase tracking-wider">Under Active Repair</p>
            <p className="text-xl font-black text-cyan-700 mt-0.5">{stats.underRepair}</p>
            <p className="text-[9px] text-cyan-600 font-semibold mt-0.5">Currently being worked on by engineers</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200/60 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-teal-100 rounded-lg flex-shrink-0">
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-teal-800 uppercase tracking-wider">Ready for Dispatch</p>
            <p className="text-xl font-black text-teal-700 mt-0.5">{stats.readyDispatch}</p>
            <p className="text-[9px] text-teal-600 font-semibold mt-0.5">Repaired &amp; QC passed — awaiting pickup</p>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD NAVIGATION TABS --- */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        {user?.role !== 'ENGINEER' && (
          <button
            onClick={() => setCurrentTab('hub')}
            className={`px-5 py-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              currentTab === 'hub'
                ? 'border-cyan-500 text-cyan-600 bg-cyan-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="h-4.5 w-4.5" />
            Operations Hub
          </button>
        )}
        <button
          onClick={() => setCurrentTab('queue')}
          className={`px-5 py-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            currentTab === 'queue'
              ? 'border-cyan-500 text-cyan-600 bg-cyan-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4.5 w-4.5" />
          {user?.role === 'ENGINEER' ? 'My Workspace' : 'Operations Queue'} ({getFilteredJobs().length})
        </button>
      </div>

      {/* --- TAB 1: OPERATIONS HUB --- */}
      {currentTab === 'hub' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* --- MIDDLE GRIDS: 6-MONTH CHART & DISTRIBUTION --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* SVG Operations Trend Area Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between lg:col-span-2 hover:shadow-lg transition-shadow duration-300 relative">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                    <TrendingUp className="h-4.5 w-4.5 text-blue-600" />
                    Inward Repairs & Completed Trends
                  </h3>
                  <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 bg-blue-500/80 rounded"></span>Inward</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 bg-emerald-500/80 rounded"></span>Completed</span>
                  </div>
                </div>
                
                {/* Visual SVG Plot */}
                <div className="relative h-64 w-full mt-6">
                  {/* SVG Canvas for Area Chart */}
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 600 220">
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                      </linearGradient>
                      <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="70" x2="580" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="120" x2="580" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="170" x2="580" y2="170" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="200" x2="580" y2="200" stroke="#e2e8f0" strokeWidth="1.5" />

                    {/* Y Axis Labels */}
                    <text x="15" y="24" className="text-[10px] fill-slate-400 font-bold">50</text>
                    <text x="15" y="74" className="text-[10px] fill-slate-400 font-bold">30</text>
                    <text x="15" y="124" className="text-[10px] fill-slate-400 font-bold">15</text>
                    <text x="15" y="174" className="text-[10px] fill-slate-400 font-bold">5</text>
                    <text x="15" y="204" className="text-[10px] fill-slate-400 font-bold">0</text>

                    {/* Calculate paths coordinates */}
                    {/* Width between columns: 540 / 5 = 108 */}
                    {/* Y values mapped: 200 - (val / 50) * 180 */}
                    {(() => {
                      const inwardPoints = monthlyTrends.map((t, i) => `${40 + i * 108},${200 - (t.inward / 50) * 180}`);
                      const completedPoints = monthlyTrends.map((t, i) => `${40 + i * 108},${200 - (t.completed / 50) * 180}`);
                      
                      const inwardPath = `M ${inwardPoints.join(' L ')}`;
                      const completedPath = `M ${completedPoints.join(' L ')}`;

                      const inwardArea = `${inwardPath} L 580,200 L 40,200 Z`;
                      const completedArea = `${completedPath} L 580,200 L 40,200 Z`;

                      return (
                        <>
                          {/* Fills */}
                          <path d={inwardArea} fill="url(#blueGrad)" />
                          <path d={completedArea} fill="url(#emeraldGrad)" />

                          {/* Lines */}
                          <path d={inwardPath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                          <path d={completedPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeDasharray="1,1" strokeDashoffset="0" />

                          {/* Interactive Node circles */}
                          {monthlyTrends.map((t, i) => {
                            const ix = 40 + i * 108;
                            const iy = 200 - (t.inward / 50) * 180;
                            const cy = 200 - (t.completed / 50) * 180;

                            return (
                              <g key={i}>
                                {/* Interaction target area */}
                                <rect
                                  x={ix - 35}
                                  y="0"
                                  width="70"
                                  height="220"
                                  className="fill-transparent cursor-pointer"
                                  onMouseEnter={() => setHoveredMonth(i)}
                                  onMouseLeave={() => setHoveredMonth(null)}
                                />
                                
                                <circle cx={ix} cy={iy} r="5" className="fill-white stroke-blue-600 cursor-pointer" strokeWidth="2.5" />
                                <circle cx={ix} cy={cy} r="5" className="fill-white stroke-emerald-600 cursor-pointer" strokeWidth="2.5" />

                                {/* Vertical tracker guide on hover */}
                                {hoveredMonth === i && (
                                  <line x1={ix} y1="20" x2={ix} y2="200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" className="pointer-events-none" />
                                )}
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* X Axis labels */}
                    {monthlyTrends.map((t, i) => (
                      <text key={i} x={40 + i * 108} y="218" textAnchor="middle" className="text-[10px] font-bold fill-slate-400">{t.month}</text>
                    ))}
                  </svg>

                  {/* Tooltip Overlay */}
                  {hoveredMonth !== null && (
                    <div 
                      className="absolute bg-slate-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl border border-slate-700 pointer-events-none z-30 transition-all duration-150"
                      style={{
                        left: `${hoveredMonth * 18 + 8}%`,
                        top: '15px'
                      }}
                    >
                      <h4 className="font-extrabold text-cyan-400 border-b border-slate-700 pb-1 mb-1">{monthlyTrends[hoveredMonth].month} Repair Data</h4>
                      <p>Inward volume: <span className="font-black">{monthlyTrends[hoveredMonth].inward} sources</span></p>
                      <p>Completed QC: <span className="font-black">{monthlyTrends[hoveredMonth].completed} sources</span></p>
                      <p>Billing: <span className="font-black text-emerald-400">₹{monthlyTrends[hoveredMonth].revenue.toLocaleString()}</span></p>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-50 pt-4 flex justify-between text-[11px] text-slate-400 font-extrabold">
                <span>Updated in real-time. Hover graph keys for details.</span>
              </div>
            </div>

            {/* Brand wise distribution and revenue share */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                    <Cpu className="h-4.5 w-4.5 text-blue-600" />
                    Market Repair Share
                  </h3>
                  <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">Stats</span>
                </div>
                <div className="space-y-4 my-6">
                  {Object.keys(stats.brandStats).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No laser brand data registered.</p>
                  ) : (
                    Object.keys(stats.brandStats).map((b) => {
                      const val = stats.brandStats[b];
                      const percentage = ((val / stats.totalJobs) * 100).toFixed(0);
                      
                      let progressColor = 'bg-gradient-to-r from-cyan-400 to-blue-500';
                      if (b.toLowerCase().includes('ipg')) progressColor = 'bg-gradient-to-r from-orange-400 to-red-500';
                      else if (b.toLowerCase().includes('raycus')) progressColor = 'bg-gradient-to-r from-cyan-500 to-indigo-500';
                      else if (b.toLowerCase().includes('max')) progressColor = 'bg-gradient-to-r from-emerald-400 to-teal-500';
                      else if (b.toLowerCase().includes('jpt')) progressColor = 'bg-gradient-to-r from-purple-500 to-pink-500';

                      return (
                        <div key={b} className="space-y-1.5 group cursor-pointer">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span className="group-hover:text-cyan-600 transition-colors flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${progressColor}`}></span>
                              {b}
                            </span>
                            <span className="text-slate-500 font-extrabold">{val} <span className="text-[10px] font-medium text-slate-400">({percentage}%)</span></span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                            <div 
                              className={`${progressColor} h-2.5 rounded-full transition-all duration-1000 ease-out`} 
                              style={{ width: `${(val / Math.max(...Object.values(stats.brandStats), 1)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 flex justify-between text-[11px] text-slate-400 font-extrabold">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  Payments Pending: {stats.pendingPayments} jobs
                </span>
                <Link to="/reports" className="text-blue-600 hover:text-blue-700 transition-colors">View Report &rarr;</Link>
              </div>
            </div>
          </div>

          {/* --- REPAIR PIPELINE STATUS COUNTERS --- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-500/50"></span>
                Repair Lifecycle Pipeline — Job Flow
              </h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold border border-slate-200">← Left to Right = Active Workflow →</span>
            </div>
            
            {/* Pipeline with flow arrows */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm overflow-x-auto">
              <div className="flex items-stretch gap-0 min-w-max">
                
                {/* Stage 1: Inspection */}
                <div className="flex-1 min-w-[100px] p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-center flex flex-col justify-between">
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block">Inspection</span>
                  <div className="text-3xl font-black text-amber-600 py-1">{stats.underInspection}</div>
                  <p className="text-[8px] text-amber-500 font-semibold">Fault diagnosis &amp; initial check</p>
                  <div className="w-full bg-amber-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-amber-500 h-1 rounded-full w-full"></div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* Stage 2: Required Spares */}
                <div className="flex-1 min-w-[100px] p-3 rounded-xl bg-purple-50 border border-purple-200/60 text-center flex flex-col justify-between">
                  <span className="text-[9px] font-black text-purple-700 uppercase tracking-wider block">Required Spares</span>
                  <div className="text-3xl font-black text-purple-600 py-1">{stats.awaitingApproval}</div>
                  <p className="text-[8px] text-purple-500 font-semibold">Awaiting customer approval</p>
                  <div className="w-full bg-purple-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-purple-500 h-1 rounded-full w-full"></div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* Stage 3: Repairing */}
                <div className="flex-1 min-w-[100px] p-3 rounded-xl bg-cyan-50 border border-cyan-200/60 text-center flex flex-col justify-between">
                  <span className="text-[9px] font-black text-cyan-700 uppercase tracking-wider block">Repairing</span>
                  <div className="text-3xl font-black text-cyan-600 py-1">{stats.underRepair}</div>
                  <p className="text-[8px] text-cyan-500 font-semibold">Active repair by engineer</p>
                  <div className="w-full bg-cyan-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-cyan-500 h-1 rounded-full w-full animate-pulse"></div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* Stage 4: Waiting Parts — flagged if > 0 */}
                <div className={`flex-1 min-w-[100px] p-3 rounded-xl border text-center flex flex-col justify-between relative ${stats.waitingParts > 0 ? 'bg-rose-50 border-rose-300/60' : 'bg-slate-50 border-slate-200/60'}`}>
                  {stats.waitingParts > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  )}
                  <span className={`text-[9px] font-black uppercase tracking-wider block ${stats.waitingParts > 0 ? 'text-rose-700' : 'text-slate-500'}`}>Waiting Parts</span>
                  <div className={`text-3xl font-black py-1 ${stats.waitingParts > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{stats.waitingParts}</div>
                  <p className={`text-[8px] font-semibold ${stats.waitingParts > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Blocked — parts on order</p>
                  <div className="w-full bg-rose-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className={`bg-rose-500 h-1 rounded-full w-full ${stats.waitingParts > 0 ? 'animate-pulse' : 'opacity-30'}`}></div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* Stage 5: QC Testing */}
                <div className="flex-1 min-w-[100px] p-3 rounded-xl bg-indigo-50 border border-indigo-200/60 text-center flex flex-col justify-between">
                  <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider block">QC Testing</span>
                  <div className="text-3xl font-black text-indigo-600 py-1">{stats.testing}</div>
                  <p className="text-[8px] text-indigo-500 font-semibold">Quality validation &amp; burn-in test</p>
                  <div className="w-full bg-indigo-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-indigo-500 h-1 rounded-full w-full"></div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* Stage 6: Final Verification & Payment Confirmation */}
                <div className="flex-1 min-w-[100px] p-3 rounded-xl bg-teal-50 border border-teal-200/60 text-center flex flex-col justify-between">
                  <span className="text-[9px] font-black text-teal-700 uppercase tracking-wider block">Final Verification &amp; Payment Confirmation</span>
                  <div className="text-3xl font-black text-teal-600 py-1">{stats.readyDispatch}</div>
                  <p className="text-[8px] text-teal-500 font-semibold">QC passed — awaiting payment/signing</p>
                  <div className="w-full bg-teal-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-teal-500 h-1 rounded-full w-full"></div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* Stage 7: Dispatching to Customer */}
                <div className="flex-1 min-w-[100px] p-3 rounded-xl bg-blue-50 border border-blue-200/60 text-center flex flex-col justify-between">
                  <span className="text-[9px] font-black text-blue-700 uppercase tracking-wider block">Dispatching to Customer</span>
                  <div className="text-3xl font-black text-blue-800 py-1">{stats.dispatched}</div>
                  <p className="text-[8px] text-blue-500 font-semibold">Handed over to customer/courier</p>
                  <div className="w-full bg-blue-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-blue-600 h-1 rounded-full w-full"></div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-1 text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* Stage 8: Successfully Repaired */}
                <div className="flex-1 min-w-[100px] p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-center flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Successfully Repaired</span>
                  <div className="text-3xl font-black text-slate-500 py-1">{stats.closed}</div>
                  <p className="text-[8px] text-slate-400 font-semibold">Job fully settled &amp; archived</p>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-slate-500 h-1 rounded-full w-full"></div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Engineer Productivity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                  <UserCheck className="h-4.5 w-4.5 text-blue-600" />
                  Repair Engineer Productivity
                </h3>
                <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">Activity indices</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 text-left">Engineer Profile</th>
                      <th className="pb-3 text-center">Inspections Completed</th>
                      <th className="pb-3 text-center">Repairs Logged</th>
                      <th className="pb-3 text-center">QC Burn-In Tests</th>
                      <th className="pb-3 text-right">Performance Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                    {stats.engineerProductivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">No active engineer logs found.</td>
                      </tr>
                    ) : (
                      stats.engineerProductivity.map((eng) => {
                        const totalActions = eng.inspectionsLogged + eng.repairsCompleted + eng.testsLogged;
                        const initials = eng.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        
                        return (
                          <tr key={eng.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="py-3.5 flex items-center gap-3">
                              <div className="h-8 w-8 rounded-xl bg-slate-900 text-white font-black text-[10px] tracking-wider flex items-center justify-center border border-slate-800 shadow-sm shadow-slate-900/10 group-hover:scale-105 transition-transform">
                                {initials}
                              </div>
                              <span className="font-bold text-slate-900 group-hover:text-cyan-600 transition-colors">{eng.name}</span>
                            </td>
                            <td className="py-3.5 text-center font-bold text-slate-600">{eng.inspectionsLogged}</td>
                            <td className="py-3.5 text-center text-cyan-600 font-black">{eng.repairsCompleted}</td>
                            <td className="py-3.5 text-center font-bold text-slate-600">{eng.testsLogged}</td>
                            <td className="py-3.5 text-right">
                              <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 border border-emerald-500/20 rounded-xl font-black shadow-sm text-[10px] tracking-wide uppercase">
                                {totalActions * 10} pts
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4 text-right">
              <Link to="/jobs" className="text-xs text-blue-600 font-black hover:text-blue-700 transition-colors hover:underline flex items-center justify-end gap-1">
                Open Full Active Job Queue &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: OPERATIONS QUEUE WITH SEARCH & FILTERS --- */}
      {currentTab === 'queue' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Active Inward Operations Feed</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Filter and search diagnostic tracks across queues.</p>
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'ENGINEER' && (
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setShowOnlyAssigned(true)}
                    className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
                      showOnlyAssigned 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    My Tasks Only
                  </button>
                  <button
                    onClick={() => setShowOnlyAssigned(false)}
                    className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
                      !showOnlyAssigned 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Available Work
                  </button>
                </div>
              )}
              <Link to="/jobs" className="text-xs font-black text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-lg border border-cyan-100 transition-colors">Manage All Repair Tickets</Link>
            </div>
          </div>

          {/* ADVANCED FILTERING ACTIONS BAR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Track ID, customer, serial..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              )}
            </div>

            {/* Status Queue Tabs */}
            <div className="flex bg-white p-1 rounded-lg border border-slate-200">
              {(['ALL', 'INSPECTION', 'REPAIR', 'TESTING', 'DISPATCH'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setQueueStatusFilter(tab)}
                  className={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-colors ${
                    queueStatusFilter === tab
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Priority filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                Priority:
              </span>
              <div className="flex flex-1 bg-white p-1 rounded-lg border border-slate-200">
                {(['ALL', 'URGENT', 'HIGH', 'NORMAL'] as const).map(prio => (
                  <button
                    key={prio}
                    onClick={() => setQueuePriorityFilter(prio)}
                    className={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-colors ${
                      queuePriorityFilter === prio
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {prio}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIVE QUEUE TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Track ID</th>
                  <th className="py-3 px-4">Customer Info</th>
                  <th className="py-3 px-4">Laser Source / Power</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                {getFilteredJobs().length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <AlertTriangle className="h-8 w-8 text-slate-300" />
                        <span>No active repair jobs match the filter constraints.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  getFilteredJobs().map((job) => {
                    const priority = getJobPriority(job);
                    return (
                      <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3.5 px-4 font-black text-cyan-600 group-hover:underline">
                          <Link to={`/jobs/${job.id}`}>{job.trackId}</Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{job.customer.companyName}</div>
                          <div className="text-[10px] text-slate-400">{job.customer.customerName}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{job.laserSource.brand}</div>
                          <div className="text-[10px] text-slate-400">Power: {job.laserSource.powerRating} | S/N: {job.laserSource.serialNumber}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider ${
                            job.status === 'RECEIVED' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            job.status === 'UNDER_REPAIR' ? 'bg-cyan-50 text-cyan-700 border border-cyan-100' :
                            job.status === 'WAITING_SPARE_PARTS' ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse' :
                            job.status === 'TESTING_BURN_IN' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            job.status === 'READY_FOR_DISPATCH' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {job.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase ${
                            priority === 'URGENT' ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/10' :
                            priority === 'HIGH' ? 'bg-amber-500 text-white shadow-sm' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase border ${
                            job.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            job.paymentStatus === 'PARTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {job.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => navigate(`/jobs/${job.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-cyan-600 text-white rounded-lg transition-colors font-bold text-[11px]"
                          >
                            Execute
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 3: DIAGNOSTIC TELEMETRY CALIBRATOR --- */}
      {currentTab === 'telemetry' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Controls & sliders */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Calibration Loop Sweeper</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Control live current sweeps and temperature thresholds.</p>
            </div>

            {/* Trigger Button */}
            <button
              onClick={runDiagnostics}
              disabled={diagnosticState === 'scanning'}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                diagnosticState === 'scanning'
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
              }`}
            >
              <Play className={`h-4.5 w-4.5 ${diagnosticState === 'scanning' ? 'animate-spin' : ''}`} />
              {diagnosticState === 'scanning' ? 'Sweeping Diode Loops...' : 'Initiate Optical Sweep Calibration'}
            </button>

            {/* Slider Dials */}
            <div className="border-t border-slate-100 pt-4 space-y-5">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                Manual Telemetry Knobs
              </h4>
              
              {/* Diode Limit */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Current Sweep Max:</span>
                  <span className="text-slate-950 font-black">{diodeLimit} A</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={diodeLimit}
                  onChange={(e) => setDiodeLimit(parseInt(e.target.value))}
                  disabled={diagnosticState === 'scanning'}
                  className="w-full cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none" 
                />
              </div>

              {/* Water flow slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Chiller Flow Rate:</span>
                  <span className="text-slate-950 font-black">{coolantFlow} L/min</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="25" 
                  step="0.5"
                  value={coolantFlow}
                  onChange={(e) => setCoolantFlow(parseFloat(e.target.value))}
                  disabled={diagnosticState === 'scanning'}
                  className="w-full cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none" 
                />
              </div>

              {/* Temp threshold dial */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Thermal Alarm Limit:</span>
                  <span className="text-rose-600 font-black">{tempThreshold} °C</span>
                </div>
                <input 
                  type="range" 
                  min="30" 
                  max="50" 
                  value={tempThreshold}
                  onChange={(e) => setTempThreshold(parseInt(e.target.value))}
                  disabled={diagnosticState === 'scanning'}
                  className="w-full cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none" 
                />
              </div>
            </div>

            {/* Readout stats */}
            <div className="border-t border-slate-100 pt-4 space-y-3 font-semibold text-xs text-slate-500">
              <div className="flex justify-between items-center">
                <span>Active Diode Current:</span>
                <span className="text-slate-900 font-bold">{telemetry.current} A</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Active Laser Output:</span>
                <span className="text-slate-900 font-bold">{telemetry.power} W</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Diode Mean Temp:</span>
                <span className={`font-bold ${telemetry.temp > tempThreshold ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}>{telemetry.temp} °C</span>
              </div>
              <div className="flex justify-between items-center">
                <span>QBH Fiber Back-Reflect:</span>
                <span className={`font-bold ${telemetry.reflection > 0.12 ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}>{telemetry.reflection} %</span>
              </div>
            </div>
          </div>

          {/* Interactive Plotter and Diode array */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Realtime Waveform Graph View */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-900 shadow-xl relative overflow-hidden h-72 flex flex-col justify-between">
              {/* Decorative scanner sweep line */}
              {diagnosticState === 'scanning' && (
                <div className="absolute left-0 right-0 h-0.5 bg-cyan-400/50 shadow-md shadow-cyan-400/80 scanner-line"></div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black font-mono text-cyan-400 tracking-widest flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                  DUAL-SIGNAL TRACE SWEEPER
                </span>
                <div className="flex gap-3 text-[9px] font-mono text-slate-400">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 bg-cyan-400 rounded-full"></span>Diode (A)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 bg-rose-500 rounded-full"></span>Reflection (%)</span>
                </div>
              </div>

              {/* Wave SVG */}
              <div className="flex-1 w-full relative mt-3">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                  {/* Grid Lines */}
                  <line x1="0" y1="40" x2="500" y2="40" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="125" y1="0" x2="125" y2="160" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="250" y1="0" x2="250" y2="160" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="375" y1="0" x2="375" y2="160" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />

                  {/* Signal Paths */}
                  {traceHistory.length > 1 && (() => {
                    const widthStep = 500 / 30;
                    // Current maps to Y: 160 - (current / 100) * 140
                    const currentPoints = traceHistory.map((p, i) => `${i * widthStep},${160 - (p.current / 100) * 140}`);
                    // Reflection maps to Y: 160 - (reflection / 0.25) * 140
                    const reflectionPoints = traceHistory.map((p, i) => `${i * widthStep},${160 - (p.reflection / 0.25) * 140}`);

                    return (
                      <>
                        <path d={`M ${currentPoints.join(' L ')}`} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
                        <path d={`M ${reflectionPoints.join(' L ')}`} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="border-t border-slate-900 pt-2 flex justify-between items-center text-[9px] font-mono text-slate-500">
                <span>Calibration Limit: {diodeLimit}A</span>
                <span>Signal rate: 100ms/pt</span>
              </div>
            </div>

            {/* 2D Diode Core Thermal Grid Array & Console Ticker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Diode array */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Core Diode Thermal Matrix
                  </h4>
                  <span className="text-[9px] font-mono text-slate-400">4x4 Arrays</span>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {diodeArrayTemps.map((temp, idx) => {
                    let glowClass = 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20 glow-diode-cyan';
                    if (temp > tempThreshold) {
                      glowClass = 'bg-rose-500/20 text-rose-600 border-rose-500/40 glow-diode-red';
                    } else if (temp > 33.0) {
                      glowClass = 'bg-amber-500/10 text-amber-600 border-amber-500/20 glow-diode-amber';
                    }

                    return (
                      <div 
                        key={idx} 
                        className={`h-11 rounded-lg border flex flex-col justify-center items-center font-mono text-[9px] transition-all duration-300 ${glowClass}`}
                      >
                        <span className="font-extrabold text-[8px] opacity-70">CH-{idx+1}</span>
                        <span className="font-black text-[10px] mt-0.5">{temp}°</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calibrator logs console */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-900 shadow-xl flex flex-col justify-between h-56 font-mono text-[10px] leading-relaxed text-slate-300">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-[9px] font-black text-slate-400 flex items-center gap-1"><Terminal className="h-3 w-3 text-cyan-400" />DIAGNOSTICS LOG FEED</span>
                  <span className="text-[9px] text-slate-500">{diagnosticState.toUpperCase()}</span>
                </div>
                <div className="flex-1 overflow-y-auto mt-2 space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
                  <p className="text-slate-500">// Sweep telemetry online. Waiting sweep call.</p>
                  {diagnosticLogs.map((log, idx) => {
                    let color = 'text-cyan-400';
                    if (log.startsWith('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                    else if (log.startsWith('[CRITICAL')) color = 'text-rose-500 animate-pulse font-black';
                    else if (log.startsWith('[WARNING]')) color = 'text-amber-500 font-bold';
                    return <p key={idx} className={color}>{log}</p>;
                  })}
                  {diagnosticState === 'scanning' && <span className="inline-block h-3.5 w-1.5 bg-cyan-400 animate-pulse"></span>}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* --- TAB 4: AI PREDICTIVE MAINTENANCE WIZARD --- */}
      {currentTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Brand selectors */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Predictive Maintenance Analysis</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Generate real-time failure breakdowns based on machine history.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Laser Brand</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-cyan-500"
                >
                  <option value="Raycus">Raycus Electronics</option>
                  <option value="IPG">IPG Photonics</option>
                  <option value="JPT">JPT Electronics</option>
                  <option value="Max">Maxphotonics</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Output Power</label>
                <select
                  value={selectedPower}
                  onChange={(e) => setSelectedPower(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-cyan-500"
                >
                  <option value="1.5kW">1.5 kW Single-Module</option>
                  <option value="2kW">2.0 kW Single-Module</option>
                  <option value="3kW">3.0 kW Multi-Module</option>
                  <option value="4kW">4.0 kW Multi-Module</option>
                  <option value="6kW">6.0 kW Multi-Module</option>
                </select>
              </div>
            </div>

            <button
              onClick={runAIWizard}
              disabled={isAnalyzingAI}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                isAnalyzingAI
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20'
              }`}
            >
              <Brain className={`h-4.5 w-4.5 ${isAnalyzingAI ? 'animate-bounce' : ''}`} />
              {isAnalyzingAI ? 'Calculating Risk Models...' : 'Run Diagnostics Analysis'}
            </button>
          </div>

          {/* AI Result reports */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[300px]">
            {isAnalyzingAI ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 font-mono text-[11px] text-slate-500 space-y-4">
                <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-b-transparent animate-spin"></div>
                <div className="text-center space-y-1">
                  {aiAnalysisLogs.map((log, idx) => (
                    <p key={idx} className="text-indigo-600 font-bold">{log}</p>
                  ))}
                </div>
              </div>
            ) : aiReport ? (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h4 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
                    AI Failure Analysis Report: {selectedBrand} {selectedPower}
                  </h4>
                  <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm ${
                    aiReport.risk === 'CRITICAL' ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' :
                    aiReport.risk === 'HIGH' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                    aiReport.risk === 'MODERATE' ? 'bg-cyan-100 text-cyan-700 border border-cyan-200' :
                    'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {aiReport.risk} RISK LEVEL
                  </span>
                </div>

                {/* Subsystem breakdowns risk bar-chart */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Failure Subsystem Probabilities</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fiber QBH */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>QBH Fiber Output Connector:</span>
                        <span className="font-extrabold">{aiReport.breakdown.fiber}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${aiReport.breakdown.fiber}%` }}></div>
                      </div>
                    </div>

                    {/* Combiner Fusion */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>Combiner Splice/Containment:</span>
                        <span className="font-extrabold">{aiReport.breakdown.combiner}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${aiReport.breakdown.combiner}%` }}></div>
                      </div>
                    </div>

                    {/* Diode Modules */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>Diode Pump Modules:</span>
                        <span className="font-extrabold">{aiReport.breakdown.diode}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${aiReport.breakdown.diode}%` }}></div>
                      </div>
                    </div>

                    {/* Cooling System */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>Water Cooling & Seals:</span>
                        <span className="font-extrabold">{aiReport.breakdown.cooling}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${aiReport.breakdown.cooling}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations list */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                  <h5 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    Recommended Diagnostics Actions
                  </h5>
                  <ul className="space-y-2 text-xs font-semibold text-slate-700">
                    {aiReport.checklist.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-600 mt-0.5 font-bold">&bull;</span>
                        <p className="leading-relaxed text-slate-800">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Brain className="h-10 w-10 text-slate-300 animate-pulse" />
                <div>
                  <h4 className="font-black text-slate-800 text-sm">Predictive System Ready</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Select a laser profile on the left and run analysis to compile failure risks.</p>
                </div>
              </div>
            )}
            
            {/* Auto-compiled trend insight snippet */}
            {insights && insights.insights && !isAnalyzingAI && !aiReport && (
              <div className="border-t border-slate-100 pt-4 mt-6">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Brain className="h-3.5 w-3.5 text-blue-500" />Historical Trend Summary</h5>
                <div className="p-3 bg-cyan-50/50 border border-cyan-100/50 rounded-xl flex items-start gap-2.5 text-xs text-slate-700 font-semibold leading-relaxed">
                  <span>&bull;</span>
                  <p>{insights.insights[0] || 'Historical laser repair databases are aligned. No repeat alarm triggers this week.'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
