import { create } from 'zustand';

interface NodeAgent {
  id: string;
  status: "idle" | "busy" | "failed";
  load: number;
  capacity: number;
  tasksCompleted: number;
  failures: number;
  position: [number, number, number];
}

interface Task {
  id: string;
  complexity: number;
  priority: number;
  status: "pending" | "running" | "completed" | "failed";
  assignedTo?: string;
}

interface Metrics {
  totalTasks: number;
  completed: number;
  failures: number;
  avgLoad: number;
}

interface SystemState {
  nodes: NodeAgent[];
  tasks: Task[];
  metrics: Metrics;
  setSystemState: (state: Partial<SystemState>) => void;
}

export const useStore = create<SystemState>((set) => ({
  nodes: [],
  tasks: [],
  metrics: {
    totalTasks: 0,
    completed: 0,
    failures: 0,
    avgLoad: 0
  },
  setSystemState: (state) => set((prev) => ({ ...prev, ...state })),
}));
