import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as tf from "@tensorflow/tfjs";
import { GoogleGenAI } from "@google/genai";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;

// --- Simulation Constants ---
const NUM_NODES = 8;
const TICK_RATE = 1000; // 1 second

// --- Types ---
interface NodeAgent {
  id: string;
  status: "idle" | "busy" | "failed";
  load: number; // 0 to 1
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
  startTime?: number;
  duration?: number;
}

// --- State ---
let nodes: NodeAgent[] = Array.from({ length: NUM_NODES }, (_, i) => ({
  id: `node-${i}`,
  status: "idle",
  load: 0,
  capacity: Math.random() * 0.5 + 0.5,
  tasksCompleted: 0,
  failures: 0,
  position: [
    Math.cos((i / NUM_NODES) * Math.PI * 2) * 5,
    Math.sin((i / NUM_NODES) * Math.PI * 2) * 5,
    0
  ]
}));

let tasks: Task[] = [];
let historicalData: any[] = [];
let model: tf.LayersModel | null = null;

// --- Neural Network Predictor ---
async function initPredictor() {
  const m = tf.sequential();
  m.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [2] })); // [load, complexity]
  m.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  m.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // Failure probability
  m.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' });
  model = m;
  console.log("Neural Network initialized.");
}

async function predictFailure(load: number, complexity: number): Promise<number> {
  if (!model) return 0.1;
  const input = tf.tensor2d([[load, complexity]]);
  const prediction = model.predict(input) as tf.Tensor;
  const val = (await prediction.data())[0];
  input.dispose();
  prediction.dispose();
  return val;
}

// --- RL Agent (Simple Q-Learning Simulation) ---
// State: [Node Index, Node Load]
// Action: Assign to Node
let qTable: Record<string, number> = {};

function getBestAction(task: Task): string {
  // Epsilon-greedy assignment
  if (Math.random() < 0.1) {
    return nodes[Math.floor(Math.random() * nodes.length)].id;
  }

  let bestNode = nodes[0].id;
  let minLoad = Infinity;

  // Simple heuristic for now: least load
  for (const node of nodes) {
    if (node.status !== "failed" && node.load < minLoad) {
      minLoad = node.load;
      bestNode = node.id;
    }
  }
  return bestNode;
}

// --- Simulation Loop ---
async function simulationTick() {
  // 1. Generate new tasks
  if (Math.random() < 0.4) {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      complexity: Math.random(),
      priority: Math.floor(Math.random() * 3),
      status: "pending"
    };
    tasks.push(newTask);
  }

  // 2. Assign pending tasks
  const pendingTasks = tasks.filter(t => t.status === "pending");
  for (const task of pendingTasks) {
    const nodeId = getBestAction(task);
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.status !== "failed") {
      task.status = "running";
      task.assignedTo = nodeId;
      task.startTime = Date.now();
      task.duration = Math.floor(task.complexity * 5000) + 1000;
      node.status = "busy";
      node.load += task.complexity * 0.2;
    }
  }

  // 3. Update running tasks
  const now = Date.now();
  for (const task of tasks.filter(t => t.status === "running")) {
    if (task.startTime && task.duration && now - task.startTime > task.duration) {
      const node = nodes.find(n => n.id === task.assignedTo);
      
      // Predict failure based on load
      const failProb = await predictFailure(node?.load || 0, task.complexity);
      const failed = Math.random() < failProb;

      if (failed) {
        task.status = "failed";
        if (node) {
          node.failures++;
          node.status = "failed"; // Node crashes on failure for simulation
          setTimeout(() => { if(node) node.status = "idle"; }, 3000); // Recovery
        }
      } else {
        task.status = "completed";
        if (node) {
          node.tasksCompleted++;
          node.load = Math.max(0, node.load - task.complexity * 0.2);
          if (node.load < 0.1) node.status = "idle";
        }
      }

      // Store historical data for retraining
      historicalData.push({
        load: node?.load || 0,
        complexity: task.complexity,
        failed: failed ? 1 : 0
      });

      // Retrain model if enough data
      if (historicalData.length > 50 && historicalData.length % 20 === 0) {
        const inputs = tf.tensor2d(historicalData.map(d => [d.load, d.complexity]));
        const labels = tf.tensor2d(historicalData.map(d => [d.failed]));
        await model?.fit(inputs, labels, { epochs: 1 });
        inputs.dispose();
        labels.dispose();
      }
    }
  }

  // Cleanup old tasks
  if (tasks.length > 100) {
    tasks = tasks.slice(-50);
  }

  // Broadcast state
  io.emit("state_update", {
    nodes,
    tasks: tasks.slice(-20),
    metrics: {
      totalTasks: tasks.length,
      completed: nodes.reduce((acc, n) => acc + n.tasksCompleted, 0),
      failures: nodes.reduce((acc, n) => acc + n.failures, 0),
      avgLoad: nodes.reduce((acc, n) => acc + n.load, 0) / nodes.length
    }
  });
}

// --- LLM Log Analysis ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.get("/api/analyze-logs", async (req, res) => {
  try {
    const recentFailures = historicalData.filter(d => d.failed === 1).slice(-5);
    const prompt = `Analyze these system logs from NeuroFlow Distributed Platform:
    ${JSON.stringify(recentFailures)}
    Provide a root cause analysis and optimization strategy.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    res.json({ analysis: response.text });
  } catch (error) {
    res.status(500).json({ error: "AI Analysis failed" });
  }
});

// --- Server Setup ---
async function startServer() {
  await initPredictor();
  setInterval(simulationTick, TICK_RATE);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`NeuroFlow Server running on http://localhost:${PORT}`);
  });
}

startServer();
