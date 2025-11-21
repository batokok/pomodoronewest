// src/PomodoroApp.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  Check,
  Coffee,
  FileAudio,
  Link as LinkIcon,
  Loader2,
  Moon,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  SkipForward,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Flame,
  Clock,
} from "lucide-react";

/* ========= CONFIG ========= */
const apiKey = ""; // set via env (Vite): import.meta.env.VITE_GEMINI_API_KEY || ""

/* ========= HELPERS ========= */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanText = (t) =>
  (t || "").replace(/\*\*/g, "").replace(/\*/g, "").trim();
const safeParse = (v, fb) => {
  try {
    const x = JSON.parse(v);
    return x ?? fb;
  } catch {
    return fb;
  }
};
const getYouTubeID = (url) => {
  if (!url) return null;
  const re =
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|[?&]v=)([^#&?]{11}).*/;
  const m = url.match(re);
  return m ? m[1] : null;
};
const dateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const prevDateKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dateKey(dt);
};
const withTimeout = (ms, signal) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  const composite = new AbortController();
  signal?.addEventListener("abort", () => composite.abort());
  ctrl.signal.addEventListener("abort", () => composite.abort());
  return { signal: composite.signal, cancel: () => clearTimeout(t) };
};

/* ========= API ========= */
async function callGeminiAPI(prompt) {
  if (!apiKey) return "";
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=" +
    encodeURIComponent(apiKey);
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  for (let i = 0; i < 3; i++) {
    const { signal, cancel } = withTimeout(12000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      cancel();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      cancel();
      if (i === 2) return "";
      await delay(2 ** i * 500);
    }
  }
  return "";
}

/* ========= DATA ========= */
const MUSIC_TRACKS = [
  {
    title: "Lofi Study",
    url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
  },
  {
    title: "Soft Rain",
    url: "https://cdn.pixabay.com/audio/2021/09/06/audio_311705f0d2.mp3",
  },
  {
    title: "Medical Piano",
    url: "https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3",
  },
];
const ALARM_URL =
  "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
const FLIRTY_QUOTES = [
  "Hey {name}, are you a pulmonary embolism? Because you take my breath away! 😻",
  "You must be the cure, {name}, because I feel better just looking at you! 🩺",
  "Is your name WiFi? Because I'm feeling a strong connection, {name}! 😸",
  "Are you a defibrillator? You're sending shocks to my heart! ⚡",
  "Forget the anatomy book, I'd rather study you, {name}! (Just kidding, study!) 😹",
  "You're so sweet, you're giving me hyperglycemia! 🍬",
  "If I were an enzyme, I'd be DNA helicase so I could unzip your... notes! 🧬",
  "My love for you is like diarrhea, I just can't hold it in! 💩",
  "Are you a C-section? Because you dilate my pupils! 👀",
  "{name}, you must be a magician? Because whenever I look at you, everyone else disappears! ✨",
];

/* ========= UI: Timer Blob ========= */
function JellyTimer({ isBreak, timeString, isActive }) {
  const colors = isBreak
    ? {
        from: "from-emerald-300",
        to: "to-teal-400",
        glow: "bg-emerald-400",
        icon: <Coffee className="w-12 h-12 text-white/90" />,
      }
    : {
        from: "from-cyan-400",
        to: "to-blue-600",
        glow: "bg-cyan-500",
        icon: <Brain className="w-12 h-12 text-white/90" />,
      };

  return (
    <div className="relative w-72 h-72 flex items-center justify-center group">
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
          filter: isActive ? "brightness(1.05)" : "brightness(1)",
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
            isActive ? "scale-105" : "scale-100"
          }`}
        >
          {timeString}
        </span>
        <span className="text-sm font-bold uppercase tracking-widest mt-2 text-white/90 flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
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

/* ========= UI: Pet ========= */
function PetCompanion({ isBreak, message, onGenerate }) {
  return (
    <div className="relative w-full bg-white rounded-3xl border border-blue-100 p-6 shadow-sm flex flex-col items-center overflow-visible group transition-all hover:shadow-lg">
      {message && (
        <div className="absolute -top-12 z-20 w-full px-4">
          <div className="bg-slate-800 text-white rounded-2xl p-4 shadow-lg relative flex items-center justify-center text-center border-2 border-slate-700">
            <p className="text-sm font-medium leading-relaxed italic">
              "{message}"
            </p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 rotate-45 border-r border-b border-slate-700" />
          </div>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-blue-50 to-transparent rounded-t-3xl" />
      <div
        className="relative z-10 flex flex-col items-center cursor-pointer mt-4 animate-shake"
        onClick={onGenerate}
      >
        <div
          className={`w-36 h-36 rounded-full flex items-center justify-center bg-white border-4 ${
            isBreak ? "border-emerald-200" : "border-blue-200"
          }`}
        >
          <div className="relative">
            <span className="text-7xl drop-shadow-sm select-none">
              {isBreak ? "😴" : "🐱"}
            </span>
            {!isBreak && (
              <span className="absolute -bottom-2 -right-4 text-4xl drop-shadow-sm rotate-12">
                🩺
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        <h3 className="font-bold text-slate-700 text-xl">Dr. Paws</h3>
        <p className="text-xs text-blue-400 font-bold uppercase tracking-wide">
          Your Pomodoro Buddy
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onGenerate();
        }}
        className="absolute top-3 right-3 p-2 text-white bg-cyan-500 rounded-full shadow-sm hover:scale-110 transition-transform hover:bg-cyan-600 border-2 border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        title="Inspire me"
        aria-label="Inspire me"
      >
        <Sparkles className="w-5 h-5" />
      </button>
    </div>
  );
}

/* ========= UI: Music Panel ========= */
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
}) {
  return (
    <div
      className={`${
        darkMode
          ? "bg-slate-700/50 border-slate-600"
          : "bg-white/80 border-slate-200"
      } backdrop-blur-sm rounded-2xl p-4 border shadow-sm mt-4 w-full`}
    >
      <div
        className={`flex gap-4 mb-3 border-b pb-2 ${
          darkMode ? "border-slate-600" : "border-slate-100"
        }`}
      >
        <button
          onClick={() => setMusicMode("preset")}
          className={`text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded ${
            musicMode === "preset"
              ? "text-cyan-600"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          Preset
        </button>
        <button
          onClick={() => setMusicMode("custom")}
          className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded ${
            musicMode === "custom"
              ? "text-indigo-600"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <LinkIcon className="w-3 h-3" /> Custom Link
        </button>
      </div>

      {musicMode === "preset" ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isPlayingMusic
                  ? "bg-cyan-100 text-cyan-600"
                  : darkMode
                  ? "bg-slate-600 text-slate-400"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Music
                className={`w-5 h-5 ${isPlayingMusic ? "animate-pulse" : ""}`}
              />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold opacity-50 uppercase">
                Now Playing
              </p>
              <p className="text-sm font-bold truncate">
                {MUSIC_TRACKS[currentTrackIndex].title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsMuted((p) => !p)}
              className={`p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                darkMode
                  ? "hover:bg-slate-600 text-slate-300"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={toggleMusic}
              className={`p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                isPlayingMusic
                  ? "bg-cyan-500 text-white shadow"
                  : darkMode
                  ? "bg-slate-600 text-slate-200"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              aria-label={isPlayingMusic ? "Pause music" : "Play music"}
            >
              {isPlayingMusic ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className={`p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                darkMode
                  ? "bg-slate-600 text-slate-200 hover:bg-slate-500"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              aria-label="Next track"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {youtubeId ? (
            <div
              className={`relative w-full rounded-xl overflow-hidden border mt-2 ${
                darkMode
                  ? "bg-black border-slate-600"
                  : "bg-black border-slate-200"
              }`}
            >
              <button
                onClick={() => setCustomAudioLink("")}
                className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                aria-label="Remove YouTube"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="relative h-32">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1`}
                  title="YouTube"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FileAudio className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                <input
                  type="text"
                  value={customAudioLink}
                  onChange={(e) => setCustomAudioLink(e.target.value)}
                  placeholder="Link YouTube / MP3..."
                  className={`w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-400 ${
                    darkMode
                      ? "bg-slate-900 border-slate-600 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                  aria-label="Custom audio link"
                />
              </div>
              <button
                onClick={toggleMusic}
                className={`p-2 rounded-lg shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isPlayingMusic
                    ? "bg-indigo-500 text-white"
                    : darkMode
                    ? "bg-slate-600 text-slate-200"
                    : "bg-slate-200 text-slate-700"
                }`}
                aria-label={isPlayingMusic ? "Pause audio" : "Play audio"}
              >
                {isPlayingMusic ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
          <p className="text-[10px] opacity-60 italic pl-1">
            *Supports YouTube Links & MP3
          </p>
        </div>
      )}
    </div>
  );
}

/* ========= MAIN ========= */
export default function PomodoroApp() {
  // identity
  const [userName, setUserName] = useState("");
  const [userJob, setUserJob] = useState("");
  const [inputName, setInputName] = useState("");
  const [inputJob, setInputJob] = useState("");
  const [isWelcome, setIsWelcome] = useState(true);

  // settings
  const [focusMin, setFocusMin] = useState(25);
  const [shortBreakMin, setShortBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [longBreakInterval, setLongBreakInterval] = useState(4);

  // timer
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [isLongBreak, setIsLongBreak] = useState(false);

  // sessions
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [sessionHistory, setSessionHistory] = useState({});

  // ui state
  const [assistantMessage, setAssistantMessage] = useState("");
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(8);

  // music
  const [musicMode, setMusicMode] = useState("preset");
  const [customAudioLink, setCustomAudioLink] = useState("");
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [loadingTaskIds, setLoadingTaskIds] = useState(new Set());

  // refs
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const dayRef = useRef(dateKey());
  const quoteTimerRef = useRef(null); // why: auto-hide message after 30s

  // quote auto-hide 30s
  useEffect(() => {
    if (!assistantMessage) return;
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = setTimeout(() => setAssistantMessage(""), 30_000);
    return () => quoteTimerRef.current && clearTimeout(quoteTimerRef.current);
  }, [assistantMessage]);

  // load
  useEffect(() => {
    const savedName = localStorage.getItem("pomodoro_user_name");
    const savedJob = localStorage.getItem("pomodoro_user_job");
    const savedTodos = localStorage.getItem("pomodoro_todos");
    const savedTheme = localStorage.getItem("pomodoro_theme");
    const savedGoal = localStorage.getItem("pomodoro_goal");
    const savedFocus = localStorage.getItem("pomodoro_focus_min");
    const savedShort = localStorage.getItem("pomodoro_short_min");
    const savedLong = localStorage.getItem("pomodoro_long_min");
    const savedInterval = localStorage.getItem("pomodoro_long_interval");
    const savedHistory = safeParse(
      localStorage.getItem("pomodoro_history"),
      {}
    );
    const legacyCompleted =
      parseInt(localStorage.getItem("pomodoro_completed") || "0") || 0;
    const today = dateKey();
    if (savedHistory[today] == null && legacyCompleted > 0)
      savedHistory[today] = legacyCompleted;
    setSessionHistory(savedHistory);
    setCompletedPomodoros(savedHistory[today] || 0);

    let initialName = "";
    if (savedName) {
      setUserName(savedName);
      initialName = savedName;
      setIsWelcome(false);
    }
    if (savedJob) setUserJob(savedJob);
    if (savedTodos) setTodos(safeParse(savedTodos, []));
    if (savedTheme === "dark") setDarkMode(true);
    if (savedGoal) setDailyGoal(parseInt(savedGoal) || 8);
    if (savedFocus) setFocusMin(Math.max(1, parseInt(savedFocus) || 25));
    if (savedShort) setShortBreakMin(Math.max(1, parseInt(savedShort) || 5));
    if (savedLong) setLongBreakMin(Math.max(5, parseInt(savedLong) || 15));
    if (savedInterval)
      setLongBreakInterval(Math.max(2, parseInt(savedInterval) || 4));

    const q = FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)];
    setAssistantMessage(q.replace(/{name}/g, initialName || "Future Doctor"));
  }, []);

  // save
  useEffect(() => {
    if (isWelcome) return;
    localStorage.setItem("pomodoro_todos", JSON.stringify(todos));
    localStorage.setItem("pomodoro_theme", darkMode ? "dark" : "light");
    localStorage.setItem("pomodoro_goal", String(dailyGoal));
    localStorage.setItem("pomodoro_focus_min", String(focusMin));
    localStorage.setItem("pomodoro_short_min", String(shortBreakMin));
    localStorage.setItem("pomodoro_long_min", String(longBreakMin));
    localStorage.setItem("pomodoro_long_interval", String(longBreakInterval));
    localStorage.setItem("pomodoro_history", JSON.stringify(sessionHistory));
    localStorage.setItem("pomodoro_completed", String(completedPomodoros));
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
    completedPomodoros,
  ]);

  // midnight rollover
  useEffect(() => {
    const id = setInterval(() => {
      const nowKey = dateKey();
      if (nowKey !== dayRef.current) {
        dayRef.current = nowKey;
        setCompletedPomodoros(sessionHistory[nowKey] || 0);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [sessionHistory]);

  // reset displayed time when settings change (idle)
  useEffect(() => {
    if (isActive) return;
    const secs =
      (isBreak ? (isLongBreak ? longBreakMin : shortBreakMin) : focusMin) * 60;
    setTimeLeft(secs);
  }, [focusMin, shortBreakMin, longBreakMin, isBreak, isLongBreak, isActive]);

  // music
  const youtubeId = getYouTubeID(customAudioLink);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (musicMode === "custom" && youtubeId) {
      setIsPlayingMusic(false);
      return;
    }
    let src = "";
    if (musicMode === "preset") src = MUSIC_TRACKS[currentTrackIndex].url;
    else if (musicMode === "custom" && customAudioLink && !youtubeId)
      src = customAudioLink;
    if (!src) return;
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = isMuted ? 0 : volume / 100;
    audio.onerror = () => setIsPlayingMusic(false);
    audioRef.current = audio;
    if (isPlayingMusic) audio.play().catch(() => setIsPlayingMusic(false));
    return () => audio.pause();
  }, [
    musicMode,
    currentTrackIndex,
    customAudioLink,
    youtubeId,
    isMuted,
    volume,
    isPlayingMusic,
  ]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  const toggleMusic = () => setIsPlayingMusic((p) => !p);
  const nextTrack = () =>
    setCurrentTrackIndex((p) => (p + 1) % MUSIC_TRACKS.length);

  // ai
  const generateAIMotivation = async () => {
    if (Math.random() > 0.3 || isGeneratingAI) {
      const q = FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)];
      setAssistantMessage(q.replace(/{name}/g, userName || "You"));
      return;
    }
    setIsGeneratingAI(true);
    try {
      const text = await callGeminiAPI(
        `You are Dr. Paws, a flirty but cute cat doctor. User: "${userName}". Give ONE short playful/flirty sentence using medical puns. Language: English.`
      );
      if (text) setAssistantMessage(cleanText(text));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleBreakdownTask = async (taskId, taskText) => {
    setLoadingTaskIds((prev) => new Set(prev).add(taskId));
    try {
      let responseText = await callGeminiAPI(
        `Break down task "${taskText}" into 3 concise steps. Respond ONLY a JSON array of strings.`
      );
      responseText = responseText.replace(/```json|```/g, "").trim();
      const subtasks = safeParse(responseText, null);
      if (Array.isArray(subtasks)) {
        const newSubtasks = subtasks.map((text) => ({
          id: Date.now() + Math.random(),
          text: cleanText(String(text)),
          completed: false,
        }));
        setTodos((prev) => {
          const idx = prev.findIndex((t) => t.id === taskId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated.splice(idx + 1, 0, ...newSubtasks);
          return updated;
        });
      }
    } finally {
      setLoadingTaskIds((prev) => {
        const n = new Set(prev);
        n.delete(taskId);
        return n;
      });
    }
  };

  // timer loop
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
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

  const nextBreakIsLong = (nextCount) =>
    nextCount > 0 && nextCount % Math.max(2, longBreakInterval) === 0;

  const incrementTodaySession = () => {
    const today = dateKey();
    const next = (sessionHistory[today] || 0) + 1;
    const newHistory = { ...sessionHistory, [today]: next };
    setSessionHistory(newHistory);
    setCompletedPomodoros(next);
  };

  const handleTimerComplete = () => {
    setIsActive(false);
    const alarm = new Audio(ALARM_URL);
    alarm.volume = 0.5;
    alarm.play().catch(() => {});
    if (!isBreak) {
      incrementTodaySession();
      const nextCount = (sessionHistory[dateKey()] || 0) + 1;
      const longNow = nextBreakIsLong(nextCount);
      setIsBreak(true);
      setIsLongBreak(longNow);
      setTimeLeft((longNow ? longBreakMin : shortBreakMin) * 60);
      setAssistantMessage(
        `Great work ${userName || ""}! You make my heart skip a beat! 💓`
      );
    } else {
      setIsBreak(false);
      setIsLongBreak(false);
      setTimeLeft(focusMin * 60);
      setAssistantMessage("Break over! I missed you, let's focus! 😻");
    }
  };

  const handleStart = () => {
    setIsActive(true);
    setAssistantMessage("Laser focus on, cutie! 👀");
  };
  const handlePause = () => {
    setIsActive(false);
    setAssistantMessage("Paused? Don't leave me hanging! 😿");
  };
  const handleReset = () => {
    setIsActive(false);
    const secs =
      (isBreak ? (isLongBreak ? longBreakMin : shortBreakMin) : focusMin) * 60;
    setTimeLeft(secs);
    setAssistantMessage("Ready to start again?");
  };

  const handleNameSubmit = (e) => {
    e?.preventDefault();
    if (inputName.trim() && inputJob.trim()) {
      const n = cleanText(inputName);
      const j = cleanText(inputJob);
      localStorage.setItem("pomodoro_user_name", n);
      localStorage.setItem("pomodoro_user_job", j);
      setUserName(n);
      setUserJob(j);
      setIsWelcome(false);
      const q = FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)];
      setAssistantMessage(q.replace(/{name}/g, n));
      setTimeLeft(focusMin * 60);
    }
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos((prev) => [
      ...prev,
      { id: Date.now(), text: newTodo.trim(), completed: false },
    ]);
    setNewTodo("");
  };
  const toggleTodo = (id) =>
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  const deleteTodo = (id) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));
  const formatTime = (s) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const todayKeyStr = dateKey();
  const yesterdayKeyStr = prevDateKey(todayKeyStr);
  const yesterdaySessions = sessionHistory[yesterdayKeyStr] || 0;

  /* ======= WELCOME ======= */
  if (isWelcome) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-5xl w-full bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/60 overflow-hidden flex flex-col md:flex-row animate-pop-in">
          <div className="w-full md:w-1/2 p-10 flex flex-col justify-center bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
            <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-white/30">
              <Sparkles className="w-4 h-4" /> Your Pomodoro Buddy
            </div>
            <h1 className="text-5xl font-bold mb-4 leading-tight">
              MedStudy <span className="text-cyan-200">AI</span>
            </h1>
            <p className="text-lg text-blue-50 mb-8">
              Your intelligent productivity companion.
            </p>
          </div>
          <div className="w-full md:w-1/2 p-10 flex flex-col justify-center items-center bg-white">
            <div className="w-full max-w-sm">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Welcome! 👋
              </h2>
              <p className="text-slate-500 mb-8">Let's get you set up.</p>
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
                    placeholder="e.g. Sarah"
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
                    placeholder="e.g. Medical Student"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputName.trim() || !inputJob.trim()}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-cyan-200/50"
                >
                  Start Session
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ======= MAIN ======= */
  return (
    <div
      className={`w-full min-h-screen ${
        darkMode
          ? "bg-slate-900 text-white"
          : "bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-slate-800"
      } flex items-center justify-center p-4 font-sans`}
    >
      <div
        className={`${
          darkMode
            ? "bg-slate-800/50 border-slate-700"
            : "bg-white/80 border-white/50"
        } backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border p-6 w-full max-w-7xl min-h-[85vh] lg:h-[95vh] flex flex-col lg:flex-row gap-6 overflow-y-auto lg:overflow-hidden relative`}
      >
        {/* TopBar: centered vertically within the bubble, actions top-right */}
        <div className="absolute left-0 right-0 top-0 px-6 pt-4">
          <div
            className={`${
              darkMode ? "bg-slate-900/20" : "bg-white/60"
            } border ${
              darkMode ? "border-slate-700" : "border-white"
            } rounded-2xl h-12 flex items-center justify-between px-4 backdrop-blur-md`}
          >
            <div className="text-xs font-semibold uppercase tracking-widest opacity-60">
              {/* Placeholder left slot (keep balanced). Put logo/text here if you want. */}
            </div>
            <div className="flex items-center gap-1">
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
            </div>
          </div>
        </div>

        {/* LEFT */}
        <div className="w-full lg:w-1/4 flex flex-col gap-4 h-auto lg:h-full shrink-0 pt-14">
          <div
            className={`${
              darkMode
                ? "bg-slate-700 border-slate-600"
                : "bg-white border-slate-100"
            } rounded-3xl border p-4 shadow-sm flex items-center justify-between`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600">
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
            onGenerate={generateAIMotivation}
          />

          <div
            className={`${
              darkMode
                ? "bg-slate-700 border-slate-600"
                : "bg-white border-slate-100"
            } rounded-3xl border p-5 shadow-sm`}
          >
            <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Daily Progress
            </p>
            <div className="flex flex-wrap gap-2">
              {[...Array(dailyGoal)].map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm transition-all ${
                    i < completedPomodoros
                      ? "bg-cyan-500 text-white"
                      : darkMode
                      ? "bg-slate-600 text-slate-400"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs opacity-60 flex items-center justify-between">
              <span>{completedPomodoros} completed</span>
              <span>Goal: {dailyGoal}</span>
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div
          className={`flex-1 flex flex-col ${
            darkMode
              ? "bg-slate-800/50 border-slate-700"
              : "bg-white/60 border-white/60"
          } backdrop-blur-md rounded-[2.5rem] border shadow-inner p-6 relative overflow-hidden min-h-[600px] pt-14`}
        >
          <div className="flex-1 flex flex-col items-center justify-center z-10">
            <div className="mb-8">
              <span
                className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest shadow-sm border ${
                  isBreak
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-blue-100 text-blue-700 border-blue-200"
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
                  className="flex items-center gap-3 bg-cyan-500 text-white px-8 py-4 rounded-2xl shadow hover:scale-[1.01] transition-all font-bold text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <Play className="w-6 h-6" /> Start
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className={`flex items-center gap-3 border-2 px-8 py-4 rounded-2xl shadow-sm transition-all font-bold text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    darkMode
                      ? "bg-slate-700 border-slate-600 text-white"
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
                    ? "bg-slate-700 text-slate-200"
                    : "bg-slate-100 text-slate-700"
                } p-4 rounded-2xl hover:opacity-80 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
                aria-label="Reset timer"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            </div>
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
          />
        </div>

        {/* RIGHT */}
        <div
          className={`w-full lg:w-1/4 ${
            darkMode
              ? "bg-slate-700/50 border-slate-600"
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
              className={`flex-1 px-4 py-3 border rounded-xl text-sm outline-none focus:border-cyan-500 ${
                darkMode
                  ? "bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
              placeholder="New task..."
              aria-label="New task"
            />
            <button
              onClick={addTodo}
              className="bg-cyan-500 text-white p-3 rounded-xl hover:bg-cyan-600 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Add task"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`group border rounded-xl p-3 flex items-center gap-3 transition-all ${
                  darkMode
                    ? "bg-slate-800 border-slate-600 hover:border-cyan-500/50"
                    : "bg-white border-slate-200 hover:border-cyan-200"
                }`}
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    todo.completed
                      ? "bg-cyan-500 border-cyan-500"
                      : darkMode
                      ? "border-slate-500"
                      : "border-slate-300"
                  }`}
                  aria-label={
                    todo.completed ? "Mark as not done" : "Mark as done"
                  }
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

                {!todo.completed && (
                  <button
                    onClick={() => handleBreakdownTask(todo.id, todo.text)}
                    disabled={loadingTaskIds.has(todo.id)}
                    className="text-indigo-500 hover:text-indigo-600 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-500/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    title="Ask AI"
                    aria-label="Break down task with AI"
                  >
                    <Loader2
                      className={`w-3.5 h-3.5 ${
                        loadingTaskIds.has(todo.id) ? "animate-spin" : ""
                      }`}
                    />
                  </button>
                )}

                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label="Delete task"
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
                label="Sessions"
                value={completedPomodoros}
                color="text-emerald-500"
              />
              <StatCard
                label="Goal"
                value={dailyGoal}
                color="text-purple-500"
              />
            </div>
            <div className="bg-orange-500/10 p-4 rounded-2xl flex items-center gap-3">
              <Flame className="w-6 h-6 text-orange-500" />
              <div className="w-full">
                <p className="font-bold text-orange-500">
                  {completedPomodoros >= dailyGoal
                    ? "Goal Reached! 🔥"
                    : `${Math.max(
                        dailyGoal - completedPomodoros,
                        0
                      )} more to go!`}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 dark:bg-gray-700">
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (completedPomodoros / dailyGoal) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
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
              numberOnly
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
              <label className="block text-sm font-bold mb-2 opacity-70">
                Theme
              </label>
              <button
                onClick={() => setDarkMode((p) => !p)}
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
                  darkMode ? "bg-slate-700" : "bg-slate-100"
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
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="text-red-500 text-sm hover:underline flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Reset All Data
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Styles */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse-throb, .animate-shake, .animate-float { animation: none !important; }
        }
        @keyframes jelly-move {
          0% { border-radius: 45% 55% 70% 30% / 30% 30% 70% 70%; transform: scale(1) rotate(0deg); }
          25% { border-radius: 55% 45% 30% 70% / 70% 70% 30% 30%; transform: scale(1.02) rotate(2deg); }
          50% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: scale(0.98) rotate(-2deg); }
          75% { border-radius: 70% 30% 30% 70% / 70% 70% 30% 30%; transform: scale(1.01) rotate(1deg); }
          100% { border-radius: 45% 55% 70% 30% / 30% 30% 70% 70%; transform: scale(1) rotate(0deg); }
        }
        @keyframes jelly-idle { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
        @keyframes animate-float { 0% { transform: translate(-50%, -60%); } 50% { transform: translate(-50%, -70%); } 100% { transform: translate(-50%, -60%); } }
        .animate-pulse-throb { animation: pulse-throb 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-shake { animation: shake-little 4s ease-in-out infinite; }
        .animate-float { animation: animate-float 3s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}

/* ========= REUSABLES ========= */
function IconButton({ onClick, label, title, children }) {
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

function Modal({ onClose, darkMode, title, icon, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`${
          darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-800"
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
  numberOnly = false,
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
          {...(numberOnly ? {} : {})}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }) {
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
