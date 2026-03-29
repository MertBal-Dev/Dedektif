'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Case, Character, Evidence, Puzzle } from '@/types/game';
import { useGame } from '@/features/useGame';
import {
  Book, Users, Search, Puzzle as PuzzleIcon, Gavel, ArrowLeft,
  Fingerprint, MessageSquare, MapPin, Briefcase, Info, Send, Loader2,
  Lock, ChevronDown, ChevronUp, Star, AlertTriangle, Trophy, Plus,
  NotebookPen, Eye, EyeOff, Clock, CheckCircle2, XCircle,
  Skull, BookOpen, X, Zap, Target, HelpCircle,
  ScanSearch, User, Hash, ArrowRight, Volume2, VolumeX,
  Quote, Sparkles, Lightbulb, FlaskConical, Link,
} from 'lucide-react';
import { generateSpeechAction } from '@/app/actions/tts';
import { InteractiveScene } from '@/components/InteractiveScene';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Typewriter (Plan Madde 3) ────────────────────────────────────────────────
// Karakterin cevabını harf harf yazıyormuş gibi gösterir.
// onCharacter: her `charInterval` karakterde bir tetiklenir (daktilo sesi için)
function Typewriter({
  text,
  speed = 18,
  onDone,
  onCharacter,
  charInterval = 6,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
  onCharacter?: () => void;
  charInterval?: number;
}) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const onDoneRef = useRef(onDone);
  const onCharRef = useRef(onCharacter);
  onDoneRef.current = onDone;
  onCharRef.current = onCharacter;

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    indexRef.current = 0;

    if (!text) return;

    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));

      // Her charInterval karakterde bir ses tetikle
      if (indexRef.current % charInterval === 0) {
        onCharRef.current?.();
      }

      if (indexRef.current >= text.length) {
        clearInterval(interval);
        setDone(true);
        onDoneRef.current?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, charInterval]);

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block w-[2px] h-[1em] bg-amber-400/70 align-middle ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

// ─── useSound (Plan Madde 4) ──────────────────────────────────────────────────
// Ses motorunu Web Audio API ile yönetir; Dış ortamdan dosya çekmez (0 Byte Asset).
// Bu sayede "Access Denied" veya "404" sorunları yaşanmaz.
type SoundKey = 'click' | 'discover' | 'success';

function useSound() {
  const play = useCallback((key: SoundKey, volume?: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, type: OscillatorType, duration: number, vol: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        // Eğer dışarıdan volume gelmişse onu kullan, yoksa varsayılanı kullan
        const finalVol = volume !== undefined ? volume : vol;
        g.gain.setValueAtTime(finalVol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      };

      if (key === 'click') {
        playTone(600, 'sine', 0.08, 0.04);
      } else if (key === 'discover') {
        playTone(400, 'triangle', 0.3, 0.04);
        setTimeout(() => playTone(800, 'triangle', 0.3, 0.03), 50);
      } else if (key === 'success') {
        playTone(523, 'sine', 0.5, 0.04); // C5
        setTimeout(() => playTone(659, 'sine', 0.5, 0.04), 100); // E5
        setTimeout(() => playTone(783, 'sine', 0.5, 0.04), 200); // G5
      }
    } catch (e) {
      console.warn("Sound play failed", e);
    }
  }, []);
  return { play };
}

// ─── CaseImage ────────────────────────────────────────────────────────────────
function CaseImage({
  src,
  alt,
  fallbackSeed,
  className,
  style,
  onClick,
  contain = false,
}: {
  src?: string;
  alt: string;
  fallbackSeed: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  contain?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const fallback = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(fallbackSeed)}&backgroundColor=0a0a0a&shapeColor=333333`;
  const imgSrc = (!src || error) ? fallback : src;

  return (
    <div
      className={cn('relative overflow-hidden bg-black/40', onClick ? 'cursor-zoom-in' : '', className)}
      style={style}
      onClick={onClick}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#070707]">
          <Loader2 className="text-accent/20 animate-spin" size={20} />
        </div>
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={cn(
          'w-full h-full transition-all duration-700',
          contain ? 'object-contain' : 'object-cover',
          loaded ? 'opacity-100' : 'opacity-0 scale-105',
          error ? 'grayscale opacity-40' : '',
        )}
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(true); }}
        loading="lazy"
      />
      {!contain && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      )}
      {onClick && loaded && !error && (
        <div className="absolute top-2 right-2 z-20 bg-black/60 p-1.5 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ScanSearch size={13} className="text-white/70" />
        </div>
      )}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function LightboxModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/97 z-[500] flex flex-col items-center justify-center p-3 sm:p-5 md:p-10 backdrop-blur-2xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative flex flex-col items-center max-w-5xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/60">
          <img
            src={src}
            alt={alt}
            className="w-full max-h-[78vh] object-contain"
          />
        </div>
        <div className="mt-5 text-center space-y-2">
          <h3 className="text-xl font-serif text-white">{alt}</h3>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-accent/30" />
            <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-accent/70">Detaylı İnceleme</span>
            <div className="h-px w-10 bg-accent/30" />
          </div>
        </div>
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 md:top-0 md:right-0 p-2.5 bg-white/5 hover:bg-white/15 rounded-full border border-white/10 text-white/60 hover:text-white transition-all"
        >
          <X size={20} />
        </button>
      </motion.div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SuspicionMeter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Şüphe Seviyesi</span>
        <span className="text-[10px] font-mono text-accent font-bold">{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none cursor-pointer rounded-full outline-none"
        style={{ background: `linear-gradient(to right, #d4af37 0%, #8b0000 ${value}%, #1a1a1a ${value}%)` }}
      />
    </div>
  );
}

function PuzzleTypeIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    riddle: { icon: <HelpCircle size={13} />, label: 'Bilmece', color: 'text-yellow-400' },
    code: { icon: <Hash size={13} />, label: 'Şifre', color: 'text-blue-400' },
    cipher: { icon: <Zap size={13} />, label: 'Kriptografi', color: 'text-purple-400' },
    logic: { icon: <Target size={13} />, label: 'Mantık', color: 'text-green-400' },
    sequence: { icon: <ArrowRight size={13} />, label: 'Dizi', color: 'text-orange-400' },
    image: { icon: <Eye size={13} />, label: 'Görsel', color: 'text-pink-400' },
  };
  const t = map[type] || map.riddle;
  return (
    <span className={cn('flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest', t.color)}>
      {t.icon}{t.label}
    </span>
  );
}

function DifficultyBadge({ level }: { level?: 'easy' | 'medium' | 'hard' }) {
  const map = {
    easy: { label: 'Kolay', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
    medium: { label: 'Orta', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    hard: { label: 'Zor', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  };
  const d = map[level || 'medium'];
  return <span className={cn('px-2 py-0.5 rounded text-[8px] uppercase font-bold border', d.cls)}>{d.label}</span>;
}

function ScoreWidget({ score, foundCount, solvedPuzzles }: { score: number; foundCount: number; solvedPuzzles: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 bg-[#0a0a0a] border border-white/5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
      <div className="flex items-center gap-1 sm:gap-1.5 text-accent">
        <Trophy size={12} />
        <span className="font-mono font-bold text-[11px] sm:text-xs">{score.toLocaleString()}</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <div className="flex items-center gap-1 text-gray-400">
        <Search size={11} /><span className="text-[11px] font-mono">{foundCount}</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <div className="flex items-center gap-1 text-gray-400">
        <PuzzleIcon size={11} /><span className="text-[11px] font-mono">{solvedPuzzles}</span>
      </div>
    </div>
  );
}

// ─── GameView ─────────────────────────────────────────────────────────────────
type TabType = 'story' | 'suspects' | 'evidence' | 'puzzles' | 'notebook';

export default function GameView({ caseData }: { caseData: Case }) {
  const [activeTab, setActiveTab] = useState<TabType>('story');
  const {
    solvePuzzle, findEvidence, interrogate, makeAccusation,
    gameState, setSuspicionLevel, addNotebookEntry, useHint, exitCase, clearStorage,
    caseResolution, setCaseResolution,
    notification, showNotification,
    confrontationResult, clearConfrontation,
    isLoading, loadingMessage,
    getSmartHint, lastActivityTime,
  } = useGame();
  const { play } = useSound();

  const [selectedSuspect, setSelectedSuspect] = useState<Character | null>(null);
  const [selectedAccusationSuspect, setSelectedAccusationSuspect] = useState<Character | null>(null);
  const [accusationResult, setAccusationResult] = useState<{ correct: boolean; message: string } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  // ── Hardcore Gizem: Yardım Al butonu state ───────────────────────────────────
  const [smartHint, setSmartHint] = useState<{ type: string; message: string; targetId?: string } | null>(null);
  const [isHintStuck, setIsHintStuck] = useState(false); // 15dk hareketsizlik uyarısı

  const foundCount = gameState.foundEvidenceIds.length;
  const solvedPuzzles = gameState.unlockedClueIds.length;

  // ── Hardcore Gizem: 15 dakika hareketsizlik kontrolü ─────────────────────────
  useEffect(() => {
    const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 dakika
    const interval = setInterval(() => {
      if (Date.now() - lastActivityTime > STUCK_THRESHOLD_MS) {
        setIsHintStuck(true);
      } else {
        setIsHintStuck(false);
      }
    }, 30_000); // 30 saniyede bir kontrol
    return () => clearInterval(interval);
  }, [lastActivityTime]);

  // ── Ses kaplama fonksiyonları (Plan Madde 4) ─────────────────────────────────
  const findEvidenceWithSound = useCallback((id: string) => {
    findEvidence(id);
    play('discover');
  }, [findEvidence, play]);

  const solvePuzzleWithSound = useCallback(async (id: string, answer: string) => {
    const result = await solvePuzzle(id, answer);
    if (result.isCorrect) play('success');
    return result;
  }, [solvePuzzle, play]);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'story', label: 'Vaka Dosyası', icon: <Book size={16} /> },
    { id: 'suspects', label: 'Şüpheliler', icon: <Users size={16} /> },
    { id: 'evidence', label: 'Kanıtlar', icon: <Search size={16} />, badge: foundCount },
    { id: 'puzzles', label: 'Bulmacalar', icon: <PuzzleIcon size={16} />, badge: solvedPuzzles },
    { id: 'notebook', label: 'Not Defteri', icon: <NotebookPen size={16} /> },
  ];

  return (
    <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center pb-24 lg:pb-8 pt-3 sm:pt-5 px-3 sm:px-4 md:px-6 relative selection:bg-primary/30 selection:text-white">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={cn(
              "fixed top-6 sm:top-8 left-1/2 -translate-x-1/2 z-[2000] px-5 py-3 rounded-full text-xs sm:text-sm font-bold flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border backdrop-blur-xl max-w-[90vw] w-max min-w-[280px] sm:min-w-[320px] justify-center",
              notification.type === 'success' && "bg-green-950/90 border-green-500/50 text-green-300",
              notification.type === 'info' && "bg-[#1a1200]/90 border-accent/50 text-accent",
              notification.type === 'warning' && "bg-red-950/90 border-red-500/50 text-red-300",
            )}
          >
            {notification.type === 'success' && <CheckCircle2 size={14} className="flex-shrink-0" />}
            {notification.type === 'info' && <Info size={14} className="flex-shrink-0" />}
            {notification.type === 'warning' && <AlertTriangle size={14} className="flex-shrink-0" />}
            <span className="truncate">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-3 sm:mb-5 relative z-10">
        <button
          onClick={exitCase}
          className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-all text-[10px] uppercase tracking-[0.15em] font-bold bg-white/5 hover:bg-white/10 px-3 py-2 sm:px-4 rounded-lg border border-white/5"
        >
          <ArrowLeft size={13} /> <span className="hidden sm:inline">Kapat</span>
        </button>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <ScoreWidget score={gameState.score} foundCount={foundCount} solvedPuzzles={solvedPuzzles} />
          <div className="text-right hidden md:block min-w-0">
            <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-bold mb-0.5">Aktif Soruşturma</p>
            <h2 className="text-sm font-serif text-white leading-tight truncate max-w-[180px] lg:max-w-[240px]">{caseData.title}</h2>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3 sm:gap-5 relative z-10">

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border relative overflow-hidden",
                activeTab === tab.id
                  ? "bg-primary/10 border-primary/40 text-white shadow-[0_0_25px_rgba(139,0,0,0.15)]"
                  : "bg-[#0a0a0a] border-white/5 text-gray-500 hover:bg-white/5 hover:border-white/10 hover:text-gray-300"
              )}
            >
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabDesktop" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              )}
              <div className={cn("flex-shrink-0 transition-colors", activeTab === tab.id ? "text-primary" : "")}>{tab.icon}</div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-auto bg-accent/10 text-accent text-[9px] font-mono px-2 py-0.5 rounded-full border border-accent/20">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
          <div className="p-4 bg-[#0a0a0a] border border-white/5 rounded-xl space-y-4 text-[10px] text-gray-400 mt-1">
            <p className="text-accent/80 font-bold uppercase tracking-[0.2em]">Vaka Özeti</p>
            <div className="space-y-2">
              {[
                { icon: <Clock size={11} className="text-accent/70" />, label: 'Saat', val: caseData.timeOfDeath || '?' },
                { icon: <Skull size={11} className="text-primary/70" />, label: 'Ölüm', val: caseData.causeOfDeath || '?' },
                { icon: <MapPin size={11} className="text-blue-400/70" />, label: 'Konum', val: caseData.setting || '?' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
                  {item.icon}
                  <div className="min-w-0"><span className="block text-[8px] text-gray-600 uppercase">{item.label}</span><span className="text-gray-300 break-words text-[10px]">{item.val}</span></div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-white/5 space-y-3">
              <p className="text-accent/80 font-bold uppercase tracking-[0.2em]">İlerleme</p>
              {[
                { label: 'Kanıtlar', val: foundCount, color: 'bg-accent' },
                { label: 'Bulmacalar', val: solvedPuzzles, color: 'bg-primary' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1.5 text-[9px]">
                    <span className="uppercase tracking-wider">{item.label}</span>
                    <span className="text-white font-mono">{item.val} / <span className="text-gray-600">?</span></span>
                  </div>
                  <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                    <div
                      className={cn("h-full transition-all duration-700 rounded-full", item.color)}
                      style={{ width: `${Math.min(100, item.val * 10)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Yardım Al Butonu (Hardcore Gizem) ─────────────────────────── */}
          <button
            onClick={() => {
              const hint = getSmartHint();
              setSmartHint(hint);
              play('click');
            }}
            className={cn(
              "group w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-300 text-left",
              isHintStuck
                ? "bg-accent/10 border-accent/40 text-accent animate-pulse"
                : "bg-[#0a0a0a] border-white/5 text-gray-500 hover:bg-white/5 hover:border-white/10 hover:text-gray-300"
            )}
          >
            <Lightbulb size={15} className={isHintStuck ? "text-accent" : "text-gray-600 group-hover:text-gray-400"} />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest block">Yardım Al</span>
              {isHintStuck && (
                <span className="text-[8px] text-accent/70 block mt-0.5">Takılı kaldın mı?</span>
              )}
            </div>
            <span className="text-[8px] text-gray-600 font-mono">-75p</span>
          </button>
        </div>
        <div className="min-h-[60vh] lg:min-h-[78vh] bg-[#0a0a0a]/90 border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-220px)] lg:max-h-[calc(100vh-130px)] custom-scrollbar"
            >
              {activeTab === 'story' && (
                <CaseStory caseData={caseData} foundEvidenceCount={foundCount}
                  onImageClick={(src, alt) => setLightbox({ src, alt })} />
              )}
              {activeTab === 'suspects' && (
                <SuspectsBoard
                  characters={caseData.characters}
                  suspicionLevels={gameState.suspicionLevels}
                  onInterrogate={setSelectedSuspect}
                  onAccuse={(char) => setSelectedAccusationSuspect(char)}
                  onSuspicionChange={setSuspicionLevel}
                  interrogationCounts={Object.fromEntries(
                    Object.entries(gameState.interrogationHistory).map(([k, v]) => [k, v.length / 2])
                  )}
                  onImageClick={(src, alt) => setLightbox({ src, alt })}
                />
              )}
              {activeTab === 'evidence' && (
                <EvidenceBoard
                  evidence={caseData.evidence}
                  foundIds={gameState.foundEvidenceIds}
                  onFind={(id) => { findEvidenceWithSound(id); showNotification('success', 'Yeni kanıt bulundu! +150 puan'); }}
                  onImageClick={(src, alt) => setLightbox({ src, alt })}
                  allPuzzles={caseData.puzzles}
                />
              )}
              {activeTab === 'puzzles' && (
                <PuzzlesBoard
                  puzzles={caseData.puzzles}
                  solvedIds={gameState.unlockedClueIds}
                  onSolve={async (id, ans) => {
                    const result = await solvePuzzleWithSound(id, ans);
                    if (result.isCorrect) showNotification('success', 'Bulmaca çözüldü! Yeni kanıt açıldı. +puan');
                    return result;
                  }}
                  onHint={(id) => { const h = useHint(id); if (h) showNotification('info', `İpucu alındı (-50p)`); return h; }}
                  onImageClick={(src, alt) => setLightbox({ src, alt })}
                  foundEvidenceIds={gameState.foundEvidenceIds}
                  allEvidence={caseData.evidence}
                />
              )}
              {activeTab === 'notebook' && (
                <Notebook entries={gameState.notebookEntries} onAddEntry={addNotebookEntry}
                  caseData={caseData} foundEvidenceIds={gameState.foundEvidenceIds}
                  suspicionLevels={gameState.suspicionLevels} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>{/* /Layout */}

      {/* ── Mobile Bottom Navigation ────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[150] bg-[#080808]/95 backdrop-blur-xl border-t border-white/10 px-1 safe-area-bottom">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 px-2 flex-1 relative transition-all duration-200",
                activeTab === tab.id ? "text-white" : "text-gray-600 hover:text-gray-400"
              )}
            >
              {activeTab === tab.id && (
                <motion.div layoutId="mobileTabIndicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <div className="relative">
                <div className={cn("transition-colors", activeTab === tab.id ? "text-primary" : "")}>
                  {tab.icon}
                </div>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-black text-[8px] font-bold rounded-full flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[9px] font-bold uppercase tracking-wider leading-none", activeTab === tab.id ? "text-white" : "text-gray-600")}>
                {tab.label === 'Vaka Dosyası' ? 'Vaka' : tab.label === 'Not Defteri' ? 'Notlar' : tab.label}
              </span>
            </button>
          ))}
          {/* Mobile Yardım Al */}
          <button
            onClick={() => { const hint = getSmartHint(); setSmartHint(hint); play('click'); }}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 px-2 flex-1 relative transition-all duration-200",
              isHintStuck ? "text-accent animate-pulse" : "text-gray-600"
            )}
          >
            <Lightbulb size={16} />
            <span className="text-[9px] font-bold uppercase tracking-wider leading-none">Yardım</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {selectedSuspect && (
          <InterrogationRoom
            character={selectedSuspect}
            caseData={caseData}
            history={gameState.interrogationHistory[selectedSuspect.id] || []}
            onClose={() => setSelectedSuspect(null)}
            onInterrogate={interrogate}
            onAccuse={() => {
              setSelectedAccusationSuspect(selectedSuspect);
              setSelectedSuspect(null);
            }}
            onImageClick={(src, alt) => setLightbox({ src, alt })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {accusationResult && !accusationResult.correct && (
          <AccusationFailModal result={accusationResult} onClose={() => setAccusationResult(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {caseResolution && (
          <CaseSummaryModal
            resolution={caseResolution}
            onClose={async () => {
              setCaseResolution(null);
              await clearStorage();
              exitCase();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAccusationSuspect && (
          <DeductionModal
            suspect={selectedAccusationSuspect}
            caseData={caseData}
            foundEvidenceIds={gameState.foundEvidenceIds}
            onClose={() => setSelectedAccusationSuspect(null)}
            onConfirm={async (evidenceIds: string[]) => {
              const suspectId = selectedAccusationSuspect.id;
              await makeAccusation(suspectId, evidenceIds);
              setSelectedAccusationSuspect(null);
              // confrontationResult context'te set edildi, ConfrontationOverlay açılacak
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Grand Reveal Overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {confrontationResult && (
          <ConfrontationOverlay
            result={confrontationResult}
            onClose={() => {
              if (confrontationResult.isCorrect) {
                const killer = caseData.characters.find(c => c.isKiller);
                if (killer) {
                  setCaseResolution({
                    correct: true,
                    killer,
                    score: gameState.score,
                    stats: {
                      foundEvidence: gameState.foundEvidenceIds.length,
                      solvedPuzzles: gameState.unlockedClueIds.length,
                      accusations: gameState.accusationCount,
                    },
                  });
                }
              }
              clearConfrontation();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightbox && (
          <LightboxModal src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
        )}
      </AnimatePresence>

      {/* ── Yardım Al Modal (Hardcore Gizem) ───────────────────────────────── */}
      <AnimatePresence>
        {smartHint && (
          <SmartHintModal
            hint={smartHint}
            onClose={() => setSmartHint(null)}
            onNavigate={(tab) => {
              setActiveTab(tab as TabType);
              setSmartHint(null);
            }}
          />
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
        @media (max-width: 640px) {
          .mobile-full-input { font-size: 16px !important; }
        }
      `}} />

      {/* Global Loading Overlay (Plan Madde 1) */}
      <AnimatePresence>
        {isLoading && (
          <LoadingOverlay message={loadingMessage || 'Değerlendiriliyor...'} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SmartHintModal (Hardcore Gizem) ─────────────────────────────────────────
function SmartHintModal({
  hint,
  onClose,
  onNavigate,
}: {
  hint: { type: string; message: string; targetId?: string };
  onClose: () => void;
  onNavigate: (tab: string) => void;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    scene: <ScanSearch size={22} className="text-blue-400" />,
    puzzle: <PuzzleIcon size={22} className="text-purple-400" />,
    interrogation: <MessageSquare size={22} className="text-accent" />,
    none: <Lightbulb size={22} className="text-gray-400" />,
  };

  const navTabMap: Record<string, string> = {
    scene: 'evidence',
    puzzle: 'puzzles',
    interrogation: 'suspects',
  };

  const canNavigate = hint.type !== 'none' && navTabMap[hint.type];

  return (
    <div className="fixed inset-0 bg-black/80 z-[400] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28 }}
        className="max-w-sm w-full bg-[#0d0d0d] border border-accent/30 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(212,175,55,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
              {iconMap[hint.type] || iconMap.none}
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-bold">Dedektif İpucu</p>
              <p className="text-[10px] text-gray-500 font-mono">-75 puan harcandı</p>
            </div>
          </div>

          <p className="text-gray-200 font-serif italic leading-relaxed text-[14px] border-l-2 border-accent/40 pl-4">
            "{hint.message}"
          </p>

          <div className="flex gap-2 pt-1">
            {canNavigate && (
              <button
                onClick={() => onNavigate(navTabMap[hint.type])}
                className="flex-1 py-2.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-[9px] uppercase font-bold tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <ArrowRight size={12} /> Oraya Git
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-[9px] uppercase font-bold tracking-widest rounded-xl transition-all"
            >
              Anladım
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── LoadingOverlay ───────────────────────────────────────────────────────────
function LoadingOverlay({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
    >
      {/* Background ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Animated Loader */}
        <div className="relative w-24 h-24 mb-10">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-t-2 border-primary/40 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-2 border-b-2 border-accent/30 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-white/20 animate-spin" size={32} strokeWidth={1} />
          </div>
        </div>

        {/* Message */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center space-y-3"
        >
          <p className="text-[10px] text-accent font-bold uppercase tracking-[0.6em] animate-pulse">
            Soruşturma Devam Ediyor
          </p>
          <h3 className="text-xl font-serif text-white/90 italic px-6 max-w-md mx-auto">
            "{message}"
          </h3>
          <div className="flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="w-1 h-1 bg-primary rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── CaseStory ────────────────────────────────────────────────────────────────
function CaseStory({ caseData, foundEvidenceCount, onImageClick }: {
  caseData: Case; foundEvidenceCount: number; onImageClick: (s: string, a: string) => void;
}) {
  const [expandedChapter, setExpandedChapter] = useState<string | null>(caseData.chapters?.[0]?.id || null);
  const [isReading, setIsReading] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // ── Parallax state (Plan Madde 5) ───────────────────────────────────────────
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 … +0.5
    const cy = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x: cx, y: cy });
  };

  const handleMouseLeave = () => setMousePos({ x: 0, y: 0 });

  const toggleRead = async () => {
    if (isReading) { audioRef.current?.pause(); setIsReading(false); return; }
    try {
      setIsLoadingAudio(true);
      const text = `Vaka: ${caseData.title}. ${caseData.introduction || ''}. ${caseData.fullStory}`;
      const base64 = await generateSpeechAction(text.substring(0, 2000));
      const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
      audioRef.current = audio;
      audio.onplay = () => { setIsLoadingAudio(false); setIsReading(true); };
      audio.onended = () => setIsReading(false);
      audio.onerror = () => { setIsLoadingAudio(false); setIsReading(false); };
      await audio.play();
    } catch { setIsLoadingAudio(false); setIsReading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Hero image — Parallax (Plan Madde 5) */}
      <div
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-48 sm:h-64 md:h-72 rounded-2xl overflow-hidden border border-white/10 group cursor-zoom-in"
        onClick={() => caseData.generatedImageUrl && onImageClick(caseData.generatedImageUrl, caseData.title)}
        style={{ perspective: '800px' }}
      >
        <motion.div
          className="w-full h-full"
          animate={{
            rotateY: mousePos.x * 6,
            rotateX: -mousePos.y * 6,
            scale: 1.02,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <CaseImage
            src={caseData.generatedImageUrl}
            alt={caseData.title}
            fallbackSeed={caseData.title}
            className="w-full h-full"
            contain={false}
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-5 left-6 z-20">
          <span className="bg-primary text-white text-[9px] uppercase font-bold tracking-widest px-3 py-1 rounded-sm mb-2 inline-block">
            {caseData.setting || 'Vaka Dosyası'}
          </span>
          <h3 className="text-3xl font-serif text-white drop-shadow-xl mt-1">{caseData.title}</h3>
          {caseData.difficultyRating && (
            <div className="flex gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={11} className={i < caseData.difficultyRating ? 'text-accent fill-accent' : 'text-gray-700'} />
              ))}
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded-full text-[9px] text-white/70 flex items-center gap-1 border border-white/10">
          <ScanSearch size={11} /> Büyüt
        </div>
      </div>

      {/* Victim */}
      {caseData.victim && (
        <div className="p-4 sm:p-5 bg-primary/5 border border-primary/20 rounded-2xl flex gap-3 sm:gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[40px] pointer-events-none" />
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-primary/40 cursor-zoom-in group relative"
            onClick={() => caseData.victim?.generatedImageUrl && onImageClick(caseData.victim.generatedImageUrl, caseData.victim.name)}
          >
            <CaseImage
              src={caseData.victim.generatedImageUrl}
              alt={caseData.victim.name}
              fallbackSeed={caseData.victim.name}
              className="w-full h-full"
              contain={true}
            />
          </div>
          <div className="relative z-10 flex-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mb-1">Maktul</p>
            <h4 className="text-xl font-serif text-white mb-1">{caseData.victim.name}</h4>
            <p className="text-xs text-gray-400 font-mono mb-3">{caseData.victim.age} yaş · {caseData.victim.profession}</p>
            <p className="text-sm text-gray-300 italic bg-black/30 p-3 rounded-lg border border-white/5 leading-relaxed">
              "{caseData.victim.description}"
            </p>
          </div>
        </div>
      )}

      {/* Story */}
      <div>
        <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-bold">Olayın Detayları</p>
          <button
            onClick={toggleRead}
            disabled={isLoadingAudio}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest border transition-all",
              isReading ? "bg-primary/20 border-primary/40 text-primary" : "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
            )}
          >
            {isLoadingAudio ? <Loader2 size={13} className="animate-spin" /> : isReading ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {isLoadingAudio ? 'Yükleniyor...' : isReading ? 'Durdur' : 'Dinle'}
          </button>
        </div>
        <div className="text-gray-300 leading-[2.1] font-serif text-[15px] first-letter:text-6xl first-letter:font-bold first-letter:mr-4 first-letter:float-left first-letter:text-primary whitespace-pre-line text-justify">
          {caseData.fullStory}
        </div>
      </div>

      {/* Chapters */}
      {caseData.chapters && caseData.chapters.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-white/10">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-bold mb-5">Soruşturma Günlüğü</p>
          {caseData.chapters.map((ch, idx) => {
            const locked = !ch.isUnlocked && foundEvidenceCount < ch.unlocksAfterEvidenceCount;
            return (
              <div key={ch.id} className={cn("border rounded-xl overflow-hidden transition-all", locked ? "bg-black/40 border-white/5 opacity-60" : "bg-[#0c0c0c] border-white/15 hover:border-white/25")}>
                <button
                  className="w-full flex items-center justify-between p-5 text-left"
                  onClick={() => !locked && setExpandedChapter(expandedChapter === ch.id ? null : ch.id)}
                  disabled={locked}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border", locked ? "bg-black border-white/10 text-gray-600" : "bg-accent/10 border-accent/30 text-accent")}>
                      {locked ? <Lock size={15} /> : <BookOpen size={15} />}
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold">Bölüm {idx + 1}</span>
                      <span className={cn("text-lg font-serif", locked ? "text-gray-500" : "text-white")}>{ch.title}</span>
                    </div>
                  </div>
                  {locked
                    ? <span className="text-[10px] text-gray-500 flex items-center gap-1"><Search size={10} /> {ch.unlocksAfterEvidenceCount} kanıt</span>
                    : <motion.div animate={{ rotate: expandedChapter === ch.id ? 180 : 0 }}><ChevronDown size={17} className="text-gray-400" /></motion.div>
                  }
                </button>
                <AnimatePresence>
                  {expandedChapter === ch.id && !locked && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 border-t border-white/5">
                        <div
                          className="h-44 rounded-xl overflow-hidden border border-white/10 cursor-zoom-in group relative"
                          onClick={() => ch.generatedImageUrl && onImageClick(ch.generatedImageUrl, ch.title)}
                        >
                          <CaseImage src={ch.generatedImageUrl} alt={ch.title} fallbackSeed={ch.title} className="w-full h-full" contain={true} />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                        </div>
                        <p className="text-gray-300 leading-[1.8] text-[15px] font-serif italic whitespace-pre-line bg-black/20 p-5 rounded-xl border border-white/5">{ch.content}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SuspectsBoard ────────────────────────────────────────────────────────────
function SuspectsBoard({ characters, suspicionLevels, onInterrogate, onAccuse, onSuspicionChange, interrogationCounts, onImageClick }: {
  characters: Character[];
  suspicionLevels: Record<string, number>;
  onInterrogate: (c: Character) => void;
  onAccuse: (c: Character) => void;
  onSuspicionChange: (id: string, level: number) => void;
  interrogationCounts: Record<string, number>;
  onImageClick: (s: string, a: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="border-b border-white/10 pb-5">
        <h3 className="text-2xl sm:text-3xl font-serif text-white">Şüpheliler</h3>
        <p className="text-gray-500 text-sm italic mt-2">Her şüpheli sorgulanabilir. İtham etmeden önce kanıtları dikkatlice değerlendirin.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        {characters.map((char, idx) => {
          const suspicion = suspicionLevels[char.id] ?? 0;
          const interrogations = interrogationCounts[char.id] ?? 0;
          const isExpanded = expandedId === char.id;

          return (
            <motion.div key={char.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
              className={cn("bg-[#0a0a0a] border rounded-2xl overflow-hidden transition-all", isExpanded ? "border-white/20 bg-[#0d0d0d]" : "border-white/10 hover:border-white/15")}
            >
              <div className="flex gap-4 p-5">
                <div className="relative flex-shrink-0">
                  <div
                    className={cn("w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all cursor-zoom-in group relative", suspicion > 66 ? "border-primary/70" : suspicion > 33 ? "border-yellow-600/50" : "border-white/10")}
                    onClick={() => char.generatedImageUrl && onImageClick(char.generatedImageUrl, char.name)}
                  >
                    <CaseImage src={char.generatedImageUrl} alt={char.name} fallbackSeed={char.name + char.role} className="w-full h-full" contain={true} />
                  </div>
                  {interrogations > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center border border-red-900">
                      <span className="text-[8px] font-bold text-white">{interrogations}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-serif text-white leading-tight mb-0.5">{char.name}</h4>
                  <p className="text-[10px] text-accent uppercase font-bold tracking-tighter mb-2">{char.role}</p>
                  <div className="space-y-0.5 text-[9px] text-gray-500">
                    <div className="flex items-center gap-1"><Briefcase size={8} /><span>{char.profession}</span></div>
                    <div className="flex items-center gap-1"><MapPin size={8} /><span className="truncate">{char.address}</span></div>
                    <div className="flex items-center gap-1"><User size={8} /><span>{char.age} yaş</span></div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-3">
                <SuspicionMeter value={suspicion} onChange={(v) => onSuspicionChange(char.id, v)} />
              </div>

              <button
                className="w-full flex items-center justify-between px-5 py-2.5 border-t border-white/8 text-[9px] text-gray-600 hover:text-gray-300 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : char.id)}
              >
                <span className="uppercase tracking-widest font-bold">Detaylar & Sorgula</span>
                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="px-5 pb-5 space-y-3 border-t border-white/5">
                      {[
                        { label: 'Maktülle İlişkisi', val: char.relationToVictim },
                        { label: 'Geçmiş', val: char.backstory || char.description },
                        { label: 'Alibi', val: char.alibi || 'Belirtilmemiş', italic: true, color: 'text-yellow-600/80' },
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wider mb-1">{item.label}</p>
                          <p className={cn("text-xs leading-relaxed", item.italic ? `italic ${item.color}` : 'text-gray-400')}>
                            {item.italic ? `"${item.val}"` : item.val}
                          </p>
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => onInterrogate(char)}
                          className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 text-gray-300 text-[9px] uppercase font-bold tracking-widest transition-all rounded-lg flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare size={12} /> Sorgula
                        </button>
                        <button
                          onClick={() => onAccuse(char)}
                          className="py-2.5 bg-primary/10 hover:bg-primary/30 border border-primary/30 hover:border-primary/60 text-primary text-[9px] uppercase font-bold tracking-widest transition-all rounded-lg flex items-center justify-center gap-1.5"
                        >
                          <Gavel size={12} /> İtham Et
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EvidenceBoard ────────────────────────────────────────────────────────────
function EvidenceBoard({ evidence, foundIds, onFind, onImageClick, allPuzzles }: {
  evidence: Evidence[]; foundIds: string[]; onFind: (id: string) => void; onImageClick: (s: string, a: string) => void;
  allPuzzles?: Puzzle[];
}) {
  const [searchMode, setSearchMode] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [searching, setSearching] = useState<string | null>(null);
  const [activeInteractiveEvidence, setActiveInteractiveEvidence] = useState<Evidence | null>(null);

  const handleSearch = (id: string) => {
    const target = evidence.find(e => e.id === id);
    if (target) {
      setSearching(id);
      setActiveInteractiveEvidence(target);
    }
  };

  const found = evidence.filter(e => foundIds.includes(e.id));
  const unfound = evidence.filter(e => !foundIds.includes(e.id));

  // Sadece saha taramasıyla (interactive scene) bulunabilecek olanları filtrele
  const searchableEvidence = unfound.filter(item =>
    !item.isHidden &&
    !allPuzzles?.some(p => p.unlocksEvidenceId === item.id) &&
    item.interactiveObjects && item.interactiveObjects.length > 0
  );

  return (
    <div className="space-y-7">
      <div className="flex justify-between items-end border-b border-white/10 pb-5">
        <div>
          <h3 className="text-2xl sm:text-3xl font-serif text-white">Soruşturma Panosu</h3>
          <p className="text-gray-500 text-sm mt-1">{foundIds.length} / ? kanıt bulundu</p>
        </div>
        <button
          onClick={() => setSearchMode(!searchMode)}
          className={cn("px-4 py-2 rounded-lg text-[9px] uppercase font-bold tracking-widest border flex items-center gap-2 transition-all",
            searchMode ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/5 border-white/10 text-gray-500 hover:text-white")}
        >
          <ScanSearch size={13} />{searchMode ? 'Panoya Dön' : 'Olay Yerini Tara'}
        </button>
      </div>

      {/* Search mode */}
      <AnimatePresence>
        {searchMode && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-black/40 border border-white/8 rounded-2xl p-6">
              <p className="text-[9px] uppercase tracking-widest text-accent font-bold flex items-center gap-2 mb-5">
                <MapPin size={11} /> Arama Bölgeleri — Bir konum seçin
              </p>
              {unfound.length === 0 ? (
                <p className="text-accent text-sm text-center py-6 font-serif italic font-bold tracking-widest uppercase">Tebrikler, tüm kanıtlar bulundu!</p>
              ) : searchableEvidence.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6 font-serif italic">Şu an aranabilir bölge yok. Şüphelileri sorgulayın veya bulmacaları çözün.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {searchableEvidence.map(item => (
                    <button key={item.id} onClick={() => handleSearch(item.id)} disabled={!!searching}
                      className={cn("p-4 rounded-xl border text-left transition-all",
                        searching === item.id ? "border-accent/50 bg-accent/5 animate-pulse" : "border-white/10 bg-white/3 hover:bg-white/8 hover:border-white/25"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Search size={12} className="text-gray-500" />
                        <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">{item.location}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{item.locationDescription || 'Bu konumu dikkatlice inceleyin...'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Interactive Scene Modal for searching */}
            <AnimatePresence>
              {activeInteractiveEvidence && (
                <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-0 sm:p-4 backdrop-blur-sm overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="max-w-4xl w-full border-0 sm:border border-white/10 sm:rounded-2xl overflow-hidden shadow-2xl bg-black h-full sm:h-auto max-h-[100svh] sm:max-h-[85vh]">
                    <InteractiveScene
                      evidence={activeInteractiveEvidence}
                      onClose={() => { setActiveInteractiveEvidence(null); setSearching(null); }}
                    />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Found evidence */}
      {found.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-4">Bulunan Kanıtlar</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {found.map(item => (
              <EvidenceCard key={item.id} evidence={item} isFound onImageClick={onImageClick}
                onClick={() => setSelectedEvidence(item)} allPuzzles={allPuzzles} />
            ))}
          </div>
        </div>
      )}

      {/* Unfound */}
      {unfound.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-4">Henüz Bulunamadı</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unfound.map(item => <EvidenceCard key={item.id} evidence={item} isFound={false} onImageClick={onImageClick} allPuzzles={allPuzzles} />)}
          </div>
        </div>
      )}

      {/* Evidence detail modal */}
      <AnimatePresence>
        {selectedEvidence && (
          <EvidenceModal evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} onImageClick={onImageClick} />
        )}
      </AnimatePresence>
    </div>
  );
}

function EvidenceCard({ evidence, isFound, onClick, onImageClick, allPuzzles }: {
  evidence: Evidence; isFound: boolean; onClick?: () => void; onImageClick: (s: string, a: string) => void;
  allPuzzles?: Puzzle[];
}) {
  // Hangi kanaldan açıldığını / açılacağını belirle
  const channelInfo = (() => {
    if (evidence.isHidden) return { label: 'Sorgu ile Açılır', color: 'text-purple-400 border-purple-500/20 bg-purple-950/20', icon: '🔒' };
    const linkedPuzzle = allPuzzles?.find(p => p.unlocksEvidenceId === evidence.id);
    if (linkedPuzzle) return { label: `Bulmaca: ${linkedPuzzle.title}`, color: 'text-blue-400 border-blue-500/20 bg-blue-950/20', icon: '🧩' };
    return { label: 'Saha Taraması', color: 'text-green-400 border-green-500/20 bg-green-950/20', icon: '🔍' };
  })();
  return (
    <motion.div whileHover={isFound ? { scale: 1.01, y: -2 } : {}} onClick={onClick}
      className={cn("border rounded-2xl overflow-hidden transition-all relative group",
        isFound ? "bg-[#0d0d0d] border-white/15 cursor-pointer hover:border-accent/40 hover:shadow-[0_10px_30px_rgba(212,175,55,0.08)]" : "bg-black/40 border-white/5 opacity-45")}
    >
      <div className="flex gap-4 p-5">
        <div
          className={cn("w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 relative", isFound ? "border-white/10 group-hover:border-accent/30" : "border-white/5")}
          onClick={(e) => { e.stopPropagation(); if (isFound && evidence.generatedImageUrl) onImageClick(evidence.generatedImageUrl, evidence.title); }}
        >
          {isFound ? (
            <CaseImage src={evidence.generatedImageUrl} alt={evidence.title} fallbackSeed={evidence.title + evidence.id} className="w-full h-full" contain={true} />
          ) : (
            <div className="w-full h-full bg-black/80 flex items-center justify-center"><Lock size={22} className="text-gray-700" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-serif text-white leading-tight">{evidence.title}</h4>
            {!isFound && (
              <span className={cn("text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0", channelInfo.color)}>
                {channelInfo.icon} {channelInfo.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-mono mb-2">
            <MapPin size={9} /><span>{evidence.location}</span>
          </div>
          {isFound
            ? <p className="text-[11px] text-gray-400 italic font-serif leading-relaxed line-clamp-2">"{evidence.description}"</p>
            : <p className="text-[11px] text-gray-700">???</p>
          }
        </div>
      </div>
      {isFound && evidence.clueText && (
        <div className="px-5 py-3 border-t border-white/5 bg-accent/[0.02] flex items-start gap-2">
          <Lightbulb size={12} className="text-accent/70 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-gray-300 italic font-serif leading-relaxed">{evidence.clueText}</p>
        </div>
      )}
    </motion.div>
  );
}

function EvidenceModal({ evidence, onClose, onImageClick }: {
  evidence: Evidence; onClose: () => void; onImageClick: (s: string, a: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()}
        className="max-w-2xl w-full bg-[#0a0a0a] border border-white/15 rounded-2xl overflow-hidden shadow-2xl max-h-[98vh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar mx-0 sm:mx-4"
      >
        {/* Interactive Scene Integration in Modal */}
        <div className="border-b border-white/10 max-h-[45vh] sm:max-h-none min-h-[220px]">
          <InteractiveScene evidence={evidence} />
        </div>
        <div className="relative h-48 sm:h-56 border-b border-white/10 bg-black cursor-zoom-in group"
          onClick={() => evidence.generatedImageUrl && onImageClick(evidence.generatedImageUrl, evidence.title)}
        >
          <CaseImage src={evidence.generatedImageUrl} alt={evidence.title} fallbackSeed={evidence.title} className="w-full h-full" contain={true} />
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/90 rounded-full text-white/70 hover:text-white border border-white/10">
            <X size={16} />
          </button>
          <div className="absolute bottom-3 left-4">
            <span className="bg-black/70 border border-white/10 px-3 py-1 text-[9px] uppercase font-bold tracking-widest text-white rounded-full backdrop-blur-sm">
              Kanıt #{evidence.id}
            </span>
          </div>
          <div className="absolute top-3 right-12 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded-full text-[9px] text-white/70 flex items-center gap-1">
            <ScanSearch size={10} /> Tam Ekran
          </div>
        </div>
        <div className="p-5 sm:p-7 space-y-4 sm:space-y-5">
          <div>
            <h3 className="text-2xl font-serif text-white mb-1">{evidence.title}</h3>
            <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
              <span className="flex items-center gap-1.5"><MapPin size={11} />{evidence.location}</span>
              {evidence.foundAt && (
                <><span className="w-1 h-1 bg-gray-600 rounded-full" />
                  <span className="flex items-center gap-1.5"><Clock size={11} />{new Date(evidence.foundAt).toLocaleString('tr-TR')}</span></>
              )}
            </div>
          </div>
          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <p className="text-sm text-gray-300 font-serif leading-loose">{evidence.description}</p>
          </div>
          {evidence.clueText && (
            <div className="p-4 bg-accent/8 border border-accent/20 rounded-xl flex items-start gap-3">
              <Lightbulb size={16} className="text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] text-accent font-bold uppercase tracking-widest mb-1.5">Dedektif Notu</p>
                <p className="text-sm text-accent/90 italic font-serif leading-relaxed">{evidence.clueText}</p>
              </div>
            </div>
          )}
          {evidence.linkedCharacterId && (
            <div className="flex items-center gap-2 text-[10px] text-gray-500 border border-white/5 p-3 rounded-lg">
              <Link size={11} className="text-gray-600" />
              <span>Bu kanıt bir şüpheliyle bağlantılı olabilir</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── PuzzlesBoard ─────────────────────────────────────────────────────────────
function PuzzlesBoard({ puzzles, solvedIds, onSolve, onHint, onImageClick, foundEvidenceIds, allEvidence }: {
  puzzles: Puzzle[];
  solvedIds: string[];
  onSolve: (id: string, ans: string) => Promise<{ isCorrect: boolean; feedback: string }>;
  onHint: (id: string) => string | null;
  onImageClick: (s: string, a: string) => void;
  foundEvidenceIds: string[];
  allEvidence: Evidence[];
}) {
  return (
    <div className="space-y-8">
      <div className="border-b border-white/10 pb-5">
        <h3 className="text-2xl sm:text-3xl font-serif text-white">Zeka Oyunları & Şifreler</h3>
        <p className="text-gray-500 text-sm mt-2 italic">
          Her bulmacayı çözmek gizli bir kanıt açar. Görselleri inceleyerek ipucu bulabilirsiniz.
        </p>
      </div>
      <div className="space-y-6">
        {puzzles.map((puzzle, i) => {
          const linkedEvidence = puzzle.unlocksEvidenceId
            ? allEvidence.find(e => e.id === puzzle.unlocksEvidenceId)
            : null;
          const isEvidenceAlreadyFound = linkedEvidence ? foundEvidenceIds.includes(linkedEvidence.id) : false;

          return (
            <motion.div key={puzzle.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <PuzzleCard
                puzzle={puzzle}
                isSolved={solvedIds.includes(puzzle.id)}
                onSolve={(ans) => onSolve(puzzle.id, ans)}
                onHint={() => onHint(puzzle.id)}
                onImageClick={onImageClick}
                linkedEvidence={linkedEvidence || null}
                isEvidenceFound={isEvidenceAlreadyFound}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function PuzzleCard({ puzzle, isSolved, onSolve, onHint, onImageClick, linkedEvidence, isEvidenceFound }: {
  puzzle: Puzzle; isSolved: boolean;
  onSolve: (ans: string) => Promise<{ isCorrect: boolean; feedback: string }>;
  onHint: () => string | null; onImageClick: (s: string, a: string) => void;
  linkedEvidence: Evidence | null; isEvidenceFound: boolean;
}) {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const [hint, setHint] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isEvaluating) return;
    setIsEvaluating(true);
    setAiFeedback(null);
    try {
      const result = await onSolve(answer);
      setAiFeedback(result.feedback);
      if (result.isCorrect) {
        setStatus('correct');
        // Başarı mesajı artık ekranda kalıcı kalır
      } else {
        setStatus('wrong');
        // İpucu/Geri bildirim artık otomatik silinmez, kullanıcı tekrar deneyene kadar kalır
      }
    } catch { setIsEvaluating(false); }
    finally { setIsEvaluating(false); }
  };

  const solved = isSolved || status === 'correct';

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-all duration-500 relative",
      solved ? "bg-green-950/10 border-green-800/40" : status === 'wrong' ? "bg-red-950/15 border-red-800/40" : "bg-[#0d0d0d] border-white/10 hover:border-white/20 shadow-lg"
    )}>
      {solved && <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[60px] rounded-full pointer-events-none" />}

      <div className="p-4 sm:p-6 relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <PuzzleTypeIcon type={puzzle.type} />
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <DifficultyBadge level={puzzle.difficulty} />
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span className="text-[10px] text-accent font-mono font-bold">+{puzzle.points || 200}p</span>
            </div>
            <h4 className="text-xl font-serif text-white">{puzzle.title || puzzle.question.substring(0, 50)}</h4>
          </div>
          <div className={cn("p-3 rounded-xl flex-shrink-0 border transition-all",
            solved ? "bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]" : "bg-white/[0.03] text-gray-500 border-white/5"
          )}>
            {solved ? <CheckCircle2 size={22} /> : <PuzzleIcon size={22} />}
          </div>
        </div>

        {/* Linked evidence badge */}
        {linkedEvidence && (
          <div className={cn("mb-5 flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold",
            isEvidenceFound ? "bg-green-950/20 border-green-800/30 text-green-400" : "bg-white/3 border-white/10 text-gray-500"
          )}>
            <FlaskConical size={12} />
            <span>{isEvidenceFound ? `✓ Açılan Kanıt: ${linkedEvidence.title}` : `Bu bulmacayı çöz → "${linkedEvidence.title}" kanıtını aç`}</span>
          </div>
        )}

        {/* Image */}
        {(puzzle.imagePrompt || puzzle.generatedImageUrl) && (
          <div className="mb-6">
            <button onClick={() => setShowImage(!showImage)}
              className="text-[10px] text-gray-400 hover:text-white uppercase tracking-widest font-bold flex items-center gap-2 mb-3 transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg"
            >
              {showImage ? <EyeOff size={13} /> : <Eye size={13} />}
              {showImage ? 'Görseli Gizle' : 'Görseli İncele — İpucu olabilir!'}
            </button>
            <AnimatePresence>
              {showImage && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="rounded-xl border border-white/10 relative"
                >
                  {puzzle.interactiveObjects && puzzle.interactiveObjects.length > 0 ? (
                    <InteractiveScene
                      evidence={{
                        id: puzzle.id,
                        location: puzzle.title || 'Bulmaca Mekanı',
                        locationDescription: 'İpucu bulmak için etrafı inceleyin.',
                        generatedImageUrl: puzzle.generatedImageUrl,
                        interactiveObjects: puzzle.interactiveObjects,
                        isFound: true,
                        title: puzzle.title || 'Bulmaca',
                        description: '',
                        imagePrompt: '',
                        clueText: ''
                      } as Evidence}
                    />
                  ) : (
                    <div className="cursor-zoom-in group relative" onClick={() => puzzle.generatedImageUrl && onImageClick(puzzle.generatedImageUrl, puzzle.title || 'Bulmaca Görseli')}>
                      <CaseImage src={puzzle.generatedImageUrl} alt={puzzle.title || 'Bulmaca'} fallbackSeed={puzzle.id}
                        className="w-full" style={{ height: 240 }} contain={true} />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded-full text-[9px] text-white/70 flex items-center gap-1">
                        <ScanSearch size={10} /> Büyüt
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Question */}
        <div className="p-5 bg-black/50 rounded-xl border border-white/5 mb-6 shadow-inner">
          <p className="text-gray-200 text-[15px] leading-relaxed font-serif whitespace-pre-line">{puzzle.question}</p>
        </div>

        {/* Hint */}
        {hint && !solved && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-start gap-3"
          >
            <Sparkles size={14} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] text-accent font-bold uppercase tracking-widest mb-1.5">İpucu (-50p)</p>
              <p className="text-[13px] text-gray-300 italic font-serif leading-relaxed">"{hint}"</p>
            </div>
          </motion.div>
        )}

        {/* AI feedback */}
        <AnimatePresence>
          {aiFeedback && !solved && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className={cn("mb-5 p-4 rounded-xl border text-sm font-serif italic flex items-start gap-2",
                status === 'wrong' ? "bg-red-950/20 border-red-500/25 text-red-200" : "bg-accent/8 border-accent/25 text-accent"
              )}
            >
              <Target size={14} className="flex-shrink-0 mt-0.5" />
              <span>{aiFeedback}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solved */}
        {solved ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Başarı Mesajı (AI Feedback) */}
            {aiFeedback && (
              <div className="flex items-start gap-3 bg-green-950/20 p-4 rounded-xl border border-green-500/20">
                <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-100 font-serif italic leading-relaxed">{aiFeedback}</p>
              </div>
            )}

            {/* Bulmaca Ödül Metni */}
            <div className="flex items-start gap-4 bg-white/[0.03] p-5 rounded-xl border border-white/10">
              <div className="bg-accent/10 p-2.5 rounded-lg text-accent mt-1"><Sparkles size={20} /></div>
              <div>
                <p className="text-[9px] text-accent font-bold uppercase tracking-widest mb-1">Şifre Çözüldü!</p>
                <p className="text-[14px] text-gray-200 font-serif leading-relaxed">{puzzle.rewardDescription}</p>
              </div>
            </div>

            {/* Kanıt Detayı (Dedektif Notu) */}
            {linkedEvidence && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                className="flex items-start gap-4 bg-amber-950/10 p-5 rounded-xl border border-amber-900/30"
              >
                <div className="bg-amber-500/10 p-2.5 rounded-lg text-amber-500 mt-1"><Lightbulb size={20} /></div>
                <div>
                  <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mb-1">Yeni İpucu: {linkedEvidence.title}</p>
                  <p className="text-[13px] text-amber-200/80 font-serif italic leading-relaxed">"{linkedEvidence.clueText}"</p>
                  <p className="text-[10px] text-gray-500 mt-2 font-mono uppercase tracking-tighter opacity-60">Bu bilgi Kanıtlar panosuna eklendi.</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col xs:flex-row gap-2 sm:gap-3">
            <input
              ref={inputRef}
              type="text" value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Çözümünüzü girin..."
              className={cn(
                "flex-1 bg-black/60 border-2 px-5 py-3.5 text-white text-sm transition-all focus:outline-none rounded-xl font-mono shadow-inner",
                status === 'wrong' ? "border-primary shadow-[0_0_15px_rgba(139,0,0,0.2)] animate-shake" : "border-white/10 focus:border-accent/50"
              )}
            />
            <div className="flex gap-3">
              <button type="submit" disabled={isEvaluating || !answer.trim()}
                className="flex-1 sm:flex-none px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold uppercase tracking-widest border border-white/10 hover:border-white/30 rounded-xl transition-all flex items-center justify-center min-w-[110px]"
              >
                {isEvaluating ? <Loader2 className="animate-spin" size={16} /> : 'Gönder'}
              </button>
              {!hint && (
                <button type="button"
                  onClick={() => { const h = onHint(); if (h) setHint(h); }}
                  className="px-4 py-3.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 hover:border-accent/40 rounded-xl transition-all"
                  title="İpucu Al (-50p)"
                >
                  <HelpCircle size={18} />
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Notebook ─────────────────────────────────────────────────────────────────
function Notebook({ entries, onAddEntry, caseData, foundEvidenceIds, suspicionLevels }: {
  entries: string[]; onAddEntry: (e: string) => void; caseData: Case;
  foundEvidenceIds: string[]; suspicionLevels: Record<string, number>;
}) {
  const [note, setNote] = useState('');
  const topSuspect = caseData.characters.reduce(
    (max, c) => (suspicionLevels[c.id] ?? 0) > (suspicionLevels[max?.id] ?? 0) ? c : max,
    caseData.characters[0]
  );

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="border-b border-white/10 pb-5">
        <h3 className="text-2xl sm:text-3xl font-serif text-white">Dedektif Defteri</h3>
        <p className="text-gray-500 text-sm mt-2 italic">Bulguları birleştirin. Tüm bağlantılar buraya yazılır.</p>
      </div>

      {/* Summary */}
      <div className="p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl space-y-5">
        <p className="text-[10px] text-accent uppercase font-bold tracking-widest flex items-center gap-2"><BookOpen size={13} /> Soruşturma Özeti</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {[
            { label: 'Toplanan Kanıt', val: `${foundEvidenceIds.length} / ?` },
            { label: 'Ana Şüpheli', val: topSuspect?.name || '-', color: 'text-primary' },
            { label: 'Olay Zamanı', val: caseData.timeOfDeath || '?' },
            { label: 'Ölüm Nedeni', val: caseData.causeOfDeath || '?' },
          ].map(item => (
            <div key={item.label} className="bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-gray-500 block text-[8px] uppercase tracking-widest mb-1">{item.label}</span>
              <span className={cn("font-bold font-mono text-sm", item.color || 'text-white')}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); if (!note.trim()) return; onAddEntry(note); setNote(''); }} className="space-y-3">
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Şüphelerinizi, bağlantıları, teorilerinizi buraya yazın..."
          rows={4}
          className="w-full bg-[#0a0a0a] border border-white/15 rounded-xl px-5 py-4 text-gray-200 text-[15px] placeholder:text-gray-600 focus:outline-none focus:border-accent/50 transition-colors resize-none font-serif"
        />
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-gray-600 font-mono">{note.length}/500</span>
          <button type="submit" disabled={!note.trim()}
            className="px-7 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-40 border border-white/10 text-white text-[10px] uppercase font-bold tracking-widest rounded-xl transition-all flex items-center gap-2"
          >
            <NotebookPen size={13} /> Kaydet
          </button>
        </div>
      </form>

      {/* Entries */}
      <div className="space-y-3">
        {[...entries].reverse().map((entry, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-white/[0.02] border border-white/8 rounded-xl relative pl-8"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent/40 rounded-l-xl" />
            <p className="text-[15px] text-gray-300 font-serif leading-relaxed whitespace-pre-line">{entry}</p>
          </motion.div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
            <Quote size={30} className="text-gray-700 mx-auto mb-4 opacity-50" />
            <p className="text-gray-500 text-[15px] italic font-serif">"En karmaşık cinayetler bile, basit bir defter notuyla aydınlatılır..."</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── InterrogationRoom ────────────────────────────────────────────────────────
function InterrogationRoom({ character, caseData, history, onClose, onInterrogate, onAccuse, onImageClick }: {
  character: Character; caseData: Case;
  history: { role: 'user' | 'model'; message: string }[];
  onClose: () => void;
  onInterrogate: (id: string, q: string) => Promise<string | null>;
  onAccuse: (id: string) => void;
  onImageClick: (s: string, a: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [localHistory, setLocalHistory] = useState(history);
  const [error, setError] = useState<string | null>(null);
  // Typewriter için: son model mesajının index'ini takip et
  const [typewriterIndex, setTypewriterIndex] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { play } = useSound(); // Plan Madde 4

  useEffect(() => { setLocalHistory(history); }, [history.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [localHistory, isTyping]);

  const quickQuestions = [
    "Olay gecesi neredeydiniz?",
    "Maktülle son ne zaman görüştünüz?",
    "Kimden şüpheleniyorsunuz?",
    "Maddi durumunuz nasıl?",
    "Bir şeyi benden saklıyor musunuz?",
    "Alibinizi kim doğrulayabilir?",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || isTyping) return;
    setQuestion('');
    setError(null);
    setIsTyping(true);
    play('click'); // Plan Madde 4 — daktilo vuruş sesi
    setLocalHistory(prev => [...prev, { role: 'user', message: q }]);

    const response = await onInterrogate(character.id, q);

    if (response) {
      setLocalHistory(prev => {
        const next = [...prev, { role: 'model' as const, message: response }];
        // Son eklenen model mesajını Typewriter ile göster
        setTypewriterIndex(next.length - 1);
        return next;
      });
    } else {
      setError('Şüpheli cevap vermedi. Lütfen tekrar deneyin.');
      setLocalHistory(prev => prev.slice(0, -1));
      setQuestion(q);
    }
    setIsTyping(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="fixed inset-0 bg-black/98 z-[110] flex items-center justify-center p-3 md:p-6 backdrop-blur-xl">
      {/* Film Grain Effect Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        className="max-w-6xl w-full h-screen sm:h-[93vh] bg-[#050505] border-0 sm:border border-white/10 sm:rounded-3xl flex flex-col md:flex-row shadow-[0_0_100px_rgba(0,0,0,0.8)] relative z-10 overflow-hidden"
      >
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-3 right-3 sm:top-5 sm:right-5 p-2.5 bg-black/60 hover:bg-black/90 rounded-full text-white/60 hover:text-white z-50 transition-all border border-white/10">
          <X size={20} />
        </button>

        {/* Sidebar */}
        <div className="hidden md:flex w-[280px] lg:w-[320px] bg-[#080808] border-r border-white/5 p-6 lg:p-8 flex-col shrink-0">
          <div className="space-y-6 flex-1">
            <div className="relative group cursor-zoom-in shrink-0" onClick={() => character.generatedImageUrl && onImageClick(character.generatedImageUrl, character.name)}>
              <div className="w-full aspect-[4/5] rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl relative">
                <CaseImage src={character.generatedImageUrl} alt={character.name} fallbackSeed={character.name} className="w-full h-full" contain={true} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-0 right-0 text-center px-4">
                  <h3 className="text-xl font-serif text-white drop-shadow-lg">{character.name}</h3>
                  <p className="text-[10px] text-accent/80 uppercase font-bold tracking-wider mt-1">{character.role}</p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-black/60 p-1.5 rounded-full border border-white/10 transition-opacity">
                  <ScanSearch size={12} className="text-white/70" />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-[10px]">
              {[
                { label: 'Meslek', val: character.profession, icon: <Briefcase size={12} /> },
                { label: 'Yaş', val: `${character.age}`, icon: <User size={12} /> },
                { label: 'Adres', val: character.address, icon: <MapPin size={12} /> },
                { label: 'İlişki', val: character.relationToVictim, icon: <Link size={12} /> },
                { label: 'İfadesi (Alibi)', val: character.alibi || 'Belirtilmemiş', italic: true, icon: <Clock size={12} /> },
              ].map(item => (
                <div key={item.label} className="p-3 bg-white/[0.02] border border-white/[0.03] rounded-lg">
                  <div className="flex items-center gap-2 text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1.5">
                    {item.icon} {item.label}
                  </div>
                  <p className={cn("text-[11px] leading-relaxed break-words", item.italic ? 'text-amber-600/60 italic font-serif' : 'text-gray-400 font-mono')}>
                    {item.val}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onAccuse(character.id)}
            className="mt-8 w-full py-4 bg-primary/5 hover:bg-primary/90 border border-primary/20 hover:border-red-600 text-primary hover:text-white font-black uppercase tracking-[0.4em] text-[10px] transition-all rounded-xl flex items-center justify-center gap-3 shadow-lg group"
          >
            <Gavel size={16} className="group-hover:rotate-[-20deg] transition-transform" />
            Vakayı Bitir: İtham Et
          </button>
        </div>

        {/* Interrogation Interface */}
        <div className="flex-1 flex flex-col bg-[#070707] relative min-w-0">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#050505] to-transparent z-10 pointer-events-none" />

          {/* Chat Logs */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar scroll-smooth">
            <div className="text-center pt-8 pb-4">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-white/5 border border-white/10 rounded-full">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                <span className="text-[10px] uppercase font-black tracking-[0.5em] text-gray-400">Canlı Sorgu Protokolü</span>
              </div>
            </div>

            <div className="space-y-8 max-w-3xl mx-auto w-full">
              <AnimatePresence>
                {localHistory.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("flex flex-col group", msg.role === 'user' ? "items-end" : "items-start")}
                  >
                    <div className={cn("mb-2 text-[9px] font-black uppercase tracking-widest flex items-center gap-2",
                      msg.role === 'user' ? "text-gray-500 flex-row-reverse" : "text-amber-500")}>
                      {msg.role === 'user' ? <User size={10} /> : <Fingerprint size={10} />}
                      {msg.role === 'user' ? 'Dedektif' : character.name}
                    </div>

                    <div className={cn(
                      "relative max-w-[90%] sm:max-w-[75%] px-6 py-5 rounded-2xl text-[15px] md:text-[16px] leading-[1.7] shadow-[0_15px_35px_rgba(0,0,0,0.3)] border break-words",
                      msg.role === 'user'
                        ? "bg-gradient-to-bl from-primary/80 to-primary/60 text-white border-red-900 rounded-tr-none"
                        : "bg-[#111111] text-gray-200 border-white/5 font-serif italic rounded-tl-none prose-invert"
                    )}>
                      {/* Plan Madde 3: Sadece en son model mesajında Typewriter kullan */}
                      {msg.role === 'model' && i === typewriterIndex ? (
                        <Typewriter
                          text={msg.message}
                          speed={16}
                          charInterval={6}
                          onCharacter={() => {
                            play('click');
                            if (scrollRef.current) {
                              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                            }
                          }}
                        />
                      ) : (
                        msg.message
                      )}
                      {msg.role === 'model' && <div className="absolute -inset-1 bg-amber-500/5 blur-xl pointer-events-none" />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <div className="flex flex-col items-start bg-transparent">
                  <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                    <Fingerprint size={10} /> {character.name}
                  </div>
                  <div className="bg-[#111111] border border-white/5 px-6 py-5 rounded-2xl rounded-tl-none shadow-xl">
                    <div className="flex gap-2">
                      {[0, 0.1, 0.2].map((delay, idx) => (
                        <div key={idx} className="w-2 h-2 bg-amber-500/40 rounded-full animate-bounce" style={{ animationDelay: `${delay}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center pb-4">
                <div className="bg-red-950/40 border border-red-500/30 px-6 py-3 rounded-xl text-[11px] text-red-200 flex items-center gap-3">
                  <AlertTriangle size={14} /> {error}
                </div>
              </motion.div>
            )}

            {localHistory.length === 0 && !isTyping && (
              <div className="text-center py-20 animate-in fade-in duration-1000">
                <div className="w-20 h-20 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto border border-white/10 text-gray-700 mb-8 shadow-inner">
                  <MessageSquare size={32} />
                </div>
                <h4 className="text-xl font-serif text-gray-500 italic mb-10">"Sessizlik, bir suçlunun en güvenli limanıdır..."</h4>
                <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto px-2">
                  {quickQuestions.map(q => (
                    <button key={q} onClick={() => { setQuestion(q); inputRef.current?.focus(); }}
                      className="px-5 py-2.5 bg-[#0a0a0a] border border-white/5 hover:border-primary/40 rounded-full text-[11px] text-gray-500 hover:text-white transition-all hover:bg-white/5"
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Suggestions Strip */}
          {localHistory.length > 0 && (
            <div className="hidden sm:flex px-4 sm:px-6 py-3 gap-2 sm:gap-3 overflow-x-auto custom-scrollbar border-t border-white/5 bg-[#080808]">
              {quickQuestions.map(q => (
                <button key={q} onClick={() => { setQuestion(q); inputRef.current?.focus(); }}
                  className="flex-shrink-0 px-4 py-2 bg-white/[0.02] border border-white/5 hover:border-primary/50 rounded-lg text-[10px] text-gray-600 hover:text-white transition-all whitespace-nowrap uppercase tracking-widest font-black"
                >{q}</button>
              ))}
            </div>
          )}

          {/* Input Unit */}
          <div className="p-3 sm:p-5 md:p-6 border-t border-white/5 bg-[#050505] safe-area-bottom">
            <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto flex gap-2 sm:gap-4 w-full">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder={`${character.name} sorgulanıyor...`}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3.5 sm:py-5 text-white text-[16px] placeholder:text-gray-700 focus:outline-none focus:border-red-900/50 transition-all shadow-inner font-serif"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <kbd className="hidden sm:inline-block px-2 py-0.5 rounded text-[8px] bg-white/5 border border-white/10 text-gray-600 font-bold uppercase tracking-widest">Enter</kbd>
                </div>
              </div>
              <button type="submit" disabled={isTyping || !question.trim()}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-primary hover:bg-red-800 disabled:bg-gray-900 duration-300 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-[0_15px_45px_rgba(139,0,0,0.2)] transition-all shrink-0"
              >
                {isTyping ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DeductionModal ───────────────────────────────────────────────────────────
function DeductionModal({
  suspect,
  caseData,
  foundEvidenceIds,
  onClose,
  onConfirm,
}: {
  suspect: Character;
  caseData: Case;
  foundEvidenceIds: string[];
  onClose: () => void;
  onConfirm: (evidenceIds: string[]) => Promise<void>;
}) {
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const foundEvidence = caseData.evidence.filter((e) =>
    foundEvidenceIds.includes(e.id)
  );

  const toggleEvidence = (id: string) => {
    setSelectedEvidence((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev
    );
  };

  const handleConfirm = async () => {
    if (selectedEvidence.length !== 3) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedEvidence);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 md:p-8 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 22 }}
        className="max-w-2xl w-full bg-[#0d0a05] border border-accent/30 rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.08)] relative max-h-[98vh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-24 bg-accent/10 blur-[60px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="p-5 sm:p-8 border-b border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
              <Gavel size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.4em] text-accent/70 font-bold mb-0.5">Son İtham</p>
              <h2 className="text-xl font-serif text-white">Büyük Yüzleşme</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white/50 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Suspect */}
        <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-4 relative z-10">
          <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-3">İtham Edilen Şüpheli</p>
          <div className="flex items-center gap-4 bg-black/40 border border-primary/20 rounded-xl p-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/40 flex-shrink-0 bg-black/60">
              {suspect.generatedImageUrl ? (
                <img src={suspect.generatedImageUrl} alt={suspect.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary/50">
                  <User size={24} />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-serif text-white">{suspect.name}</h3>
              <p className="text-[10px] text-gray-500">{suspect.role}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
              <AlertTriangle size={11} className="text-primary" />
              <span className="text-[9px] uppercase font-bold text-primary tracking-wider">Zanlı</span>
            </div>
          </div>
        </div>

        {/* Evidence selection */}
        <div className="px-5 sm:px-8 pb-6 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
              Kanıt Seç <span className="text-accent">({selectedEvidence.length}/3)</span>
            </p>
            <p className="text-[9px] text-gray-600">Tam olarak 3 kanıt seçmelisiniz</p>
          </div>

          {/* ── Yetersiz Kanıt Uyarısı (Plan Madde 1) ───────────────────────── */}
          {foundEvidence.length < 3 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 flex items-start gap-3 p-3.5 rounded-xl border border-amber-900/40 bg-amber-950/20"
            >
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-amber-400 mb-0.5">
                  Henüz yeterli kanıtın yok, dedektif!
                </p>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  İtham edebilmek için en az <span className="text-amber-500 font-bold">3 kanıt</span> toplamalısın.
                  Sahneyi ve şüphelileri daha dikkatli incele.
                </p>
              </div>
            </motion.div>
          )}

          {foundEvidence.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-sm font-serif italic border border-white/5 rounded-xl bg-black/20">
              Henüz hiç kanıt toplanmadı. Önce kanıt araştırın.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-h-[380px] sm:max-h-[420px] overflow-y-auto custom-scrollbar pr-2 p-1">
              {foundEvidence.map((ev) => {
                const isSelected = selectedEvidence.includes(ev.id);
                return (
                  <motion.button
                    key={ev.id}
                    onClick={() => toggleEvidence(ev.id)}
                    whileHover={{ scale: !isSelected && selectedEvidence.length >= 3 ? 1 : 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'relative flex flex-col items-start rounded-xl border text-left transition-all duration-300 group overflow-hidden',
                      isSelected
                        ? 'bg-accent/10 border-accent/60 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                        : 'bg-black/40 border-white/10 hover:border-white/20 hover:bg-white/5',
                      !isSelected && selectedEvidence.length >= 3 ? 'opacity-30 cursor-not-allowed grayscale' : ''
                    )}
                    disabled={!isSelected && selectedEvidence.length >= 3}
                  >
                    {/* Image Header */}
                    <div className="w-full h-24 bg-black/60 relative overflow-hidden flex-shrink-0 border-b border-white/5">
                      <CaseImage
                        src={ev.generatedImageUrl}
                        alt={ev.title}
                        fallbackSeed={ev.id}
                        className="w-full h-full"
                        contain={true}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />

                      {/* Selection Badge */}
                      <div className={cn(
                        'absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-20',
                        isSelected
                          ? 'border-accent bg-accent scale-110 shadow-[0_0_10px_rgba(212,175,55,0.5)]'
                          : 'border-white/20 bg-black/40'
                      )}>
                        {isSelected ? (
                          <CheckCircle2 size={14} className="text-black" />
                        ) : (
                          <Plus size={12} className="text-white/30" />
                        )}
                      </div>

                      {/* Selection Order */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-accent/90 rounded text-[9px] font-black text-black z-20">
                          #{selectedEvidence.indexOf(ev.id) + 1}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 w-full space-y-1">
                      <p className={cn(
                        'text-[13px] font-serif font-bold truncate leading-tight transition-colors',
                        isSelected ? 'text-accent' : 'text-gray-200'
                      )}>
                        {ev.title}
                      </p>
                      <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed h-7 italic">
                        {ev.clueText || ev.description}
                      </p>
                    </div>

                    {/* Checkmark overlay for selection */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 border-2 border-accent/20 pointer-events-none rounded-xl"
                        />
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-8 pb-6 sm:pb-8 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
            >
              Vazgeç
            </button>
            <div className="relative flex-1 group/btn">
              <button
                onClick={handleConfirm}
                disabled={selectedEvidence.length !== 3 || isSubmitting || foundEvidence.length < 3}
                className={cn(
                  'w-full py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2',
                  selectedEvidence.length === 3 && !isSubmitting
                    ? 'bg-primary hover:bg-red-800 text-white shadow-[0_10px_30px_rgba(139,0,0,0.3)]'
                    : 'bg-gray-900 text-gray-600 cursor-not-allowed border border-white/5'
                )}
              >
                {isSubmitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Değerlendiriliyor...</>
                ) : (
                  <><Gavel size={14} /> İthamı Onayla</>
                )}
              </button>
              {/* Tooltip — sadece disabled iken göster (Plan Madde 1) */}
              {selectedEvidence.length !== 3 && !isSubmitting && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 border border-white/10 text-[9px] text-gray-400 px-3 py-1.5 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                  {foundEvidence.length < 3
                    ? '⚠ Önce en az 3 kanıt toplamalısın'
                    : `En az 3 kanıt seçilmeli (${selectedEvidence.length}/3)`}
                </div>
              )}
            </div>
          </div>
          {/* Alt mesaj — dinamik (Plan Madde 1) */}
          <motion.p
            key={selectedEvidence.length}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'text-center text-[9px] mt-3',
              selectedEvidence.length === 3 ? 'text-accent/60' : 'text-gray-700'
            )}
          >
            {selectedEvidence.length === 3
              ? '✓ Tüm kanıtlar seçildi — itham etmeye hazırsın'
              : foundEvidence.length < 3
                ? `Sahneye dön ve ${3 - foundEvidence.length} kanıt daha topla`
                : `${3 - selectedEvidence.length} kanıt daha seçmen gerekiyor`}
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── ConfrontationOverlay ─────────────────────────────────────────────────────
function ConfrontationOverlay({
  result,
  onClose,
}: {
  result: {
    isCorrect: boolean;
    title: string;
    confrontation: string;
    confession?: string;
    suspect?: { name: string; role: string; generatedImageUrl?: string };
  };
  onClose: () => void;
}) {
  const isCorrect = result.isCorrect;

  // ── Müzik ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio(
      'https://raw.githubusercontent.com/rafaelreis-hotmart/Audio-Sample-files/master/sample.mp3'
    );
    audio.loop = true;
    audio.volume = isCorrect ? 0.25 : 0.35;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Tarayıcı autoplay engeli — sessizce geç
      });
    }

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [isCorrect]);

  // ── ESC ile kapat ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 md:p-10 overflow-y-auto">
      {/* Sinematik arka plan */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className={cn(
          'absolute inset-0',
          isCorrect
            ? 'bg-gradient-to-br from-[#000a00] via-[#050505] to-[#000a00]'
            : 'bg-gradient-to-br from-[#0d0000] via-[#050505] to-[#0d0000]'
        )}
      />

      {/* Pulse glow */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none',
          isCorrect ? 'bg-green-900/40' : 'bg-red-900/40'
        )}
      />

      {/* Ana kart */}
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: -20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.15 }}
        className={cn(
          'relative z-10 w-full max-w-2xl rounded-2xl sm:rounded-3xl overflow-hidden border shadow-2xl mx-auto max-h-[98vh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar',
          isCorrect
            ? 'border-green-500/30 shadow-[0_0_100px_rgba(34,197,94,0.12)]'
            : 'border-red-900/50 shadow-[0_0_100px_rgba(139,0,0,0.2)]'
        )}
      >
        {/* Suspect şeridi */}
        {result.suspect && (
          <div className="relative h-40 sm:h-52 bg-black overflow-hidden">
            {result.suspect.generatedImageUrl ? (
              <img
                src={result.suspect.generatedImageUrl}
                alt={result.suspect.name}
                className="w-full h-full object-cover object-top opacity-60"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/80">
                <User size={64} className="text-white/10" />
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />

            {/* Durum rozeti */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute top-5 left-1/2 -translate-x-1/2"
            >
              <div className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-full border text-[10px] font-bold uppercase tracking-[0.3em] backdrop-blur-md',
                isCorrect
                  ? 'bg-green-950/80 border-green-500/40 text-green-300'
                  : 'bg-red-950/80 border-red-500/40 text-red-300'
              )}>
                {isCorrect ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {isCorrect ? 'Vaka Çözüldü' : 'Yanlış İtham'}
              </div>
            </motion.div>

            {/* Şüpheli ismi */}
            <div className="absolute bottom-5 left-0 right-0 text-center px-6">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-2xl sm:text-3xl font-serif text-white drop-shadow-xl"
              >
                {result.suspect.name}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 }}
                className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mt-1"
              >
                {result.suspect.role}
              </motion.p>
            </div>
          </div>
        )}

        {/* İçerik */}
        <div className="bg-[#080808] p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Başlık */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="flex items-center gap-3"
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center border flex-shrink-0',
              isCorrect
                ? 'bg-green-950/50 border-green-500/30 text-green-400'
                : 'bg-red-950/50 border-red-900/50 text-red-400'
            )}>
              <Gavel size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-serif text-white">{result.title}</h3>
          </motion.div>

          {/* Yüzleşme hikayesi */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className={cn(
              'p-5 rounded-2xl border',
              isCorrect
                ? 'bg-green-950/10 border-green-900/30'
                : 'bg-red-950/10 border-red-900/30'
            )}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold mb-3 flex items-center gap-2 text-gray-500">
              <Quote size={10} /> Yüzleşme
            </p>
            <p className="text-gray-200 font-serif italic leading-relaxed text-[13px] sm:text-[15px]">
              "{result.confrontation}"
            </p>
          </motion.div>

          {/* İtiraf — sadece doğruysa */}
          {isCorrect && result.confession && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="p-5 rounded-2xl border bg-black/40 border-accent/20"
            >
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold mb-3 flex items-center gap-2 text-accent/70">
                <Sparkles size={10} /> İtiraf
              </p>
              <p className="text-accent/80 font-serif italic leading-relaxed text-[14px]">
                "{result.confession}"
              </p>
            </motion.div>
          )}

          {/* Buton */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            onClick={onClose}
            className={cn(
              'w-full py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2',
              isCorrect
                ? 'bg-green-900/30 hover:bg-green-900/60 border border-green-500/30 text-green-200'
                : 'bg-primary hover:bg-red-800 text-white shadow-[0_10px_30px_rgba(139,0,0,0.25)]'
            )}
          >
            {isCorrect ? (
              <><Trophy size={14} /> Zafer Ekranına Git</>
            ) : (
              <><ArrowLeft size={14} /> Soruşturmaya Dön</>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── AccusationFailModal ──────────────────────────────────────────────────────
function AccusationFailModal({ result, onClose }: { result: { correct: boolean; message: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="max-w-md w-full p-10 rounded-2xl text-center border bg-[#0d0505] border-primary/40 shadow-[0_0_80px_rgba(139,0,0,0.25)] relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-32 bg-primary/15 blur-[50px] rounded-full pointer-events-none" />
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 border-2 border-primary/70 text-primary bg-black/50 relative z-10">
          <XCircle size={40} strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-serif text-white mb-3 relative z-10">Yanlış İtham</h2>
        <div className="w-12 h-0.5 bg-primary/50 mx-auto mb-6" />
        <p className="text-gray-300 mb-8 leading-relaxed text-[15px] font-serif italic relative z-10">"{result.message}"</p>
        <button onClick={onClose} className="w-full py-4 bg-primary hover:bg-red-800 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all relative z-10">
          Soruşturmaya Dön
        </button>
      </motion.div>
    </div>
  );
}

// ─── CaseSummaryModal ─────────────────────────────────────────────────────────
function CaseSummaryModal({ resolution, onClose }: {
  resolution: { correct: boolean; killer: Character; score: number; stats: { foundEvidence: number; solvedPuzzles: number; accusations: number } };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/97 z-[300] flex items-center justify-center p-4 backdrop-blur-lg overflow-y-auto">
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 25 }}
        className="max-w-4xl w-full bg-[#0a0d0a] border border-green-900/50 rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_0_120px_rgba(34,197,94,0.1)] flex flex-col md:flex-row max-h-[95vh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar mx-2 sm:mx-4"
      >
        {/* Killer reveal */}
        <div className="w-full md:w-5/12 bg-black border-b md:border-b-0 md:border-r border-green-900/30 relative h-[35vh] md:h-auto min-h-[240px]">
          <CaseImage src={resolution.killer.generatedImageUrl} alt={resolution.killer.name}
            fallbackSeed={resolution.killer.name} className="w-full h-full absolute inset-0" contain={true} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050805] via-[#050805]/50 to-transparent" />
          <div className="absolute bottom-8 left-0 right-0 text-center px-6">
            <span className="text-[10px] uppercase tracking-[0.4em] text-green-500 font-bold mb-3 block">Katil Yakalandı</span>
            <h3 className="text-3xl sm:text-4xl font-serif text-white mb-1 drop-shadow-xl">{resolution.killer.name}</h3>
            <p className="text-[10px] sm:text-xs text-green-400/80 font-mono">{resolution.killer.role}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 p-6 sm:p-8 md:p-10 flex flex-col justify-center">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-950/50 flex items-center justify-center text-green-400 border border-green-500/30">
                <CheckCircle2 size={28} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-2xl font-serif text-white">Vaka Başarıyla Çözüldü</h2>
                <p className="text-xs text-gray-400 mt-1">Adalet yerini buldu.</p>
              </div>
            </div>

            <div className="py-5 border-y border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-accent font-bold mb-3 flex items-center gap-2"><Quote size={11} /> Motif</p>
              <p className="text-gray-300 font-serif italic leading-relaxed text-[15px]">
                "{resolution.killer.motive || 'Büyük bir intikam ve hırs uğrunaydı her şey...'}"
              </p>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Toplam Puan', val: resolution.score.toLocaleString(), icon: <Trophy size={15} className="text-accent" /> },
                { label: 'Kanıtlar', val: String(resolution.stats.foundEvidence), icon: <Search size={15} className="text-gray-500" /> },
                { label: 'Bulmacalar', val: String(resolution.stats.solvedPuzzles), icon: <PuzzleIcon size={15} className="text-gray-500" /> },
              ].map(item => (
                <div key={item.label} className="bg-black/30 p-3 sm:p-4 rounded-xl border border-white/5 text-center">
                  <p className="text-[8px] text-gray-500 uppercase font-bold tracking-widest mb-2">{item.label}</p>
                  <div className="flex items-center justify-center gap-1.5 font-mono font-bold text-lg sm:text-xl text-white">{item.icon} {item.val}</div>
                </div>
              ))}
            </div>

            <button onClick={onClose}
              className="group w-full py-4 bg-green-950/20 hover:bg-green-900/40 border border-green-900/50 hover:border-green-500/50 rounded-xl transition-all flex items-center justify-center gap-3"
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-green-100">Dosyayı Arşivle ve Çık</span>
              <ArrowRight size={15} className="text-green-500 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}