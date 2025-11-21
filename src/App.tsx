// src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Cat,
  Check,
  Clock,
  Coffee,
  FileAudio,
  Link as LinkIcon,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings,
  SkipForward,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

/* =========================
   CONFIG: AI PROVIDER/KEYS
   ========================= */
type Provider = "gemini" | "openai";
const AI_PROVIDER: Provider = "gemini"; // "openai" to use ChatGPT API
const GEMINI_API_KEY = "AIzaSyA4ZyDkHXZT2Nea2IKOcZNKxYYrh-iWrCM"; // Google AI Studio key
const OPENAI_API_KEY = ""; // OpenAI key (if using ChatGPT)

/* =============== STORAGE KEYS =============== */
const LS = {
  name: "pomodoro_user_name",
  job: "pomodoro_user_job",
  todos: "pomodoro_todos",
  theme: "pomodoro_theme",
  goal: "pomodoro_goal",
  focus: "pomodoro_focus_min",
  short: "pomodoro_short_min",
  long: "pomodoro_long_min",
  interval: "pomodoro_long_interval",
  history: "pomodoro_history",
  streak: "pomodoro_streak",
  bestStreak: "pomodoro_best_streak",
  notifications: "pomodoro_notifications",
  miniPos: "pomodoro_mini_pos",
};

/* ========= HELPERS ========= */
const delay = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const cleanText = (t: unknown): string =>
  String(t ?? "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim();

const safeParse = <T,>(v: string | null, fallback: T): T => {
  try {
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

const getYouTubeID = (url: string): string | null => {
  if (!url) return null;
  const re =
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|[?&]v=)([^#&?]{11}).*/;
  return url.match(re)?.[1] ?? null;
};

const dateKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const prevDateKey = (k: string): string => {
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dateKey(dt);
};
const getLastNDaysGoalRatio = (
  history: Record<string, number>,
  dailyGoal: number,
  days = 7
) => {
  if (dailyGoal <= 0) return 0;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if ((history[dateKey(d)] || 0) >= dailyGoal) count++;
  }
  return Math.round((count / days) * 100);
};

/* ============= NOTIFICATIONS ============= */
const canUseNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

async function ensureNotificationPermission(): Promise<boolean> {
  if (!canUseNotifications()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}
function sendNotification(title: string, body: string) {
  if (!canUseNotifications()) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body });
}

/* =============== AI CALLS =============== */
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=" +
    encodeURIComponent(GEMINI_API_KEY);
  const payload = { contents: [{ parts: [{ text: prompt }] }] };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return "";
    const j = await r.json();
    return cleanText(j?.candidates?.[0]?.content?.parts?.[0]?.text || "");
  } catch {
    clearTimeout(t);
    return "";
  }
}

async function callOpenAI(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) return "";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Dr. Paws, a concise, encouraging Pomodoro coach cat doctor.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    }),
  });
  if (!r.ok) return "";
  const j = await r.json();
  return cleanText(j?.choices?.[0]?.message?.content || "");
}

async function callAI(prompt: string): Promise<string> {
  return AI_PROVIDER === "openai" ? callOpenAI(prompt) : callGemini(prompt);
}

/* =============== AUDIO =============== */
const MUSIC_TRACKS = [
  {
    title: "Lofi Study",
    url: "https://cdn.pixabay.com/audio/2021/11/02/audio_351c4a1f1e.mp3",
  },
  {
    title: "Soft Rain",
    url: "https://cdn.pixabay.com/audio/2021/08/04/audio_c7bcd289e6.mp3",
  },
  {
    title: "Piano Clinic",
    url: "https://cdn.pixabay.com/audio/2022/03/15/audio_bf8cdfa79a.mp3",
  },
];
const ALARM_URL =
  "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

/* =============== QUOTES =============== */
const FLIRTY_QUOTES = [
  "Hey {name}, are you a pulmonary embolism? You take my breath away! 😻",
  "You must be the cure, {name}, because I feel better just looking at you! 🩺",
  "Is your name WiFi? Strong connection, {name}. 😸",
  "Are you a defibrillator? You're shocking my heart! ⚡",
  "I'd rather study you, {name}! (jk, study!) 😹",
  "You're so sweet, I'm hyperglycemic! 🍬",
  "I'd be DNA helicase to unzip your… notes! 🧬",
  "My love is like diarrhea—can't hold it in! 💩",
  "Are you a C-section? Because you dilate my pupils! 👀",
  "{name}, you’re a magician—everyone else disappears! ✨",
];

/* =============== TYPES =============== */
type Todo = { id: number; text: string; completed: boolean };
type SessionHistory = Record<string, number>;
type ChatMessage = { sender: "user" | "ai"; text: string; ts: number };
type MusicMode = "preset" | "custom";

/* =============== UI: TIMER BLOB =============== */
function JellyTimer({
  isBreak,
  timeString,
  isActive,
}: {
  isBreak: boolean;
  timeString: string;
  isActive: boolean;
}) {
  const colors = isBreak
    ? {
        from: "from-emerald-300",
        to: "to-teal-500",
        glow: "bg-emerald-400",
        icon: <Coffee className="w-12 h-12 text-white/90" />,
      }
    : {
        from: "from-cyan-400",
        to: "to-blue-700",
        glow: "bg-cyan-500",
        icon: <Brain className="w-12 h-12 text-white/90" />,
      };

  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
      <div
        className={`absolute inset-0 rounded-full blur-3xl opacity-30 transition-all duration-1000 ${
          isActive ? "animate-pulse-throb scale-110" : "scale-90 opacity-10"
        } ${colors.glow}`}
      />
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.from} ${colors.to} shadow-2xl opacity-90 transition-all duration-1000`}
        style={{
          borderRadius: "45% 55% 70% 30% / 30% 30% 70% 70%",
          animation: isActive
            ? "jelly-move 6s infinite ease-in-out alternate"
            : "jelly-idle 8s infinite ease-in-out",
        }}
      />
      <div
        className="absolute inset-4 bg-gradient-to-tl from-white/25 to-transparent rounded-[40%] blur-sm"
        style={{ animation: "spin-slow 20s linear infinite" }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-16 opacity-30 animate-float">
        {colors.icon}
      </div>
      <div className="relative z-20 flex flex-col items-center drop-shadow-lg">
        <span
          className={`text-7xl font-bold font-mono tracking-tight text-white transition-all duration-300 ${
            isActive ? "scale-105 animate-breathing" : "scale-100"
          }`}
        >
          {timeString}
        </span>
        <span className="text-sm font-bold uppercase tracking-widest mt-2 text-white/90 bg-black/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10 flex items-center gap-2">
          {isActive ? (
            <Activity className="w-3 h-3 animate-pulse" />
          ) : (
            <Pause className="w-3 h-3" />
          )}
          {isActive ? (isBreak ? "Recharging..." : "Focusing...") : "Paused"}
        </span>
      </div>
    </div>
  );
}

/* =============== PET CARD =============== */
function PetCompanion({
  isBreak,
  message,
  onGenerate,
}: {
  isBreak: boolean;
  message: string;
  onGenerate: () => void;
}) {
  return (
    <div className="relative w-full bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col items-center">
      {message && (
        <div className="absolute -top-12 w-full px-4">
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg text-center border border-slate-700 relative">
            <p className="text-sm italic">{`"${message}"`}</p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rotate-45 w-4 h-4 bg-slate-900 border-r border-b border-slate-700" />
          </div>
        </div>
      )}
      <div
        className="relative z-10 cursor-pointer mt-4 animate-shake"
        onClick={onGenerate}
      >
        <div
          className={`w-36 h-36 rounded-full flex items-center justify-center bg-white border-[5px] shadow-inner ${
            isBreak ? "border-emerald-200" : "border-cyan-200"
          }`}
        >
          <div className="relative">
            <span className="text-7xl">{isBreak ? "😴" : "🐱"}</span>
            {!isBreak && (
              <span className="absolute -bottom-2 -right-4 text-4xl rotate-12">
                🩺
              </span>
            )}
          </div>
        </div>
      </div>
      <h3 className="font-bold text-slate-800 text-xl mt-2">Dr. Paws</h3>
      <p className="text-xs text-cyan-600 font-bold uppercase tracking-wide">
        Pomodoro Companion
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onGenerate();
        }}
        className="absolute top-3 right-3 p-2 bg-cyan-600 text-white rounded-full shadow"
      >
        <Sparkles className="w-5 h-5" />
      </button>
    </div>
  );
}

/* =============== AUDIO VISUALIZER =============== */
function AudioVisualizer({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-5">
      {["a", "b", "c", "b", "a"].map((bar, i) => (
        <div
          key={i}
          className={`w-1 rounded-full bg-cyan-400/80 ${
            active ? `eq-bar-${bar}` : "h-[4px] opacity-40"
          }`}
        />
      ))}
    </div>
  );
}

/* =============== MUSIC PANEL (YT supported) =============== */
function MusicPanel({
  darkMode,
  musicMode,
  setMusicMode,
  isPlayingMusic,
  toggleMusic,
  nextTrack,
  currentTrackIndex,
  youtubeId,
  customAudioLink,
  setCustomAudioLink,
  isMuted,
  setIsMuted,
  volume,
  setVolume,
  audioSrc,
  spotifyLink,
  setSpotifyLink,
}: any) {
  const hasAudioSource = !!audioSrc || !!youtubeId;
  const ytRef = useRef<HTMLIFrameElement | null>(null);
  const ytMsg = (func: "playVideo" | "pauseVideo") =>
    ytRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );

  useEffect(() => {
    if (!youtubeId) return;
    isPlayingMusic ? ytMsg("playVideo") : ytMsg("pauseVideo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayingMusic, youtubeId]);

  return (
    <div
      className={`${
        darkMode
          ? "bg-slate-700/50 border-slate-600"
          : "bg-white/90 border-slate-200"
      } backdrop-blur-sm rounded-2xl p-4 border shadow-sm mt-4 w-full`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`flex gap-4 border-b pb-2 ${
            darkMode ? "border-slate-600" : "border-slate-100"
          }`}
        >
          <button
            onClick={() => setMusicMode("preset")}
            className={`text-xs font-bold uppercase ${
              musicMode === "preset" ? "text-cyan-600" : "opacity-60"
            }`}
          >
            Preset
          </button>
          <button
            onClick={() => setMusicMode("custom")}
            className={`text-xs font-bold uppercase flex items-center gap-1 ${
              musicMode === "custom" ? "text-indigo-600" : "opacity-60"
            }`}
          >
            <LinkIcon className="w-3 h-3" /> Custom
          </button>
        </div>
        <div className="flex items-center gap-3">
          <AudioVisualizer
            active={isPlayingMusic && !isMuted && hasAudioSource}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-24 accent-cyan-500"
          />
        </div>
      </div>

      {musicMode === "preset" ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                isPlayingMusic
                  ? "bg-cyan-100 text-cyan-600"
                  : darkMode
                  ? "bg-slate-600 text-slate-400"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Music className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold opacity-50 uppercase">
                Now Playing
              </p>
              <p className="text-sm font-bold">
                {MUSIC_TRACKS[currentTrackIndex].title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMuted((p: boolean) => !p)}>
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={toggleMusic}
              disabled={!hasAudioSource}
              className="p-2 rounded-lg bg-cyan-600 text-white"
            >
              {isPlayingMusic ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            <button onClick={nextTrack} className="p-2 rounded-lg">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <FileAudio className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              value={customAudioLink}
              onChange={(e) => setCustomAudioLink(e.target.value)}
              placeholder="YouTube / MP3 link"
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg"
            />
          </div>

          {youtubeId ? (
            <div className="relative w-full rounded-xl overflow-hidden border bg-black">
              <button
                onClick={() => setCustomAudioLink("")}
                className="absolute top-2 right-2 text-white bg-black/50 p-2 rounded-full"
              >
                <X />
              </button>
              <iframe
                ref={ytRef}
                src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&rel=0&modestbranding=1`}
                className="w-full h-40"
                allow="autoplay; encrypted-media"
              />
              <div className="flex items-center gap-2 p-2">
                <button
                  onClick={() => ytMsg("playVideo")}
                  className="p-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Play
                </button>
                <button
                  onClick={() => ytMsg("pauseVideo")}
                  className="p-2 bg-slate-200 rounded-lg flex items-center gap-2 text-slate-800"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={toggleMusic}
              disabled={!hasAudioSource}
              className="p-2 bg-indigo-500 text-white rounded-lg"
            >
              {isPlayingMusic ? <Pause /> : <Play />}
            </button>
          )}

          <div>
            <p className="text-[11px] opacity-70 mb-1">
              Spotify (opens externally)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={spotifyLink}
                onChange={(e) => setSpotifyLink(e.target.value)}
                placeholder="Spotify URL…"
                className="flex-1 px-3 py-2 text-xs border rounded-lg"
              />
              <button
                onClick={() => window.open(spotifyLink, "_blank")}
                className="px-3 py-2 bg-emerald-500 text-white rounded-lg"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============== FLOATING MINI (DRAGGABLE) =============== */
function FloatingMini({
  timeString,
  isActive,
  isBreak,
  onToggle,
  minimized,
  setMinimized,
}: any) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() =>
    safeParse(localStorage.getItem(LS.miniPos), { x: 24, y: 24 })
  );
  const drag = useRef({ on: false, dx: 0, dy: 0 });

  useEffect(() => {
    localStorage.setItem(LS.miniPos, JSON.stringify(pos));
  }, [pos]);

  const pd = (e: React.PointerEvent<HTMLDivElement>) => {
    containerRef.current?.setPointerCapture(e.pointerId);
    drag.current.on = true;
    drag.current.dx = e.clientX - pos.x;
    drag.current.dy = e.clientY - pos.y;
  };
  const pm = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.on) return;
    const width = 272,
      height = minimized ? 70 : 180,
      vw = window.innerWidth,
      vh = window.innerHeight;
    const nx = Math.max(
      8,
      Math.min(vw - width - 8, e.clientX - drag.current.dx)
    );
    const ny = Math.max(
      8,
      Math.min(vh - height - 8, e.clientY - drag.current.dy)
    );
    setPos({ x: nx, y: ny });
  };
  const pu = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current.on = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={pd}
      onPointerMove={pm}
      onPointerUp={pu}
      className="fixed z-40 bg-white dark:bg-slate-800 border shadow-xl rounded-2xl p-3 w-64 transition-all cursor-grab active:cursor-grabbing select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold uppercase opacity-70">
          {isBreak ? "Break" : "Focus"}
        </span>
        <button
          onClick={() => setMinimized((p: boolean) => !p)}
          className="p-1 hover:bg-black/10 rounded"
        >
          {minimized ? (
            <Maximize2 className="w-4 h-4" />
          ) : (
            <Minimize2 className="w-4 h-4" />
          )}
        </button>
      </div>
      {!minimized && (
        <>
          <p className="text-center text-4xl font-mono font-bold mb-2">
            {timeString}
          </p>
          <button
            onClick={onToggle}
            className="w-full bg-cyan-600 text-white py-2 rounded-xl font-bold"
          >
            {isActive ? "Pause" : "Start"}
          </button>
        </>
      )}
    </div>
  );
}

/* =============== CHAT BOX (avatar + close + Enter clears) =============== */
function ChatBox({
  darkMode,
  chat,
  onSend,
  onClose,
}: {
  darkMode: boolean;
  chat: ChatMessage[];
  onSend: (msg: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const doSend = () => {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText(""); // important: clears after enter
  };

  return (
    <div
      className={`fixed bottom-6 left-6 w-80 z-50 rounded-3xl border shadow-xl flex flex-col ${
        darkMode
          ? "bg-slate-900 border-slate-700 text-white"
          : "bg-white border-slate-300"
      }`}
    >
      <div className="p-3 px-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-600 grid place-items-center text-white">
            <Cat className="w-4 h-4" />
          </div>
          <p className="font-bold text-sm">Dr. Paws AI</p>
        </div>
        <button
          aria-label="Close chat"
          className="p-1 rounded-lg hover:bg-black/10"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-60 p-3 space-y-3">
        {chat.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {m.sender === "ai" && (
              <div className="w-7 h-7 rounded-full bg-cyan-600 text-white grid place-items-center mr-2 shrink-0">
                <Cat className="w-4 h-4" />
              </div>
            )}
            <div
              className={`p-3 rounded-2xl text-sm max-w-[75%] ${
                m.sender === "user"
                  ? "bg-cyan-600 text-white"
                  : darkMode
                  ? "bg-slate-800"
                  : "bg-slate-200"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t flex items-center gap-2">
        <input
          className={`flex-1 px-3 py-2 rounded-xl text-sm outline-none ${
            darkMode ? "bg-slate-800" : "bg-slate-100"
          }`}
          placeholder="Ask me anything…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              doSend();
            }
          }}
        />
        <button
          onClick={doSend}
          className="p-2 bg-cyan-600 text-white rounded-xl"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* =============== REUSABLES =============== */
function IconButton({
  onClick,
  label,
  title,
  children,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label}
      className="p-2.5 rounded-xl hover:bg-black/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      {children}
    </button>
  );
}
function Modal({
  onClose,
  darkMode,
  title,
  icon,
  children,
}: {
  onClose: () => void;
  darkMode: boolean;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`${
          darkMode ? "bg-slate-900 text-white" : "bg-white text-slate-800"
        } rounded-3xl p-8 w-full max-w-md shadow-2xl relative`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100/10 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          {icon} {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
function SliderRow({
  label,
  min,
  max,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2 opacity-70">{label}</label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) =>
            onChange(
              Math.max(min, Math.min(max, parseInt(e.target.value) || value))
            )
          }
          className="flex-1 accent-cyan-500 h-2 bg-gray-200 rounded-lg cursor-pointer dark:bg-gray-700"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) =>
            onChange(
              Math.max(min, Math.min(max, parseInt(e.target.value) || value))
            )
          }
          className="w-20 px-3 py-2 rounded-lg border bg-transparent"
        />
      </div>
    </div>
  );
}
function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className={`${color
        .replace("text-", "bg-")
        .replace("500", "500/10")} p-4 rounded-2xl`}
    >
      <p className="text-sm opacity-70">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

/* =============== SETTINGS CONTENT =============== */
function SettingsContent({
  focusMin,
  shortBreakMin,
  longBreakMin,
  longBreakInterval,
  dailyGoal,
  darkMode,
  notificationsEnabled,
  setFocusMin,
  setShortBreakMin,
  setLongBreakMin,
  setLongBreakInterval,
  setDailyGoal,
  setDarkMode,
  setNotificationsEnabled,
}: any) {
  const supported = canUseNotifications();
  const perm = supported ? Notification.permission : "unsupported";
  return (
    <div className="space-y-6">
      <SliderRow
        label="Focus (minutes)"
        min={1}
        max={120}
        value={focusMin}
        onChange={setFocusMin}
      />
      <SliderRow
        label="Short Break (minutes)"
        min={1}
        max={60}
        value={shortBreakMin}
        onChange={setShortBreakMin}
      />
      <SliderRow
        label="Long Break (minutes)"
        min={5}
        max={90}
        value={longBreakMin}
        onChange={setLongBreakMin}
      />
      <SliderRow
        label="Long Break Interval (sessions)"
        min={2}
        max={12}
        value={longBreakInterval}
        onChange={setLongBreakInterval}
        step={1}
      />
      <div>
        <label className="block text-sm font-bold mb-2 opacity-70">
          Daily Goal (Sessions)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="20"
            value={dailyGoal}
            onChange={(e) => setDailyGoal(parseInt(e.target.value) || 1)}
            className="flex-1 accent-cyan-500 h-2 bg-gray-200 rounded-lg cursor-pointer dark:bg-gray-700"
          />
          <span className="font-mono text-xl font-bold w-10 text-center">
            {dailyGoal}
          </span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold mb-2 opacity-70">Theme</label>
        <button
          onClick={() => setDarkMode((p: boolean) => !p)}
          className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
            darkMode ? "bg-slate-800" : "bg-slate-100"
          }`}
        >
          <span className="flex items-center gap-2">
            {darkMode ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
            {darkMode ? "Dark Mode" : "Light Mode"}
          </span>
          <div
            className={`w-12 h-6 rounded-full p-1 ${
              darkMode ? "bg-cyan-500" : "bg-slate-300"
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                darkMode ? "translate-x-6" : ""
              }`}
            />
          </div>
        </button>
      </div>
      <div>
        <label className="block text-sm font-bold mb-2 opacity-70">
          Desktop Notifications
        </label>
        <button
          disabled={!supported}
          onClick={async () => {
            if (!notificationsEnabled) {
              const ok = await ensureNotificationPermission();
              if (!ok) {
                alert(
                  perm === "denied"
                    ? "Notifications are blocked in your browser for this site."
                    : "Notifications require permission & HTTPS."
                );
                return;
              }
              setNotificationsEnabled(true);
            } else setNotificationsEnabled(false);
          }}
          className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
            notificationsEnabled
              ? "bg-emerald-500/10 border border-emerald-500/40"
              : "bg-slate-100 dark:bg-slate-800"
          } ${!supported ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="flex items-center gap-2">
            <Bell className="w-5 h-5" />{" "}
            {notificationsEnabled ? "Enabled" : "Disabled"}
          </span>
          <div
            className={`w-12 h-6 rounded-full p-1 ${
              notificationsEnabled ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                notificationsEnabled ? "translate-x-6" : ""
              }`}
            />
          </div>
        </button>
        {!supported && (
          <p className="mt-1 text-[11px] opacity-60">
            Notifications not supported.
          </p>
        )}
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            if (window.confirm("Reset all Pomodoro Clinic data?")) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="text-red-500 text-sm hover:underline flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Reset All Data
        </button>
      </div>
    </div>
  );
}

/* =============== STREAK CALENDAR (compact) =============== */
function StreakCalendar({
  sessionHistory,
  dailyGoal,
  darkMode,
}: {
  sessionHistory: Record<string, number>;
  dailyGoal: number;
  darkMode: boolean;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKeyStr = dateKey();
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const cells: Array<{ key: string | null; dayNum: number | null }> = [];
  for (let i = 0; i < startWeekday; i++)
    cells.push({ key: null, dayNum: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(new Date(year, month, d));
    cells.push({ key: k, dayNum: d });
  }
  while (cells.length % 7 !== 0) cells.push({ key: null, dayNum: null });

  const gotoPrev = () => setCursor(new Date(year, month - 1, 1));
  const gotoNext = () => setCursor(new Date(year, month + 1, 1));
  const gotoToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div
      className={`rounded-2xl border p-4 ${
        darkMode
          ? "bg-slate-950/60 border-slate-800"
          : "bg-white border-slate-100"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-60 font-bold">
            Streak Calendar
          </p>
          <h4 className="text-lg font-bold">{monthLabel}</h4>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={gotoPrev}
            className={`px-2 py-1 rounded-lg text-sm ${
              darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"
            }`}
          >
            ←
          </button>
          <button
            onClick={gotoToday}
            className={`px-2 py-1 rounded-lg text-sm font-semibold ${
              darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"
            }`}
          >
            Today
          </button>
          <button
            onClick={gotoNext}
            className={`px-2 py-1 rounded-lg text-sm ${
              darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"
            }`}
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-[11px] font-bold uppercase tracking-wider opacity-60 mb-2">
        {weekDays.map((w) => (
          <div key={w} className="text-center py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.key || !c.dayNum)
            return <div key={i} className="h-9 rounded-lg" />;
          const count = sessionHistory[c.key] || 0;
          const hit = count >= dailyGoal;
          const isToday = c.key === todayKeyStr;
          return (
            <div
              key={c.key}
              className={[
                "h-9 rounded-lg flex flex-col items-center justify-center text-xs font-bold border transition",
                darkMode ? "border-slate-800" : "border-slate-100",
                hit
                  ? "bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-cyan-500/30"
                  : darkMode
                  ? "bg-slate-900 text-slate-300"
                  : "bg-slate-50 text-slate-700",
                isToday ? "ring-2 ring-orange-400" : "",
              ].join(" ")}
              title={`${c.key}: ${count} session(s)`}
            >
              <div>{c.dayNum}</div>
              <div className="text-[9px] opacity-80">
                {count > 0 ? count : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] opacity-70">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-slate-200 dark:bg-slate-800" />
          No sessions
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-gradient-to-br from-cyan-500 to-indigo-600" />
          Goal hit
        </div>
      </div>
    </div>
  );
}

/* =============== VITALS =============== */
function VitalsPanel({
  focusMinutes,
  streakDays,
  consistency,
  darkMode,
}: {
  focusMinutes: number;
  streakDays: number;
  consistency: number;
  darkMode: boolean;
}) {
  return (
    <div className="mt-8 w-full max-w-xl grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
      <div
        className={`rounded-2xl p-3 border ${
          darkMode
            ? "bg-slate-900/80 border-slate-700"
            : "bg-white/80 border-slate-100"
        } flex flex-col gap-1`}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] opacity-60 font-semibold">
          Focus Pressure
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-cyan-500">
            {Math.max(focusMinutes, 0)}
          </span>
          <span className="text-[11px] opacity-70">min</span>
        </div>
        <p className="text-[11px] opacity-70">Total focused today</p>
      </div>
      <div
        className={`rounded-2xl p-3 border ${
          darkMode
            ? "bg-slate-900/80 border-slate-700"
            : "bg-white/80 border-slate-100"
        } flex flex-col gap-1`}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] opacity-60 font-semibold">
          Streak Pulse
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-orange-500">
            {Math.max(streakDays, 0)}
          </span>
          <span className="text-[11px] opacity-70">days</span>
        </div>
        <p className="text-[11px] opacity-70">
          Consecutive days hitting your goal
        </p>
      </div>
      <div
        className={`rounded-2xl p-3 border ${
          darkMode
            ? "bg-slate-900/80 border-slate-700"
            : "bg-white/80 border-slate-100"
        } flex flex-col gap-1`}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] opacity-60 font-semibold">
          Consistency Temp
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-emerald-500">
            {Math.max(consistency, 0)}
          </span>
          <span className="text-[11px] opacity-70">%</span>
        </div>
        <p className="text-[11px] opacity-70">Last 7 days with goal hit</p>
      </div>
    </div>
  );
}

/* ====================== MAIN APP ====================== */
export default function PomodoroApp() {
  // identity
  const [userName, setUserName] = useState<string>("");
  const [userJob, setUserJob] = useState<string>("");
  const [inputName, setInputName] = useState<string>("");
  const [inputJob, setInputJob] = useState<string>("");
  const [isWelcome, setIsWelcome] = useState<boolean>(true);

  // settings
  const [focusMin, setFocusMin] = useState<number>(25);
  const [shortBreakMin, setShortBreakMin] = useState<number>(5);
  const [longBreakMin, setLongBreakMin] = useState<number>(15);
  const [longBreakInterval, setLongBreakInterval] = useState<number>(4);
  const [dailyGoal, setDailyGoal] = useState<number>(8);

  // timer
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isBreak, setIsBreak] = useState<boolean>(false);
  const [isLongBreak, setIsLongBreak] = useState<boolean>(false);

  // sessions
  const [completedPomodoros, setCompletedPomodoros] = useState<number>(0);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory>({});

  // streaks
  const [streakDays, setStreakDays] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);

  // ui
  const [assistantMessage, setAssistantMessage] = useState<string>("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState<string>("");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // music
  const [musicMode, setMusicMode] = useState<MusicMode>("preset");
  const [customAudioLink, setCustomAudioLink] = useState<string>("");
  const [spotifyLink, setSpotifyLink] = useState<string>("");
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [volume, setVolume] = useState<number>(50);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // chat
  const [showChat, setShowChat] = useState<boolean>(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      sender: "ai",
      text: "Hi! I’m Dr. Paws. Tell me what you’re working on today.",
      ts: Date.now(),
    },
  ]);

  // floating mini
  const [showFloating, setShowFloating] = useState<boolean>(false);
  const [floatingMinimized, setFloatingMinimized] = useState<boolean>(false);

  // notifications
  const [notificationsEnabled, setNotificationsEnabled] =
    useState<boolean>(false);
  const notificationsEnabledRef = useRef<boolean>(false);

  // timers
  const intervalRef = useRef<number | null>(null);
  const dayRef = useRef<string>(dateKey());
  const quoteTimerRef = useRef<number | null>(null);

  /* ===== quote auto-hide ===== */
  useEffect(() => {
    if (!assistantMessage) return;
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = window.setTimeout(
      () => setAssistantMessage(""),
      30000
    );
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, [assistantMessage]);

  /* ===== load ===== */
  useEffect(() => {
    const savedName = localStorage.getItem(LS.name);
    const savedJob = localStorage.getItem(LS.job);
    const savedTodos = localStorage.getItem(LS.todos);
    const savedTheme = localStorage.getItem(LS.theme);
    const savedGoal = localStorage.getItem(LS.goal);
    const savedFocus = localStorage.getItem(LS.focus);
    const savedShort = localStorage.getItem(LS.short);
    const savedLong = localStorage.getItem(LS.long);
    const savedInterval = localStorage.getItem(LS.interval);
    const savedHistory = safeParse<SessionHistory>(
      localStorage.getItem(LS.history),
      {}
    );
    setSessionHistory(savedHistory);
    const today = dateKey();
    setCompletedPomodoros(savedHistory[today] || 0);

    if (savedName) {
      setUserName(savedName);
      setIsWelcome(false);
    }
    if (savedJob) setUserJob(savedJob);
    if (savedTodos) setTodos(safeParse<Todo[]>(savedTodos, []));
    if (savedTheme === "dark") setDarkMode(true);
    if (savedGoal) setDailyGoal(Math.max(1, parseInt(savedGoal) || 8));
    if (savedFocus) setFocusMin(Math.max(1, parseInt(savedFocus) || 25));
    if (savedShort) setShortBreakMin(Math.max(1, parseInt(savedShort) || 5));
    if (savedLong) setLongBreakMin(Math.max(5, parseInt(savedLong) || 15));
    if (savedInterval)
      setLongBreakInterval(Math.max(2, parseInt(savedInterval) || 4));

    const savedStreak = parseInt(localStorage.getItem(LS.streak) || "0") || 0;
    const savedBest = parseInt(localStorage.getItem(LS.bestStreak) || "0") || 0;
    setStreakDays(savedStreak);
    setBestStreak(savedBest);

    const notifRaw = localStorage.getItem(LS.notifications);
    if (notifRaw === "1") setNotificationsEnabled(true);

    const q = FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)];
    setAssistantMessage(q.replace(/{name}/g, savedName || "Future Doctor"));
  }, []);

  /* ===== sync notif ref ===== */
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  /* ===== save ===== */
  useEffect(() => {
    if (isWelcome) return;
    localStorage.setItem(LS.todos, JSON.stringify(todos));
    localStorage.setItem(LS.theme, darkMode ? "dark" : "light");
    localStorage.setItem(LS.goal, String(dailyGoal));
    localStorage.setItem(LS.focus, String(focusMin));
    localStorage.setItem(LS.short, String(shortBreakMin));
    localStorage.setItem(LS.long, String(longBreakMin));
    localStorage.setItem(LS.interval, String(longBreakInterval));
    localStorage.setItem(LS.history, JSON.stringify(sessionHistory));
    localStorage.setItem(LS.streak, String(streakDays));
    localStorage.setItem(LS.bestStreak, String(bestStreak));
    localStorage.setItem(LS.notifications, notificationsEnabled ? "1" : "0");
  }, [
    todos,
    darkMode,
    dailyGoal,
    isWelcome,
    focusMin,
    shortBreakMin,
    longBreakMin,
    longBreakInterval,
    sessionHistory,
    streakDays,
    bestStreak,
    notificationsEnabled,
  ]);

  /* ===== midnight rollover ===== */
  useEffect(() => {
    const id = window.setInterval(() => {
      const nowKey = dateKey();
      if (nowKey !== dayRef.current) {
        dayRef.current = nowKey;
        setCompletedPomodoros(sessionHistory[nowKey] || 0);
      }
    }, 60000);
    return () => clearInterval(id);
  }, [sessionHistory]);

  /* ===== reset displayed time when idle (don't touch while running) ===== */
  useEffect(() => {
    if (isActive) return; // why: changing settings shouldn't reset while running
    const secs =
      (isBreak ? (isLongBreak ? longBreakMin : shortBreakMin) : focusMin) * 60;
    setTimeLeft(secs);
  }, [focusMin, shortBreakMin, longBreakMin, isBreak, isLongBreak, isActive]);

  /* ===== streak compute ===== */
  useEffect(() => {
    const today = dateKey();
    const yesterday = prevDateKey(today);
    const todayQualified = (sessionHistory[today] || 0) >= dailyGoal;

    let streak = todayQualified ? 1 : 0;
    let cursor = yesterday;
    while ((sessionHistory[cursor] || 0) >= dailyGoal) {
      streak += 1;
      cursor = prevDateKey(cursor);
    }
    setStreakDays(streak);
    setBestStreak((prev) => Math.max(prev, streak));
  }, [sessionHistory, dailyGoal]);

  /* ===== music ===== */
  const youtubeId = getYouTubeID(customAudioLink);
  const audioSrc = useMemo(() => {
    if (musicMode === "preset")
      return MUSIC_TRACKS[currentTrackIndex]?.url || null;
    if (musicMode === "custom" && customAudioLink && !youtubeId)
      return customAudioLink;
    return null;
  }, [musicMode, currentTrackIndex, customAudioLink, youtubeId]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!audioSrc) {
      audioRef.current.pause();
      setIsPlayingMusic(false);
      return;
    }
    audioRef.current.load();
    if (isPlayingMusic) {
      audioRef.current.play().catch(() => setIsPlayingMusic(false));
    }
  }, [audioSrc, isPlayingMusic]);

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio || (!audioSrc && !youtubeId)) return;
    if (audioSrc && !youtubeId) {
      if (audio.paused) {
        audio
          .play()
          .then(() => setIsPlayingMusic(true))
          .catch(() => setIsPlayingMusic(false));
      } else {
        audio.pause();
        setIsPlayingMusic(false);
      }
    } else {
      setIsPlayingMusic((p) => !p);
    }
  };
  const nextTrack = () =>
    setCurrentTrackIndex((p) => (p + 1) % MUSIC_TRACKS.length);

  /* ===== chat send ===== */
  const sendChat = async (msg: string) => {
    const trimmed = msg.trim();
    if (!trimmed) return;

    setChat((prev) => [
      ...prev,
      { sender: "user", text: trimmed, ts: Date.now() },
    ]);

    if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
      setChat((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Add your API key in App.tsx to enable AI (Gemini or ChatGPT).",
          ts: Date.now(),
        },
      ]);
      return;
    }

    const prompt = `
You are Dr. Paws, a cute but strict cat doctor Pomodoro coach.
User name: ${userName || "User"}.
Rules:
- 1–3 short paragraphs.
- One actionable tip.
- Light medical metaphors.
User: "${trimmed}"
`;
    const aiText =
      (await callAI(prompt)) || "Hmm… say that again for me, doc 😼";
    setChat((prev) => [
      ...prev,
      { sender: "ai", text: aiText, ts: Date.now() },
    ]);
  };

  /* ===== timer loop ===== */
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (intervalRef.current) return;

    intervalRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          handleTimerComplete();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  const nextBreakIsLong = (nextCount: number) =>
    nextCount > 0 && nextCount % Math.max(2, longBreakInterval) === 0;

  const incrementTodaySession = (): number => {
    const today = dateKey();
    let nextCount = 0;
    setSessionHistory((prev) => {
      nextCount = (prev[today] || 0) + 1;
      return { ...prev, [today]: nextCount };
    });
    setCompletedPomodoros(() => nextCount);
    return nextCount;
  };

  const handleTimerComplete = () => {
    setIsActive(false);

    // play alarm (best-effort)
    try {
      const a = new Audio(ALARM_URL);
      a.volume = 0.5;
      a.play().catch(() => {});
    } catch {}

    if (!isBreak) {
      const nextCount = incrementTodaySession();
      const longNow = nextBreakIsLong(nextCount);

      setIsBreak(true);
      setIsLongBreak(longNow);
      setTimeLeft((longNow ? longBreakMin : shortBreakMin) * 60);
      setAssistantMessage(
        `Nice work ${userName || ""}! Your focus is clinically impressive. 💓`
      );

      if (notificationsEnabledRef.current) {
        sendNotification(
          "Focus complete",
          longNow ? "Long break prescribed. ☕" : "Short break time. 🌿"
        );
      }
      // Auto-start break
      setIsActive(true);
    } else {
      setIsBreak(false);
      setIsLongBreak(false);
      setTimeLeft(focusMin * 60);
      setAssistantMessage("Break over — back to focus! 😼");
      if (notificationsEnabledRef.current) {
        sendNotification("Break complete", "Back to focus mode. 🧠");
      }
      // Auto-start next focus
      setIsActive(true);
    }
  };

  const handleStart = () => {
    setIsActive(true);
    setAssistantMessage("Focus mode on. I’m watching you shine. 👀");
  };
  const handlePause = () => {
    setIsActive(false); // why: pause should stop without resetting
    setAssistantMessage("Paused. Don’t ghost me too long 😿");
  };
  const handleReset = () => {
    setIsActive(false);
    const secs =
      (isBreak ? (isLongBreak ? longBreakMin : shortBreakMin) : focusMin) * 60;
    setTimeLeft(secs);
    setAssistantMessage("Reset done. Ready when you are.");
  };

  const handleNameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputName.trim() && inputJob.trim()) {
      const n = cleanText(inputName);
      const j = cleanText(inputJob);
      localStorage.setItem(LS.name, n);
      localStorage.setItem(LS.job, j);
      setUserName(n);
      setUserJob(j);
      setIsWelcome(false);
      const q = FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)];
      setAssistantMessage(q.replace(/{name}/g, n));
      setTimeLeft(focusMin * 60);
    }
  };

  const handleLogout = () => {
    setIsActive(false);
    setIsBreak(false);
    setIsLongBreak(false);
    setIsPlayingMusic(false);
    audioRef.current?.pause();
    localStorage.removeItem(LS.name);
    localStorage.removeItem(LS.job);
    setUserName("");
    setUserJob("");
    setInputName("");
    setInputJob("");
    setIsWelcome(true);
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos((prev) => [
      ...prev,
      { id: Date.now(), text: newTodo.trim(), completed: false },
    ]);
    setNewTodo("");
  };
  const toggleTodo = (id: number) =>
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  const deleteTodo = (id: number) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const todayKeyStr = dateKey();
  const yesterdayKeyStr = prevDateKey(todayKeyStr);
  const yesterdaySessions = sessionHistory[yesterdayKeyStr] || 0;

  const focusPct = useMemo(() => {
    if (dailyGoal <= 0) return 0;
    return Math.min((completedPomodoros / dailyGoal) * 100, 100);
  }, [completedPomodoros, dailyGoal]);

  const last7Consistency = useMemo(
    () => getLastNDaysGoalRatio(sessionHistory, dailyGoal, 7),
    [sessionHistory, dailyGoal]
  );

  const totalFocusMinutesToday = completedPomodoros * focusMin;

  /* ===== WELCOME ===== */
  if (isWelcome) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-5xl w-full bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/60 overflow-hidden flex flex-col md:flex-row animate-pop-in">
          <div className="w-full md:w-1/2 p-10 flex flex-col justify-center bg-gradient-to-br from-cyan-600 to-blue-700 text-white">
            <div className="inline-flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-white/20">
              <Sparkles className="w-4 h-4" /> MedStudy AI
            </div>
            <h1 className="text-5xl font-bold mb-4 leading-tight">
              Pomodoro <span className="text-cyan-200">Clinic</span>
            </h1>
            <p className="text-lg text-blue-50 mb-8">
              A focused, professional workspace — with a cat doctor who cares.
            </p>
          </div>

          <div className="w-full md:w-1/2 p-10 flex flex-col justify-center items-center bg-white">
            <div className="w-full max-w-sm">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Welcome 👋
              </h2>
              <p className="text-slate-500 mb-8">Let’s set your profile.</p>

              <form onSubmit={handleNameSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    className="w-full px-5 py-3 bg-slate-50 border-2 rounded-2xl focus:border-cyan-500 outline-none"
                    placeholder="e.g. Kenji"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    Current Role
                  </label>
                  <input
                    type="text"
                    value={inputJob}
                    onChange={(e) => setInputJob(e.target.value)}
                    className="w-full px-5 py-3 bg-slate-50 border-2 rounded-2xl focus:border-cyan-500 outline-none"
                    placeholder="e.g. Student / Intern"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputName.trim() || !inputJob.trim()}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 text-white py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-cyan-200/50"
                >
                  Start Session
                </button>
              </form>
            </div>
          </div>
        </div>
        <AppStyles />
      </div>
    );
  }

  /* ===== MAIN ===== */
  return (
    <div
      className={`w-full min-h-screen ${
        darkMode
          ? "bg-slate-950 text-white"
          : "bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-slate-800"
      } flex items-center justify-center p-4 font-sans`}
    >
      <div
        className={`${
          darkMode
            ? "bg-slate-900/60 border-slate-800"
            : "bg-white/85 border-white/60"
        } backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border p-6 w-full max-w-7xl min-h-[85vh] lg:h-[95vh] flex flex-col lg:flex-row gap-6 overflow-y-auto lg:overflow-hidden relative`}
      >
        {/* Hidden audio */}
        <audio
          ref={audioRef}
          src={audioSrc || undefined}
          loop
          className="hidden"
        />

        {/* TopBar */}
        <div className="absolute left-0 right-0 top-0 px-6 pt-4">
          <div
            className={`${
              darkMode ? "bg-slate-950/40" : "bg-white/70"
            } border ${
              darkMode ? "border-slate-800" : "border-white"
            } rounded-2xl h-12 flex items-center justify-between px-4 backdrop-blur-md`}
          >
            <div className="text-xs font-semibold uppercase tracking-widest opacity-60">
              {isBreak ? "Break" : "Focus"} Mode
            </div>

            <div className="flex items-center gap-1">
              {/* Chat launcher */}
              <IconButton
                onClick={() => setShowChat((p) => !p)}
                label="Toggle chat"
                title="Toggle Dr. Paws Chat"
              >
                <Cat className="w-5 h-5" />
              </IconButton>

              {/* Floating Mini Toggle */}
              <IconButton
                onClick={() => setShowFloating((p) => !p)}
                label="Toggle mini"
                title="Mini floating Pomodoro"
              >
                <Sparkles className="w-5 h-5" />
              </IconButton>

              <IconButton
                onClick={() => setDarkMode((p) => !p)}
                label="Toggle theme"
                title="Toggle theme"
              >
                {darkMode ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </IconButton>

              <IconButton
                onClick={() => setShowStats(true)}
                label="Statistics"
                title="Statistics"
              >
                <BarChart3 className="w-5 h-5" />
              </IconButton>

              <IconButton
                onClick={() => setShowSettings(true)}
                label="Settings"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </IconButton>

              <IconButton onClick={handleLogout} label="Logout" title="Logout">
                <LogOut className="w-5 h-5 text-red-500" />
              </IconButton>
            </div>
          </div>
        </div>

        {/* LEFT */}
        <div className="w-full lg:w-1/4 flex flex-col gap-4 h-auto lg:h-full shrink-0 pt-14">
          <div
            className={`${
              darkMode
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-100"
            } rounded-3xl border p-4 shadow-sm flex items-center justify-between`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-700">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg truncate">
                  {cleanText(userName)}
                </h2>
                <p className="text-xs text-cyan-600 font-bold uppercase tracking-wider truncate">
                  {cleanText(userJob)}
                </p>
              </div>
            </div>
          </div>

          <PetCompanion
            isBreak={isBreak}
            message={assistantMessage}
            onGenerate={() => {
              if (Math.random() > 0.3) {
                const q =
                  FLIRTY_QUOTES[
                    Math.floor(Math.random() * FLIRTY_QUOTES.length)
                  ];
                setAssistantMessage(q.replace(/{name}/g, userName || "You"));
                return;
              }
              sendChat("Give me a flirty one-liner.");
            }}
          />

          {/* Daily Progress + Streak */}
          <div
            className={`${
              darkMode
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-100"
            } rounded-3xl border p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold opacity-60 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4" /> Daily Progress
              </p>
              <div className="flex items-center gap-1 text-xs font-bold text-orange-500">
                <Trophy className="w-4 h-4" />
                {streakDays} day streak
              </div>
            </div>

            <div className="w-full bg-slate-200/70 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${focusPct}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {[...Array(dailyGoal)].map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm ${
                    i < completedPomodoros
                      ? "bg-cyan-600 text-white"
                      : darkMode
                      ? "bg-slate-700 text-slate-400"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs opacity-70 flex items-center justify-between">
              <span>{completedPomodoros} completed</span>
              <span>Goal: {dailyGoal}</span>
            </div>

            {bestStreak > 0 && (
              <div className="mt-3 text-xs font-semibold text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                Best streak: {bestStreak} days
              </div>
            )}
          </div>
        </div>

        {/* CENTER */}
        <div
          className={`flex-1 flex flex-col ${
            darkMode
              ? "bg-slate-900/50 border-slate-800"
              : "bg-white/70 border-white/70"
          } backdrop-blur-md rounded-[2.5rem] border shadow-inner p-6 relative overflow-hidden min-h-[600px] pt-14`}
        >
          <div className="flex-1 flex flex-col items-center justify-center z-10">
            <div className="mb-8">
              <span
                className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest shadow-sm border ${
                  isBreak
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : "bg-cyan-100 text-cyan-800 border-cyan-200"
                }`}
              >
                {isBreak
                  ? isLongBreak
                    ? "☕ Long Break"
                    : "☕ Break Time"
                  : "🧠 Focus Session"}
              </span>
            </div>

            <JellyTimer
              isBreak={isBreak}
              timeString={formatTime(timeLeft)}
              isActive={isActive}
            />

            <div className="flex items-center gap-4 mt-10">
              {!isActive ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-3 bg-cyan-600 text-white px-8 py-4 rounded-2xl shadow font-bold text-lg"
                >
                  <Play className="w-6 h-6" /> Start
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className={`flex items-center gap-3 border-2 px-8 py-4 rounded-2xl shadow-sm font-bold text-lg ${
                    darkMode
                      ? "bg-slate-800 border-slate-700 text-white"
                      : "bg-white border-slate-200 text-slate-700"
                  }`}
                >
                  <Pause className="w-6 h-6" /> Pause
                </button>
              )}

              <button
                onClick={handleReset}
                className={`${
                  darkMode
                    ? "bg-slate-800 text-slate-200"
                    : "bg-slate-100 text-slate-700"
                } p-4 rounded-2xl`}
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            </div>

            <VitalsPanel
              focusMinutes={totalFocusMinutesToday}
              streakDays={streakDays}
              consistency={last7Consistency}
              darkMode={darkMode}
            />
          </div>

          <MusicPanel
            darkMode={darkMode}
            musicMode={musicMode}
            setMusicMode={setMusicMode}
            isPlayingMusic={isPlayingMusic}
            toggleMusic={toggleMusic}
            nextTrack={nextTrack}
            currentTrackIndex={currentTrackIndex}
            youtubeId={youtubeId}
            customAudioLink={customAudioLink}
            setCustomAudioLink={setCustomAudioLink}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            volume={volume}
            setVolume={setVolume}
            audioSrc={audioSrc}
            spotifyLink={spotifyLink}
            setSpotifyLink={setSpotifyLink}
          />
        </div>

        {/* RIGHT */}
        <div
          className={`w-full lg:w-1/4 ${
            darkMode
              ? "bg-slate-800/60 border-slate-700"
              : "bg-white border-slate-100"
          } rounded-[2.5rem] border p-6 shadow-lg flex flex-col h-[500px] lg:h-full pt-14`}
        >
          <h3 className="font-bold text-lg mb-1">Tasks</h3>
          <p className="text-xs opacity-60 mb-4">Break it down! 📝</p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              className={`flex-1 px-4 py-3 border rounded-xl text-sm outline-none ${
                darkMode
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
              placeholder="New task..."
            />
            <button
              onClick={addTodo}
              className="bg-cyan-600 text-white p-3 rounded-xl"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`group border rounded-xl p-3 flex items-center gap-3 ${
                  darkMode
                    ? "bg-slate-900 border-slate-700"
                    : "bg-white border-slate-200"
                }`}
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                    todo.completed
                      ? "bg-cyan-600 border-cyan-600"
                      : darkMode
                      ? "border-slate-600"
                      : "border-slate-300"
                  }`}
                >
                  {todo.completed && <Check className="w-3 h-3 text-white" />}
                </button>

                <span
                  className={`flex-1 text-sm font-medium ${
                    todo.completed ? "line-through opacity-50" : ""
                  }`}
                >
                  {cleanText(todo.text)}
                </span>

                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {todos.length === 0 && (
              <div className="text-center py-10 opacity-50">
                <Check className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm font-medium">No tasks yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Mini */}
      {showFloating && (
        <FloatingMini
          timeString={formatTime(timeLeft)}
          isActive={isActive}
          isBreak={isBreak}
          onToggle={() => (isActive ? handlePause() : handleStart())}
          minimized={floatingMinimized}
          setMinimized={setFloatingMinimized}
        />
      )}

      {/* Chat */}
      {showChat && (
        <ChatBox
          darkMode={darkMode}
          chat={chat}
          onSend={sendChat}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Stats Modal */}
      {showStats && (
        <Modal
          onClose={() => setShowStats(false)}
          darkMode={darkMode}
          title="Statistics"
          icon={<BarChart3 className="w-6 h-6 text-cyan-500" />}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Today Sessions"
                value={completedPomodoros}
                color="text-cyan-500"
                sub={`${completedPomodoros * focusMin} minutes`}
              />
              <StatCard
                label="Yesterday Sessions"
                value={yesterdaySessions}
                color="text-indigo-500"
                sub={`${yesterdaySessions * focusMin} minutes`}
              />
            </div>
            <div className="bg-cyan-500/10 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-sm opacity-70">Today's Focus</p>
                <p className="text-3xl font-bold text-cyan-500">
                  {completedPomodoros * focusMin}m
                </p>
              </div>
              <Clock className="w-8 h-8 text-cyan-500 opacity-50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Goal Streak"
                value={`${streakDays} days`}
                color="text-orange-500"
                sub={`Best: ${bestStreak} days`}
              />
              <StatCard
                label="Daily Goal"
                value={dailyGoal}
                color="text-purple-500"
              />
            </div>
            <StreakCalendar
              sessionHistory={sessionHistory}
              dailyGoal={dailyGoal}
              darkMode={darkMode}
            />
          </div>
        </Modal>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Modal
          onClose={() => setShowSettings(false)}
          darkMode={darkMode}
          title="Settings"
          icon={<Settings className="w-6 h-6 text-cyan-500" />}
        >
          <SettingsContent
            focusMin={focusMin}
            shortBreakMin={shortBreakMin}
            longBreakMin={longBreakMin}
            longBreakInterval={longBreakInterval}
            dailyGoal={dailyGoal}
            darkMode={darkMode}
            notificationsEnabled={notificationsEnabled}
            setFocusMin={setFocusMin}
            setShortBreakMin={setShortBreakMin}
            setLongBreakMin={setLongBreakMin}
            setLongBreakInterval={setLongBreakInterval}
            setDailyGoal={setDailyGoal}
            setDarkMode={setDarkMode}
            setNotificationsEnabled={setNotificationsEnabled}
          />
        </Modal>
      )}

      {/* Dr. Paws launcher button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed left-6 bottom-24 z-50 w-12 h-12 rounded-full bg-cyan-600 text-white shadow-xl grid place-items-center hover:scale-105 transition"
          title="Chat with Dr. Paws"
          aria-label="Chat with Dr. Paws"
        >
          <Cat className="w-6 h-6" />
        </button>
      )}

      <AppStyles />
    </div>
  );
}

/* ====================== GLOBAL STYLES ====================== */
export function AppStyles() {
  return (
    <style>{`
      @media (prefers-reduced-motion: reduce) {
        .animate-pulse-throb, .animate-shake, .animate-float, .animate-breathing { animation: none !important; }
      }

      @keyframes jelly-move {
        0% { border-radius: 45% 55% 70% 30% / 30% 30% 70% 70%; transform: scale(1) rotate(0deg); }
        25% { border-radius: 55% 45% 30% 70% / 70% 70% 30% 30%; transform: scale(1.02) rotate(2deg); }
        50% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: scale(0.98) rotate(-2deg); }
        75% { border-radius: 70% 30% 30% 70% / 70% 70% 30% 30%; transform: scale(1.01) rotate(1deg); }
        100% { border-radius: 45% 55% 70% 30% / 30% 30% 70% 70%; transform: scale(1) rotate(0deg); }
      }

      @keyframes jelly-idle {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }

      @keyframes animate-float {
        0% { transform: translate(-50%, -60%); }
        50% { transform: translate(-50%, -70%); }
        100% { transform: translate(-50%, -60%); }
      }

      @keyframes pulse-throb {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.08); opacity: 1; }
      }

      @keyframes breathing {
        0% { transform: scale(1); text-shadow: 0 0 0 rgba(255,255,255,0); }
        50% { transform: scale(1.04); text-shadow: 0 0 12px rgba(255,255,255,.35); }
        100% { transform: scale(1); text-shadow: 0 0 0 rgba(255,255,255,0); }
      }
      .animate-breathing { animation: breathing 2.6s ease-in-out infinite; }

      @keyframes shake-little {
        0%, 100% { transform: translate3d(0, 0, 0); }
        25% { transform: translate3d(-2px, 1px, 0); }
        50% { transform: translate3d(2px, -1px, 0); }
        75% { transform: translate3d(-1px, 2px, 0); }
      }
      .animate-pulse-throb { animation: pulse-throb 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .animate-shake { animation: shake-little 4s ease-in-out infinite; }

      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

      .eq-bar-a, .eq-bar-b, .eq-bar-c { height: 4px; }
      .eq-bar-a { animation: eq-bar-a 1.1s ease-in-out infinite; transform-origin: bottom; }
      .eq-bar-b { animation: eq-bar-b 1.3s ease-in-out infinite; transform-origin: bottom; }
      .eq-bar-c { animation: eq-bar-c 1.5s ease-in-out infinite; transform-origin: bottom; }
      @keyframes eq-bar-a { 0% { height: 20%; opacity: 0.4; } 50% { height: 100%; opacity: 1; } 100% { height: 30%; opacity: 0.7; } }
      @keyframes eq-bar-b { 0% { height: 30%; opacity: 0.4; } 40% { height: 90%; opacity: 1; } 100% { height: 25%; opacity: 0.7; } }
      @keyframes eq-bar-c { 0% { height: 15%; opacity: 0.4; } 60% { height: 80%; opacity: 1; } 100% { height: 35%; opacity: 0.7; } }
    `}</style>
  );
}
