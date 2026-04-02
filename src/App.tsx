import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useStore } from './store';
import { NeuroCanvas } from './components/NeuroCanvas';
import { 
  Activity, 
  Cpu, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  Terminal,
  BrainCircuit,
  Zap,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const { nodes, tasks, metrics, setSystemState } = useStore();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const socket = io();

    socket.on('state_update', (data) => {
      setSystemState(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [setSystemState]);

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-logs');
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - Metrics */}
      <div className="w-80 h-full border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <BrainCircuit className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">NeuroFlow</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Distributed Intelligence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <MetricCard 
            label="Avg System Load" 
            value={`${Math.round(metrics.avgLoad * 100)}%`} 
            icon={<Cpu className="w-4 h-4" />}
            color="text-blue-400"
          />
          <MetricCard 
            label="Tasks Completed" 
            value={metrics.completed} 
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="text-emerald-400"
          />
          <MetricCard 
            label="System Failures" 
            value={metrics.failures} 
            icon={<AlertTriangle className="w-4 h-4" />}
            color="text-rose-400"
          />
          <MetricCard 
            label="Active Tasks" 
            value={tasks.filter(t => t.status === 'running').length} 
            icon={<Activity className="w-4 h-4" />}
            color="text-amber-400"
          />
        </div>

        <div className="mt-auto">
          <button 
            onClick={runAIAnalysis}
            disabled={isAnalyzing}
            className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-900/20"
          >
            {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            AI Root Cause Analysis
          </button>
        </div>
      </div>

      {/* Main View - 3D Visualization */}
      <div className="flex-1 relative">
        <NeuroCanvas />
        
        {/* Overlay - Task Queue */}
        <div className="absolute bottom-6 left-6 right-6 h-48 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Real-time Task Stream</h2>
          </div>
          <div className="grid grid-cols-4 gap-4 overflow-y-auto h-32 pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "p-3 rounded-lg border text-xs flex flex-col gap-1",
                    task.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    task.status === 'failed' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                    task.status === 'running' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                    "bg-slate-800/50 border-slate-700 text-slate-400"
                  )}
                >
                  <div className="flex justify-between font-mono">
                    <span>{task.id.split('-')[1]}</span>
                    <span className="uppercase font-bold">{task.status}</span>
                  </div>
                  <div className="flex justify-between opacity-70">
                    <span>Complexity: {task.complexity.toFixed(2)}</span>
                    <span>Node: {task.assignedTo || 'N/A'}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* AI Analysis Modal */}
        <AnimatePresence>
          {analysis && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-6 right-6 w-96 max-h-[80%] bg-slate-900/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-20"
            >
              <div className="p-4 bg-violet-600/20 border-b border-violet-500/30 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-violet-400" />
                  <span className="font-bold">AI Observability Report</span>
                </div>
                <button onClick={() => setAnalysis(null)} className="text-slate-400 hover:text-white transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto text-sm leading-relaxed text-slate-300 prose prose-invert prose-violet">
                {analysis}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col gap-2">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className={cn("text-2xl font-bold tracking-tight", color)}>
        {value}
      </div>
    </div>
  );
}
