'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Design: OpenClaw Integration-Ready Virtual Office ──────────────────────
// Agents ONLY move when their task changes. Pure percentage positioning
// ensures agents always appear at the correct furniture location.

const ROOM_BG = "https://files.manuscdn.com/user_upload_by_module/session_file/107630172/PGkjOHGohwPsWfAP.png";

// ─── Types ──────────────────────────────────────────────────────────────────

type TaskType = "coding" | "research" | "writing" | "planning" | "security" | "break" | "coffee" | "gaming" | "idle";
type AgentStatus = "active" | "chatting" | "idle";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  task: string;
  taskType: TaskType;
  color: string;
  station: string;
  joinedAt?: number;
  taskHistory?: { task: string; taskType: TaskType; startTime: number; duration: number }[];
  totalTokens?: number;
}

// ─── Station Positions ──────────────────────────────────────────────────────
// Pure percentage coordinates relative to the room image.

const STATIONS: Record<string, { x: number; y: number; label: string }> = {
  deskLeftWall:     { x: 23, y: 53, label: "Left Wall Desk" },
  deskCenterLeft:   { x: 38, y: 44, label: "Center-Left Desk" },
  deskCenterRight:  { x: 55, y: 42, label: "Center-Right Desk" },
  deskFrontLeft:    { x: 32, y: 57, label: "Front-Left Desk" },
  securityDesk:     { x: 77, y: 47, label: "Security Station" },
  tvCouchLeft:      { x: 41, y: 73, label: "TV Couch Left" },
  tvCouchRight:     { x: 47, y: 73, label: "TV Couch Right" },
  beanBagPurple:    { x: 62, y: 42, label: "Purple Bean Bag" },
  beanBagPink:      { x: 55, y: 53, label: "Pink Bean Bag" },
  beanBagBlue:      { x: 59, y: 58, label: "Blue Bean Bag" },
  beanBagGreen:     { x: 65, y: 52, label: "Green Bean Bag" },
  coffeeBar:        { x: 59, y: 46, label: "Coffee Machine" },
};

// ─── Task-Type → Station Mapping ────────────────────────────────────────────

const TASK_STATION_MAP: Record<string, string[]> = {
  coding:   ["deskCenterLeft", "deskCenterRight", "deskFrontLeft", "deskLeftWall"],
  research: ["deskCenterLeft", "deskCenterRight", "deskFrontLeft"],
  writing:  ["deskLeftWall", "deskFrontLeft"],
  planning: ["beanBagPurple", "beanBagPink", "beanBagBlue", "beanBagGreen"],
  security: ["securityDesk"],
  break:    ["tvCouchLeft", "tvCouchRight", "beanBagPurple", "beanBagPink", "beanBagBlue", "beanBagGreen"],
  coffee:   ["coffeeBar"],
  gaming:   ["tvCouchLeft", "tvCouchRight"],
  idle:     ["tvCouchLeft", "tvCouchRight", "beanBagPurple", "beanBagPink", "beanBagBlue", "beanBagGreen"],
};

function pickStation(taskType: TaskType, occupiedStations: Set<string>): string {
  const candidates = TASK_STATION_MAP[taskType] || ["deskCenterLeft"];
  const free = candidates.filter((s) => !occupiedStations.has(s));
  const pool = free.length > 0 ? free : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

function statusForTaskType(taskType: TaskType): AgentStatus {
  switch (taskType) {
    case "coding": case "research": case "writing": case "security":
      return "active";
    case "planning":
      return "chatting";
    case "break": case "coffee": case "gaming": case "idle":
      return "idle";
    default:
      return "active";
  }
}

// ─── Default Agents ─────────────────────────────────────────────────────────

const DEFAULT_AGENTS: Agent[] = [
  { id: "athena",     name: "Athena",     role: "Manager",    status: "active",   task: "Reviewing reports",  taskType: "research",  color: "#06b6d4", station: "deskCenterLeft" },
  { id: "builder",    name: "Builder",    role: "Developer",  status: "active",   task: "Writing code",       taskType: "coding",    color: "#3b82f6", station: "deskCenterRight" },
  { id: "writer",     name: "Writer",     role: "Content",    status: "active",   task: "Drafting article",   taskType: "writing",   color: "#8b5cf6", station: "deskFrontLeft" },
  { id: "researcher", name: "Researcher", role: "Analyst",    status: "active",   task: "Gathering data",     taskType: "research",  color: "#06b6d4", station: "deskLeftWall" },
  { id: "strategist", name: "Strategist", role: "Planner",    status: "chatting", task: "Campaign planning",  taskType: "planning",  color: "#a855f7", station: "beanBagPurple" },
  { id: "security",   name: "Security",   role: "Guard",      status: "active",   task: "Security audit",     taskType: "security",  color: "#6b7280", station: "securityDesk" },
];

// ─── Demo Simulation Task Queues ────────────────────────────────────────────

interface SimTask { task: string; taskType: TaskType; durationSec: number; }

const SIM_QUEUES: Record<string, SimTask[]> = {
  athena: [
    { task: "Reviewing reports",   taskType: "research", durationSec: 25 },
    { task: "Team standup",        taskType: "planning", durationSec: 20 },
    { task: "Approving PRs",       taskType: "coding",   durationSec: 30 },
    { task: "Coffee break",        taskType: "coffee",   durationSec: 15 },
    { task: "Strategic planning",  taskType: "planning", durationSec: 25 },
    { task: "Relaxing",            taskType: "gaming",   durationSec: 20 },
  ],
  builder: [
    { task: "Writing code",         taskType: "coding",   durationSec: 35 },
    { task: "Debugging issue",      taskType: "coding",   durationSec: 25 },
    { task: "Code review",          taskType: "coding",   durationSec: 20 },
    { task: "Coffee break",         taskType: "coffee",   durationSec: 15 },
    { task: "Architecture planning", taskType: "planning", durationSec: 20 },
    { task: "Playing games",        taskType: "gaming",   durationSec: 20 },
  ],
  writer: [
    { task: "Drafting article",    taskType: "writing",  durationSec: 30 },
    { task: "Editing copy",        taskType: "writing",  durationSec: 25 },
    { task: "Brainstorming ideas", taskType: "planning", durationSec: 20 },
    { task: "Coffee break",        taskType: "coffee",   durationSec: 15 },
    { task: "SEO research",        taskType: "research", durationSec: 25 },
  ],
  researcher: [
    { task: "Gathering data",       taskType: "research", durationSec: 30 },
    { task: "Analyzing trends",     taskType: "research", durationSec: 35 },
    { task: "Building dashboard",   taskType: "coding",   durationSec: 25 },
    { task: "Coffee break",         taskType: "coffee",   durationSec: 15 },
    { task: "Writing report",       taskType: "writing",  durationSec: 25 },
  ],
  strategist: [
    { task: "Campaign planning",   taskType: "planning", durationSec: 30 },
    { task: "Market research",     taskType: "research", durationSec: 25 },
    { task: "Strategy session",    taskType: "planning", durationSec: 25 },
    { task: "Coffee break",        taskType: "coffee",   durationSec: 15 },
    { task: "Competitor analysis", taskType: "research", durationSec: 30 },
  ],
  security: [
    { task: "Security audit",      taskType: "security", durationSec: 35 },
    { task: "Monitoring logs",     taskType: "security", durationSec: 30 },
    { task: "Vulnerability scan",  taskType: "security", durationSec: 25 },
    { task: "Coffee break",        taskType: "coffee",   durationSec: 15 },
    { task: "Updating firewall",   taskType: "security", durationSec: 30 },
  ],
};

// ─── OpenClaw API Fetching ──────────────────────────────────────────────────

function detectTaskType(taskName: string): TaskType {
  const lower = taskName.toLowerCase();
  if (lower.includes("code") || lower.includes("debug") || lower.includes("build")) return "coding";
  if (lower.includes("research") || lower.includes("data") || lower.includes("analyz")) return "research";
  if (lower.includes("write") || lower.includes("draft") || lower.includes("edit")) return "writing";
  if (lower.includes("plan") || lower.includes("strategy") || lower.includes("meeting")) return "planning";
  if (lower.includes("security") || lower.includes("audit") || lower.includes("monitor")) return "security";
  if (lower.includes("coffee") || lower.includes("break")) return "coffee";
  if (lower.includes("game") || lower.includes("relax")) return "gaming";
  return "idle";
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [time, setTime] = useState(new Date());
  const [simulationOn, setSimulationOn] = useState(true);
  const [eventLog, setEventLog] = useState<{ time: string; text: string }[]>([]);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [departingAgents, setDepartingAgents] = useState<Set<string>>(new Set());
  const [stationCoords, setStationCoords] = useState<Record<string, { x: number; y: number }>>(() => {
    if (typeof window === 'undefined') return { ...STATIONS };
    try {
      const saved = localStorage.getItem('virtualOfficeStations');
      return saved ? JSON.parse(saved) : { ...STATIONS };
    } catch {
      return { ...STATIONS };
    }
  });
  const [editingStation, setEditingStation] = useState<string | null>(null);
  const [editX, setEditX] = useState('');
  const [editY, setEditY] = useState('');
  const simIndexRef = useRef<Record<string, number>>({});
  const taskHistoryRef = useRef<Record<string, Agent['taskHistory']>>({});

  // ── Log helper ──
  const addLog = useCallback((text: string) => {
    const now = new Date().toLocaleTimeString();
    setEventLog((prev) => [{ time: now, text }, ...prev].slice(0, 50));
  }, []);

  // ── Calibration: click-to-edit ──
  const handleClickStation = useCallback((key: string) => {
    const c = stationCoords[key];
    setEditingStation(key);
    setEditX(String(Math.round(c.x)));
    setEditY(String(Math.round(c.y)));
  }, [stationCoords]);

  const handleSaveCoords = useCallback(() => {
    if (!editingStation) return;
    const nx = parseFloat(editX);
    const ny = parseFloat(editY);
    if (isNaN(nx) || isNaN(ny) || nx < 0 || nx > 100 || ny < 0 || ny > 100) return;
    setStationCoords(prev => {
      const updated = { ...prev, [editingStation]: { x: nx, y: ny } };
      localStorage.setItem('virtualOfficeStations', JSON.stringify(updated));
      return updated;
    });
    setAgents(prev => prev.map(a => a.station === editingStation ? { ...a } : a));
    addLog(`Moved ${editingStation} to (${nx}, ${ny})`);
    setEditingStation(null);
  }, [editingStation, editX, editY, addLog]);

  // ── Core API: updateAgent ──
  const updateAgent = useCallback(
    (id: string, update: { task?: string; taskType?: TaskType; status?: AgentStatus }) => {
      setAgents((prev) => {
        const occupiedStations = new Set(prev.filter((a) => a.id !== id).map((a) => a.station));
        return prev.map((a) => {
          if (a.id !== id) return a;
          const newTaskType = update.taskType ?? a.taskType;
          const newTask = update.task ?? a.task;
          const newStatus = update.status ?? statusForTaskType(newTaskType);
          const shouldMove = newTaskType !== a.taskType;
          const newStation = (a.id === 'security') ? 'securityDesk' : (shouldMove ? pickStation(newTaskType, occupiedStations) : a.station);
          if (shouldMove) {
            addLog(`${a.name} → ${STATIONS[newStation]?.label || newStation} (${newTask})`);
            if (!taskHistoryRef.current[id]) taskHistoryRef.current[id] = [];
            taskHistoryRef.current[id]!.push({
              task: a.task,
              taskType: a.taskType,
              startTime: Date.now(),
              duration: 0,
            });
          }
          return { ...a, task: newTask, taskType: newTaskType, status: newStatus, station: newStation, taskHistory: taskHistoryRef.current[id] };
        });
      });
    },
    [addLog]
  );

  // ── Core API: addAgent ──
  const addAgent = useCallback(
    (agent: { id: string; name: string; role: string; color?: string; task?: string; taskType?: TaskType }) => {
      setAgents((prev) => {
        if (prev.find((a) => a.id === agent.id)) {
          return prev.map((a) =>
            a.id === agent.id
              ? { ...a, name: agent.name, role: agent.role, color: agent.color ?? a.color }
              : a
          );
        }
        const occupiedStations = new Set(prev.map((a) => a.station));
        const taskType = agent.taskType ?? "idle";
        const station = pickStation(taskType, occupiedStations);
        if (!taskHistoryRef.current[agent.id]) taskHistoryRef.current[agent.id] = [];
        const newAgent: Agent = {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          color: agent.color ?? "#06b6d4",
          task: agent.task ?? "Joining the team",
          taskType,
          status: statusForTaskType(taskType),
          station,
          joinedAt: Date.now(),
          taskHistory: taskHistoryRef.current[agent.id],
          totalTokens: 0,
        };
        addLog(`${newAgent.name} joined the office`);
        return [...prev, newAgent];
      });
    },
    [addLog]
  );

  // ── Core API: removeAgent ──
  const removeAgent = useCallback(
    (id: string) => {
      setDepartingAgents((prev) => new Set(Array.from(prev).concat(id)));
      setTimeout(() => {
        setAgents((prev) => {
          const agent = prev.find((a) => a.id === id);
          if (agent) addLog(`${agent.name} left the office`);
          return prev.filter((a) => a.id !== id);
        });
        setDepartingAgents((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 600);
    },
    [addLog]
  );

  // ── Core API: getAgents ──
  const getAgents = useCallback(() => agents, [agents]);

  // ── Expose global API for OpenClaw ──
  useEffect(() => {
    (window as any).VirtualOffice = {
      updateAgent,
      addAgent,
      removeAgent,
      getAgents,
      updateAllAgents: (updates: { id: string; task: string; taskType: TaskType; status?: AgentStatus }[]) => {
        updates.forEach((u) => updateAgent(u.id, u));
      },
      setAgents: (newAgents: { id: string; name: string; role: string; color?: string; task?: string; taskType?: TaskType }[]) => {
        setAgents([]);
        setTimeout(() => { newAgents.forEach((a) => addAgent(a)); }, 100);
      },
    };
    return () => { delete (window as any).VirtualOffice; };
  }, [updateAgent, addAgent, removeAgent, getAgents]);

  // ── Clock ──
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── OpenClaw Integration: Poll for real agent data ──
  useEffect(() => {
    const pollOpenClaw = async () => {
      try {
        const res = await fetch('/api/sessions');
        if (!res.ok) return;
        const sessions = await res.json();
        if (!Array.isArray(sessions) || sessions.length === 0) return;

        const colors = ["#06b6d4", "#3b82f6", "#8b5cf6", "#a855f7", "#ec4899", "#f97316"];
        const occupiedStations = new Set<string>();

        const openClawAgents: Agent[] = sessions.map((session: any, idx: number) => {
          const taskName = session.current_task || session.task || "Idle";
          const taskType = detectTaskType(taskName);
          const station = pickStation(taskType, occupiedStations);
          occupiedStations.add(station);

          return {
            id: session.id || session.key || `session-${idx}`,
            name: session.agent_name || session.name || `Agent ${idx + 1}`,
            role: session.role || "OpenClaw Agent",
            status: statusForTaskType(taskType),
            task: taskName,
            taskType,
            color: colors[idx % colors.length],
            station,
            joinedAt: Date.now(),
            taskHistory: [],
            totalTokens: 0,
          };
        });

        if (openClawAgents.length > 0) {
          setAgents(openClawAgents);
        }
      } catch {
        // Silently fail — keep existing agents
      }
    };

    const interval = setInterval(pollOpenClaw, 15000);
    pollOpenClaw();
    return () => clearInterval(interval);
  }, []);

  // ── Demo Simulation ──
  useEffect(() => {
    if (!simulationOn) return;
    DEFAULT_AGENTS.forEach((a) => {
      if (simIndexRef.current[a.id] === undefined) simIndexRef.current[a.id] = 0;
    });
    const timers: ReturnType<typeof setTimeout>[] = [];
    function scheduleNext(agentId: string) {
      const queue = SIM_QUEUES[agentId];
      if (!queue) return;
      const idx = simIndexRef.current[agentId] ?? 0;
      const nextIdx = (idx + 1) % queue.length;
      simIndexRef.current[agentId] = nextIdx;
      const nextTask = queue[nextIdx];
      updateAgent(agentId, { task: nextTask.task, taskType: nextTask.taskType });
      const timer = setTimeout(() => scheduleNext(agentId), nextTask.durationSec * 1000);
      timers.push(timer);
    }
    DEFAULT_AGENTS.forEach((a, i) => {
      const queue = SIM_QUEUES[a.id];
      if (!queue) return;
      const firstTask = queue[0];
      const timer = setTimeout(() => scheduleNext(a.id), firstTask.durationSec * 1000 + i * 2000);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, [simulationOn, updateAgent]);

  // ── Derived counts ──
  const activeCount = agents.filter((a) => a.status === "active").length;
  const chattingCount = agents.filter((a) => a.status === "chatting").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Virtual Office</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCalibrationMode(!calibrationMode)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              calibrationMode
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-[#1A1A2E] text-gray-500 hover:text-gray-300"
            }`}
          >
            {calibrationMode ? "🔧 Calibrating" : "🔧 Calibrate"}
          </button>
          <button
            onClick={() => setSimulationOn(!simulationOn)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              simulationOn
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[#1A1A2E] text-gray-400 hover:text-white"
            }`}
          >
            {simulationOn ? "⏸ Simulation ON" : "▶ Simulation OFF"}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-sm font-medium">Live</span>
          </div>
          <span className="text-xs text-gray-400">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* API Connection Info */}
      {!simulationOn && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-300 text-xs">
          <strong>API Mode:</strong> Simulation is off. Agents will only move when updated via{" "}
          <code className="bg-[#1A1A2E] px-1 py-0.5 rounded text-cyan-200">window.VirtualOffice.updateAgent(id, {"{"} task, taskType {"}"})</code>.
        </div>
      )}

      {/* 3D Isometric Room — Pure percentage positioning */}
      <div className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-[#8ecfcf]">
        <img
          src={ROOM_BG}
          alt="Virtual Office Room"
          className="w-full h-auto block"
          draggable={false}
        />

        {/* Ambient Effects Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Blinking String Lights */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`light-${i}`}
              className="absolute w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                left: `${12 + i * 11}%`,
                top: `${8 + (i % 2) * 2}%`,
                background: i % 2 === 0 ? "#fbbf24" : "#f87171",
                boxShadow: i % 2 === 0 ? "0 0 8px rgba(251, 191, 36, 0.8)" : "0 0 8px rgba(248, 113, 113, 0.8)",
                animationDelay: `${i * 0.15}s`,
                animationDuration: "1.5s",
              }}
            />
          ))}

          {/* Coffee Machine Steam */}
          <div
            className="absolute w-6 h-8 opacity-40"
            style={{ left: "59%", top: "40%" }}
          >
            {[...Array(3)].map((_, i) => (
              <div
                key={`steam-${i}`}
                className="absolute w-2 h-2 rounded-full bg-white"
                style={{
                  left: `${i * 6}px`,
                  top: 0,
                  animation: `rise ${1.5 + i * 0.3}s ease-in infinite`,
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            ))}
          </div>

          {/* TV Screen Flicker */}
          <div
            className="absolute w-16 h-10 rounded"
            style={{
              left: "33%",
              top: "60%",
              background: "rgba(100, 200, 255, 0.15)",
              animation: "flicker 0.15s infinite",
              animationDelay: "0.05s",
            }}
          />
        </div>

        {/* Calibration Grid Overlay */}
        {calibrationMode && (
          <div className="absolute inset-0 pointer-events-none">
            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
              <div
                key={`v-${pct}`}
                className="absolute top-0 bottom-0 border-l border-yellow-400/30"
                style={{ left: `${pct}%` }}
              >
                <span className="absolute top-1 -translate-x-1/2 text-[8px] text-yellow-400 bg-black/60 px-1 rounded">
                  {pct}%
                </span>
              </div>
            ))}
            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
              <div
                key={`h-${pct}`}
                className="absolute left-0 right-0 border-t border-yellow-400/30"
                style={{ top: `${pct}%` }}
              >
                <span className="absolute left-1 -translate-y-1/2 text-[8px] text-yellow-400 bg-black/60 px-1 rounded">
                  {pct}%
                </span>
              </div>
            ))}
            {Object.entries(stationCoords).map(([key, st]) => (
              <div
                key={key}
                onClick={() => handleClickStation(key)}
                className="absolute w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-600 pointer-events-auto cursor-pointer hover:bg-yellow-300 hover:scale-125 transition-transform"
                style={{
                  left: `${st.x}%`,
                  top: `${st.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 200,
                }}
              >
                <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[7px] text-yellow-300 bg-black/80 px-1 rounded whitespace-nowrap">
                  {key} ({Math.round(st.x)},{Math.round(st.y)})
                </span>
              </div>
            ))}

            {editingStation && stationCoords[editingStation] && (
              <div
                className="absolute pointer-events-auto z-[300]"
                style={{
                  left: `${stationCoords[editingStation].x}%`,
                  top: `${stationCoords[editingStation].y}%`,
                  transform: "translate(-50%, -130%)",
                }}
              >
                <div className="bg-[#1A1A2E] border border-yellow-500/50 rounded-lg p-3 shadow-xl min-w-[180px]">
                  <div className="text-yellow-400 text-xs font-bold mb-2">{editingStation}</div>
                  <div className="flex gap-2 items-center mb-2">
                    <label className="text-[10px] text-gray-400 w-4">X</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editX}
                      onChange={(e) => setEditX(e.target.value)}
                      className="w-16 bg-[#2A2A3E] border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-yellow-400 outline-none"
                    />
                    <label className="text-[10px] text-gray-400 w-4">Y</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editY}
                      onChange={(e) => setEditY(e.target.value)}
                      className="w-16 bg-[#2A2A3E] border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-yellow-400 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCoords}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold py-1 rounded transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingStation(null)}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white text-xs py-1 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent Avatars — positioned with pure CSS percentages */}
        {agents.map((agent) => {
          const stationPos = stationCoords[agent.station];
          if (!stationPos) return null;
          const statusColor =
            agent.status === "active" ? "#06b6d4" :
            agent.status === "chatting" ? "#a855f7" :
            "#6b7280";

          return (
            <div
              key={agent.id}
              className="absolute flex flex-col items-center pointer-events-auto"
              style={{
                left: `${stationPos.x}%`,
                top: `${stationPos.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 50 + Math.floor(stationPos.y),
                transition: "left 0.6s cubic-bezier(0.4, 0, 0.2, 1), top 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Speech Bubble */}
              <div
                className="relative mb-1.5 px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shadow-lg pointer-events-none"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  color: "#1a1b2e",
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              >
                {agent.task}
                <div
                  className="absolute left-1/2 -bottom-1 w-2 h-2 bg-white"
                  style={{
                    transform: "translateX(-50%) rotate(45deg)",
                    borderRight: "1px solid rgba(0,0,0,0.1)",
                    borderBottom: "1px solid rgba(0,0,0,0.1)",
                  }}
                />
              </div>

              {/* Avatar Circle */}
              <div
                onClick={() => setSelectedAgent(agent)}
                className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xl hover:scale-110 transition-transform cursor-pointer"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${agent.color}dd, ${agent.color})`,
                  border: `3px solid ${agent.color}`,
                  boxShadow: `0 0 14px ${agent.color}66, 0 4px 12px rgba(0,0,0,0.3)`,
                }}
              >
                {agent.name.charAt(0)}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                  style={{ background: statusColor }}
                />
              </div>

              {/* Name Tag */}
              <div
                className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide shadow-md"
                style={{ background: "rgba(0,0,0,0.85)", color: "white" }}
              >
                {agent.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-center gap-8 bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
          <span className="text-white font-semibold text-sm">{activeCount}</span>
          <span className="text-gray-400 text-sm">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
          <span className="text-white font-semibold text-sm">{chattingCount}</span>
          <span className="text-gray-400 text-sm">Chatting</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-white font-semibold text-sm">{idleCount}</span>
          <span className="text-gray-400 text-sm">Idle</span>
        </div>
      </div>

      {/* Agent Cards + Event Log */}
      <div className="grid grid-cols-12 gap-4">
        {/* Agent Cards */}
        <div className="col-span-8 grid grid-cols-3 gap-3">
          {agents.map((agent) => {
            const statusColor =
              agent.status === "active" ? "#06b6d4" :
              agent.status === "chatting" ? "#a855f7" :
              "#6b7280";
            return (
              <div key={agent.id} className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}88` }} />
                  <span className="text-white text-sm font-semibold">{agent.name}</span>
                </div>
                <div className="text-gray-500 text-xs">{agent.role}</div>
                <div className="text-gray-400 text-[10px] mt-1 truncate">{agent.task}</div>
                <div className="text-gray-600 text-[9px] mt-0.5">@ {STATIONS[agent.station]?.label || agent.station}</div>
              </div>
            );
          })}
        </div>

        {/* Event Log */}
        <div className="col-span-4 bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg p-3 max-h-[200px] overflow-y-auto">
          <h3 className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider">Activity Log</h3>
          {eventLog.length === 0 ? (
            <p className="text-gray-600 text-xs">No activity yet...</p>
          ) : (
            eventLog.map((entry, i) => (
              <div key={i} className="text-[10px] text-gray-500 mb-1">
                <span className="text-gray-600 mr-1">{entry.time}</span>
                {entry.text}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agent Details Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={() => setSelectedAgent(null)}
        >
          <div
            className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${selectedAgent.color}dd, ${selectedAgent.color})`,
                    border: `3px solid ${selectedAgent.color}`,
                  }}
                >
                  {selectedAgent.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">{selectedAgent.name}</h2>
                  <p className="text-gray-400 text-sm">{selectedAgent.role}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-gray-500 hover:text-gray-300 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Current Status */}
            <div className="bg-[#2A2A3E] rounded-lg p-3 mb-4">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Current Activity</div>
              <div className="text-white font-semibold mb-1">{selectedAgent.task}</div>
              <div className="text-gray-500 text-xs">@ {STATIONS[selectedAgent.station]?.label || selectedAgent.station}</div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#2A2A3E] rounded-lg p-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Status</div>
                <div className="text-white font-semibold capitalize">{selectedAgent.status}</div>
              </div>
              <div className="bg-[#2A2A3E] rounded-lg p-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Task Type</div>
                <div className="text-white font-semibold capitalize">{selectedAgent.taskType}</div>
              </div>
              <div className="bg-[#2A2A3E] rounded-lg p-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Tokens Used</div>
                <div className="text-white font-semibold">{selectedAgent.totalTokens ?? 0}</div>
              </div>
              <div className="bg-[#2A2A3E] rounded-lg p-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Uptime</div>
                <div className="text-white font-semibold">
                  {selectedAgent.joinedAt
                    ? `${Math.round((Date.now() - selectedAgent.joinedAt) / 1000 / 60)}m`
                    : "—"}
                </div>
              </div>
            </div>

            {/* Task History */}
            {selectedAgent.taskHistory && selectedAgent.taskHistory.length > 0 && (
              <div className="mb-4">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Recent Tasks</div>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {selectedAgent.taskHistory.slice(-5).reverse().map((entry, i) => (
                    <div key={i} className="bg-[#2A2A3E] rounded p-2">
                      <div className="text-gray-300 text-xs font-medium">{entry.task}</div>
                      <div className="text-gray-500 text-[10px]">{entry.taskType}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setSelectedAgent(null)}
              className="w-full bg-[#2A2A3E] hover:bg-[#3a3a4e] text-gray-300 font-medium py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
