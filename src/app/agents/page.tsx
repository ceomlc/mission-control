'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Design: OpenClaw Integration-Ready Virtual Office ──────────────────────
// Agents ONLY move when their task changes. Pure percentage positioning
// ensures agents always appear at the correct furniture location.

const ROOM_BG = "https://files.manuscdn.com/user_upload_by_module/session_file/107630172/PGkjOHGohwPsWfAP.png";

// ─── Types ──────────────────────────────────────────────────────────────────

type TaskType = "coding" | "research" | "writing" | "planning" | "security" | "break" | "coffee" | "gaming" | "idle";
type AgentStatus = "active" | "chatting" | "idle";
type Machine = "athena" | "thoth";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  task: string;
  taskType: TaskType;
  color: string;
  station: string;
  machine: Machine;
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

const ATHENA_DEFAULTS: Agent[] = [
  { id: "athena",    name: "Athena",    role: "Operations Manager",  status: "active",   task: "Monitoring systems",   taskType: "research",  color: "#06b6d4", station: "deskCenterLeft",  machine: "athena" },
  { id: "herald",    name: "Herald",    role: "Response Monitor",    status: "active",   task: "Watching for replies", taskType: "research",  color: "#22d3ee", station: "deskCenterRight", machine: "athena" },
  { id: "relay",     name: "Relay",     role: "iMessage Gateway",    status: "active",   task: "Standing by",          taskType: "security",  color: "#0e7490", station: "securityDesk",    machine: "athena" },
  { id: "tunnel",    name: "Tunnel",    role: "Cloudflare Proxy",    status: "active",   task: "Routing traffic",      taskType: "security",  color: "#155e75", station: "deskFrontLeft",   machine: "athena" },
  { id: "scheduler", name: "Scheduler", role: "Cron Job Runner",     status: "chatting", task: "Waiting for trigger",  taskType: "planning",  color: "#164e63", station: "deskLeftWall",    machine: "athena" },
  { id: "approver",  name: "Approver",  role: "Outreach Gatekeeper", status: "active",   task: "Reviewing queue",      taskType: "research",  color: "#0891b2", station: "beanBagBlue",     machine: "athena" },
];

const THOTH_DEFAULTS: Agent[] = [
  { id: "thoth",      name: "Thoth",      role: "Research & Lead Scout", status: "active",   task: "Idle",              taskType: "idle",     color: "#f59e0b", station: "deskCenterLeft",  machine: "thoth" },
  { id: "scout",      name: "Scout",      role: "Lead Sourcer",          status: "active",   task: "Awaiting run",      taskType: "research", color: "#fbbf24", station: "deskCenterRight", machine: "thoth" },
  { id: "qualifier",  name: "Qualifier",  role: "Lead Scorer",           status: "active",   task: "Awaiting run",      taskType: "coding",   color: "#f97316", station: "deskFrontLeft",   machine: "thoth" },
  { id: "hermes",     name: "Hermes",     role: "Outreach Writer",       status: "active",   task: "Awaiting run",      taskType: "writing",  color: "#fb923c", station: "deskLeftWall",    machine: "thoth" },
  { id: "enricher",   name: "Enricher",   role: "Email Finder",          status: "chatting", task: "Awaiting run",      taskType: "research", color: "#a78bfa", station: "beanBagPurple",   machine: "thoth" },
];

const DEFAULT_AGENTS: Agent[] = [...ATHENA_DEFAULTS, ...THOTH_DEFAULTS];

// ─── Demo Simulation Task Queues ────────────────────────────────────────────

interface SimTask { task: string; taskType: TaskType; durationSec: number; }

const SIM_QUEUES: Record<string, SimTask[]> = {
  // ── Athena's machine ──
  athena: [
    { task: "Monitoring systems",      taskType: "research", durationSec: 30 },
    { task: "Reviewing lead responses",taskType: "research", durationSec: 25 },
    { task: "Running check-responses", taskType: "security", durationSec: 20 },
    { task: "Coffee break",            taskType: "coffee",   durationSec: 15 },
    { task: "Approving outreach",      taskType: "planning", durationSec: 25 },
  ],
  herald: [
    { task: "Watching for replies",  taskType: "research", durationSec: 40 },
    { task: "Processing new reply",  taskType: "coding",   durationSec: 20 },
    { task: "Updating lead status",  taskType: "coding",   durationSec: 15 },
    { task: "Coffee break",          taskType: "coffee",   durationSec: 15 },
    { task: "Watching for replies",  taskType: "research", durationSec: 35 },
  ],
  relay: [
    { task: "Standing by",           taskType: "security", durationSec: 50 },
    { task: "Routing iMessage",      taskType: "security", durationSec: 10 },
    { task: "Standing by",           taskType: "security", durationSec: 50 },
    { task: "Routing iMessage",      taskType: "security", durationSec: 10 },
  ],
  tunnel: [
    { task: "Routing traffic",       taskType: "security", durationSec: 60 },
    { task: "Maintaining tunnel",    taskType: "security", durationSec: 40 },
    { task: "Routing traffic",       taskType: "security", durationSec: 60 },
  ],
  scheduler: [
    { task: "Waiting for trigger",   taskType: "planning", durationSec: 45 },
    { task: "Running check-cron",    taskType: "coding",   durationSec: 20 },
    { task: "Scheduling next run",   taskType: "planning", durationSec: 15 },
    { task: "Waiting for trigger",   taskType: "planning", durationSec: 45 },
  ],
  approver: [
    { task: "Reviewing queue",       taskType: "research", durationSec: 35 },
    { task: "Checking responses",    taskType: "research", durationSec: 25 },
    { task: "Coffee break",          taskType: "coffee",   durationSec: 15 },
    { task: "Reviewing queue",       taskType: "research", durationSec: 35 },
  ],
  // ── Thoth's machine ──
  thoth: [
    { task: "Idle",                  taskType: "idle",     durationSec: 30 },
    { task: "Reviewing pipeline",    taskType: "planning", durationSec: 20 },
    { task: "Coffee break",          taskType: "coffee",   durationSec: 15 },
    { task: "Idle",                  taskType: "idle",     durationSec: 30 },
  ],
  scout: [
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
    { task: "Scraping Google Maps",  taskType: "research", durationSec: 30 },
    { task: "Saving leads to DB",    taskType: "coding",   durationSec: 15 },
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
  ],
  qualifier: [
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
    { task: "Scoring leads",         taskType: "coding",   durationSec: 30 },
    { task: "Saving qualified leads",taskType: "coding",   durationSec: 15 },
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
  ],
  hermes: [
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
    { task: "Drafting outreach",     taskType: "writing",  durationSec: 30 },
    { task: "Sending follow-ups",    taskType: "writing",  durationSec: 25 },
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
  ],
  enricher: [
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
    { task: "Scraping contact pages",taskType: "research", durationSec: 25 },
    { task: "Querying Hunter.io",    taskType: "research", durationSec: 20 },
    { task: "Awaiting run",          taskType: "idle",     durationSec: 40 },
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

const AGENT_COLORS: Record<string, string> = {
  athena: "#06b6d4",
  thoth:  "#f59e0b",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [liveAgentIds, setLiveAgentIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Machine>("athena");
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
  const [draggingStation, setDraggingStation] = useState<string | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const simIndexRef = useRef<Record<string, number>>({});
  const taskHistoryRef = useRef<Record<string, Agent['taskHistory']>>({});

  // ── Log helper ──
  const addLog = useCallback((text: string) => {
    const now = new Date().toLocaleTimeString();
    setEventLog((prev) => [{ time: now, text }, ...prev].slice(0, 50));
  }, []);

  const handleDotMouseDown = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingStation(key);
  }, []);

  const handleRoomMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingStation || !roomRef.current) return;
    const rect = roomRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setStationCoords(prev => ({ ...prev, [draggingStation]: { x, y } }));
  }, [draggingStation]);

  const handleRoomMouseUp = useCallback(() => {
    if (!draggingStation) return;
    setStationCoords(prev => {
      localStorage.setItem('virtualOfficeStations', JSON.stringify(prev));
      return prev;
    });
    setDraggingStation(null);
  }, [draggingStation]);

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
          machine: (agent as any).machine ?? "athena",
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

  // ── Council: Poll for live agent heartbeats ──
  useEffect(() => {
    const pollCouncil = async () => {
      try {
        const res = await fetch('/api/council/status');
        if (!res.ok) return;
        const data = await res.json();
        const liveAgents: any[] = data.agents || [];
        if (liveAgents.length === 0) {
          setLiveAgentIds(new Set());
          return;
        }

        const newLiveIds = new Set<string>(liveAgents.map((a: any) => a.agent_id as string));
        setLiveAgentIds(newLiveIds);

        liveAgents.forEach((liveAgent: any) => {
          const agentId = liveAgent.agent_id as string;
          const taskName = liveAgent.current_task || "Idle";
          const taskType = (liveAgent.task_type as TaskType) || detectTaskType(taskName);

          setAgents((prev) => {
            const exists = prev.find((a) => a.id === agentId);
            const occupiedStations = new Set(prev.filter((a) => a.id !== agentId).map((a) => a.station));
            const station = exists?.station || pickStation(taskType, occupiedStations);

            // Derive machine: use explicit field, fallback to id prefix
            const machine: Machine =
              (liveAgent.machine === "athena" || liveAgent.machine === "thoth")
                ? liveAgent.machine
                : agentId.startsWith("thoth") ? "thoth" : "athena";

            const updatedAgent: Agent = {
              id: agentId,
              name: liveAgent.agent_name,
              role: liveAgent.role || "Agent",
              status: statusForTaskType(taskType),
              task: taskName,
              taskType,
              color: AGENT_COLORS[agentId] || "#06b6d4",
              station,
              machine,
              joinedAt: exists?.joinedAt || Date.now(),
              taskHistory: exists?.taskHistory || [],
              totalTokens: liveAgent.metadata?.tokens_used || 0,
            };

            if (!exists) {
              addLog(`${updatedAgent.name} is LIVE`);
              return [...prev, updatedAgent];
            }

            // Only update task/station if task changed
            if (exists.task !== taskName) {
              addLog(`${updatedAgent.name} → ${taskName}`);
              const shouldMove = exists.taskType !== taskType;
              return prev.map((a) =>
                a.id !== agentId ? a : {
                  ...a,
                  task: taskName,
                  taskType,
                  status: updatedAgent.status,
                  station: shouldMove ? pickStation(taskType, new Set(prev.filter((x) => x.id !== agentId).map((x) => x.station))) : a.station,
                  totalTokens: updatedAgent.totalTokens,
                }
              );
            }

            return prev.map((a) => a.id !== agentId ? a : { ...a, totalTokens: updatedAgent.totalTokens });
          });
        });
      } catch {
        // Silently fail
      }
    };

    const interval = setInterval(pollCouncil, 10000);
    pollCouncil();
    return () => clearInterval(interval);
  }, [addLog]);

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

  // ── Derived: filter by active tab ──
  const visibleAgents = agents.filter((a) => a.machine === activeTab);
  const activeCount = visibleAgents.filter((a) => a.status === "active").length;
  const chattingCount = visibleAgents.filter((a) => a.status === "chatting").length;
  const idleCount = visibleAgents.filter((a) => a.status === "idle").length;
  const tabLiveCount = (tab: Machine) => Array.from(liveAgentIds).filter((id) => {
    const agent = agents.find((a) => a.id === id);
    return agent?.machine === tab;
  }).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Council</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCalibrationMode(!calibrationMode)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              calibrationMode
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-[#141414] text-gray-500 hover:text-gray-300"
            }`}
          >
            {calibrationMode ? "🔧 Calibrating" : "🔧 Calibrate"}
          </button>
          <button
            onClick={() => setSimulationOn(!simulationOn)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              simulationOn
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[#141414] text-gray-400 hover:text-white"
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

      {/* Machine Tabs */}
      <div className="flex gap-2">
        {(["athena", "thoth"] as Machine[]).map((tab) => {
          const isActive = activeTab === tab;
          const liveCount = tabLiveCount(tab);
          const tabColor = tab === "athena" ? "#06b6d4" : "#f59e0b";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isActive
                  ? "text-white"
                  : "bg-[#141414] text-gray-400 hover:text-white border border-[#252525]"
              }`}
              style={isActive ? { background: `${tabColor}22`, border: `1px solid ${tabColor}55`, color: tabColor } : {}}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: liveCount > 0 ? "#22c55e" : tabColor,
                  boxShadow: liveCount > 0 ? "0 0 6px #22c55e88" : "none",
                  animation: liveCount > 0 ? "pulse 2s infinite" : "none",
                }}
              />
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {liveCount > 0 && (
                <span className="bg-green-500/20 text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-green-500/30">
                  {liveCount} LIVE
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3D Isometric Room — Pure percentage positioning */}
      <div
        ref={roomRef}
        className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-[#8ecfcf]"
        onMouseMove={handleRoomMouseMove}
        onMouseUp={handleRoomMouseUp}
        onMouseLeave={handleRoomMouseUp}
        style={{ userSelect: draggingStation ? 'none' : undefined }}
      >
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
                onMouseDown={(e) => handleDotMouseDown(e, key)}
                className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
                style={{
                  left: `${st.x}%`,
                  top: `${st.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: draggingStation === key ? 300 : 200,
                }}
              >
                <div className={`w-5 h-5 rounded-full border-2 transition-colors ${draggingStation === key ? 'bg-yellow-200 border-yellow-400 scale-125' : 'bg-yellow-400 border-yellow-600 hover:bg-yellow-300'}`} />
                <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[7px] text-yellow-300 bg-black/80 px-1 rounded whitespace-nowrap pointer-events-none">
                  {key} ({Math.round(st.x)},{Math.round(st.y)})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Agent Avatars — positioned with pure CSS percentages */}
        {visibleAgents.map((agent) => {
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
                  border: liveAgentIds.has(agent.id) ? `3px solid #22c55e` : `3px solid ${agent.color}`,
                  boxShadow: liveAgentIds.has(agent.id)
                    ? `0 0 18px #22c55e88, 0 4px 12px rgba(0,0,0,0.3)`
                    : `0 0 14px ${agent.color}66, 0 4px 12px rgba(0,0,0,0.3)`,
                }}
              >
                {agent.name.charAt(0)}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                  style={{ background: statusColor }}
                />
                {liveAgentIds.has(agent.id) && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[7px] font-bold px-1 rounded-full whitespace-nowrap">
                    LIVE
                  </div>
                )}
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
      <div className="flex items-center justify-center gap-8 bg-[#141414] border border-[#252525] rounded-lg px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          <span className="text-white font-semibold text-sm">{tabLiveCount(activeTab)}</span>
          <span className="text-green-400 text-sm font-medium">Live</span>
        </div>
        <div className="w-px h-4 bg-[#333333]" />
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
          {visibleAgents.map((agent) => {
            const statusColor =
              agent.status === "active" ? "#06b6d4" :
              agent.status === "chatting" ? "#a855f7" :
              "#6b7280";
            return (
              <div key={agent.id} className={`bg-[#141414] border rounded-lg p-3 ${liveAgentIds.has(agent.id) ? 'border-green-500/40' : 'border-[#252525]'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}88` }} />
                  <span className="text-white text-sm font-semibold">{agent.name}</span>
                  {liveAgentIds.has(agent.id) && (
                    <span className="ml-auto bg-green-500/20 text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-green-500/30">LIVE</span>
                  )}
                </div>
                <div className="text-gray-500 text-xs">{agent.role}</div>
                <div className="text-gray-400 text-[10px] mt-1 truncate">{agent.task}</div>
                <div className="text-gray-600 text-[9px] mt-0.5">@ {STATIONS[agent.station]?.label || agent.station}</div>
              </div>
            );
          })}
        </div>

        {/* Event Log */}
        <div className="col-span-4 bg-[#141414] border border-[#252525] rounded-lg p-3 max-h-[200px] overflow-y-auto">
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
            className="bg-[#141414] border border-[#252525] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
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
            <div className="bg-[#252525] rounded-lg p-3 mb-4">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Current Activity</div>
              <div className="text-white font-semibold mb-1">{selectedAgent.task}</div>
              <div className="text-gray-500 text-xs">@ {STATIONS[selectedAgent.station]?.label || selectedAgent.station}</div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#252525] rounded-lg p-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Status</div>
                <div className="text-white font-semibold capitalize">{selectedAgent.status}</div>
              </div>
              <div className="bg-[#252525] rounded-lg p-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Task Type</div>
                <div className="text-white font-semibold capitalize">{selectedAgent.taskType}</div>
              </div>
              <div className="bg-[#252525] rounded-lg p-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Tokens Used</div>
                <div className="text-white font-semibold">{selectedAgent.totalTokens ?? 0}</div>
              </div>
              <div className="bg-[#252525] rounded-lg p-3">
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
                    <div key={i} className="bg-[#252525] rounded p-2">
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
              className="w-full bg-[#252525] hover:bg-[#333333] text-gray-300 font-medium py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
