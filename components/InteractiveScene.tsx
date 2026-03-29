'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Evidence, InteractiveObject } from '@/types/game';
import { useGame } from '@/features/useGame';
import { Loader2, Eye, Sparkles, X, ScanSearch, Quote } from 'lucide-react';

// ─── useSound (GameView ile aynı motor — sıfır dosya bağımlılığı) ─────────────
type SoundKey = 'click' | 'discover' | 'success';
function useSound() {
  const ctxRef = React.useRef<AudioContext | null>(null);
  const getCtx = React.useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return null;
        ctxRef.current = new AudioCtx();
      }
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
      return ctxRef.current;
    } catch { return null; }
  }, []);

  const play = React.useCallback((key: SoundKey) => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const note = (freq: number, type: OscillatorType, offset: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(vol, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + dur + 0.02);
      };
      if (key === 'discover') {
        note(330, 'triangle', 0, 0.35, 0.10);
        note(494, 'triangle', 0.08, 0.30, 0.08);
        note(659, 'sine', 0.18, 0.40, 0.07);
        note(880, 'sine', 0.28, 0.35, 0.05);
      }
    } catch { /* sessizce geç */ }
  }, [getCtx]);

  return { play };
}

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface InteractiveSceneProps {
  evidence: Evidence;
  onClose?: () => void;
  className?: string;
}

// ─── Evidence Zoom Overlay ────────────────────────────────────────────────────
function EvidenceZoomOverlay({ evidence, onClose }: { evidence: Evidence; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 40, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 40, rotate: 2 }}
        className="relative max-w-4xl xl:max-w-6xl w-full aspect-[4/5] md:aspect-video bg-[#0f0e0c] rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col md:flex-row h-full max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/80 rounded-full border border-white/10 text-white/70 hover:text-white transition-all shadow-xl"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col md:flex-row h-full w-full">
          {/* Image Section */}
          <div className="relative flex-[1.5] bg-black overflow-hidden group">
            <img
              src={evidence.generatedImageUrl || '/placeholder-evidence.png'}
              alt={evidence.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {/* Label Badge */}
            <div className="absolute bottom-6 left-6">
              <span className="px-3 py-1 bg-amber-500 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-sm shadow-xl">
                Kanıt Parçası
              </span>
              <h2 className="text-3xl font-serif text-white mt-2 drop-shadow-lg">{evidence.title}</h2>
            </div>
          </div>

          {/* Details Section */}
          <div className="flex-1 flex flex-col bg-[#0d0c0a] border-l border-white/5 overflow-hidden">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-8 md:p-12 space-y-6 md:space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-amber-500/60 uppercase tracking-[0.3em] text-[10px] font-bold">
                  <ScanSearch size={14} />
                  Analiz Sonucu
                </div>

                <div className="space-y-4">
                  <p className="text-lg sm:text-xl md:text-2xl font-serif text-gray-200 italic leading-relaxed quote-text">
                    "{evidence.clueText}"
                  </p>
                  <div className="w-12 h-1 bg-amber-900/30 rounded-full" />
                </div>

                <div className="pt-4">
                  <p className="text-xs text-gray-500 leading-relaxed font-mono uppercase tracking-widest opacity-60">
                    Dosya No: {evidence.id.split('-')[0]}<br />
                    Konum: {evidence.location}
                  </p>
                </div>
              </div>
            </div>

            {/* Sticky Footer Button */}
            <div className="p-6 md:p-8 pt-0 bg-gradient-to-t from-[#0d0c0a] via-[#0d0c0a] to-transparent">
              <button
                onClick={onClose}
                className="w-full py-4 border border-amber-900/30 hover:border-amber-500/50 hover:bg-amber-500/5 text-amber-500/80 hover:text-amber-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all rounded-lg"
              >
                İncelemeyi Kapat
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface RevealPopupProps {
  object: InteractiveObject;
  onClose: () => void;
}

// ─── Reveal Popup ─────────────────────────────────────────────────────────────
function RevealPopup({ object, onClose }: RevealPopupProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 z-[400] backdrop-blur-md pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[401] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
      >
        <div className="bg-[#0d0b08] border border-amber-900/40 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden w-full max-w-lg pointer-events-auto flex flex-col">
          <div className="relative">
             {/* Decorative background icon */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[180px] opacity-[0.02] pointer-events-none select-none">
              {object.icon}
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
                  {object.icon}
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/70 leading-none mb-1.5">Bulgu Analizi</h4>
                  <p className="text-lg sm:text-xl font-serif text-white leading-none tracking-tight">{object.label}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all border border-white/5"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="relative px-6 sm:px-10 py-8 sm:py-12 border-y border-white/[0.03]">
              <div className="relative">
                <Quote className="absolute -top-6 -left-4 text-amber-500/10 w-12 h-12" />
                <p className="text-[18px] sm:text-[20px] text-gray-200 font-serif italic leading-[1.7] relative z-10 text-center sm:text-left">
                  {object.revealText}
                </p>
                <div className="flex justify-end mt-2 opacity-10">
                   <Quote className="w-8 h-8 rotate-180" />
                </div>
              </div>
              
              {object.linkedEvidenceId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 }}
                  className="mt-8 flex items-center gap-4 px-5 py-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-amber-500/60 font-black uppercase tracking-[0.2em] mb-0.5">Sistem Güncellemesi</span>
                    <span className="text-[11px] text-amber-400 font-bold uppercase tracking-[0.1em]">Envantere yeni kanıt eklendi</span>
                  </div>
                  <Sparkles size={18} className="text-amber-500/40 ml-auto" />
                </motion.div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-6 sm:p-8 bg-[#0a0907]">
              <button
                onClick={onClose}
                className="w-full py-5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/30 text-amber-500 text-[11px] font-black uppercase tracking-[0.5em] rounded-xl transition-all shadow-[0_0_30px_rgba(212,175,55,0.05)] active:scale-[0.98]"
              >
                İncelemeyi Kapat
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Hotspot Noktası ──────────────────────────────────────────────────────────
function HotspotPoint({
  object,
  isRevealed,
  onReveal,
  onOpen,
}: {
  object: InteractiveObject;
  isRevealed: boolean;
  onReveal: (obj: InteractiveObject) => void;
  onOpen: (obj: InteractiveObject) => void;
}) {
  const handleClick = useCallback(() => {
    if (!isRevealed) {
      onReveal(object);
    }
    onOpen(object);
  }, [isRevealed, object, onReveal, onOpen]);

  return (
    <div
      className="absolute"
      style={{
        left: `${object.x}%`,
        top: `${object.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
      }}
    >
      {/* Pulsing halka + merkez nokta */}
      <button
        onClick={handleClick}
        className="relative group focus:outline-none"
        title={object.label}
      >
        {/* Dış pulsing halka — keşfedilmemişse */}
        {!isRevealed && (
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-amber-400/40"
            style={{ width: 32, height: 32, margin: -8 }}
          />
        )}

        {/* İkinci pulsing halka (offset) */}
        {!isRevealed && (
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute inset-0 rounded-full bg-amber-300/30"
            style={{ width: 32, height: 32, margin: -8 }}
          />
        )}

        {/* Merkez nokta */}
        <motion.div
          whileHover={{ scale: 1.3 }}
          whileTap={{ scale: 0.9 }}
          className={`relative w-4 h-4 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors ${isRevealed
            ? 'bg-amber-600 border-amber-400 shadow-amber-900/50'
            : 'bg-amber-400 border-white shadow-amber-400/40 group-hover:bg-white'
            }`}
        >
          {isRevealed && (
            <Eye size={8} className="text-amber-200" />
          )}
        </motion.div>

        {/* Emoji label — hover'da göster */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          whileHover={{ opacity: 1, y: -8 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-black/80 text-[10px] text-white rounded-full whitespace-nowrap pointer-events-none border border-white/10"
        >
          {object.icon} {object.label}
        </motion.div>
      </button>
    </div>
  );
}

// ─── Ana Bileşen: InteractiveScene ────────────────────────────────────────────
export function InteractiveScene({ evidence: sceneEvidence, onClose, className }: InteractiveSceneProps) {
  const { revealInteractiveObject, isObjectRevealed, currentCase } = useGame();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [scanMode, setScanMode] = useState(true);
  const [zoomedEvidence, setZoomedEvidence] = useState<Evidence | null>(null);
  const [activeObject, setActiveObject] = useState<InteractiveObject | null>(null);

  // Görseli belirle
  const sceneImage = sceneEvidence.sceneImageUrl || sceneEvidence.generatedImageUrl;
  const fallbackImage = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(sceneEvidence.location)}&backgroundColor=0a0a0a&shapeColor=1a1a1a`;
  const displayImage = (!sceneImage || imageError) ? fallbackImage : sceneImage;

  const interactiveObjects = sceneEvidence.interactiveObjects || [];
  const revealedCount = interactiveObjects.filter(obj =>
    isObjectRevealed(sceneEvidence.id, obj.id)
  ).length;
  const totalCount = interactiveObjects.length;

  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const { play } = useSound(); // Keşif sesi

  const handleReveal = useCallback((obj: InteractiveObject) => {
    const result = revealInteractiveObject(sceneEvidence.id, obj.id);

    // Kanal engeli — mesajı göster ve işlemi durdur
    if (typeof result === 'string') {
      setBlockMessage(result);
      setTimeout(() => setBlockMessage(null), 5000);
      return;
    }

    // Başarı — keşif sesi + eğer nesne bir kanıta bağlıysa zoom yap
    play('discover');
    if (obj.linkedEvidenceId && currentCase) {
      const linkedEv = currentCase.evidence.find(e => e.id === obj.linkedEvidenceId);
      if (linkedEv) {
        setTimeout(() => setZoomedEvidence(linkedEv), 800);
      }
    }
  }, [sceneEvidence.id, revealInteractiveObject, currentCase]);

  return (
    <div className={`relative w-full rounded-xl bg-black ${className}`}>

      {/* Üst bar */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Tarama modu toggle */}
          <button
            onClick={() => setScanMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${scanMode
              ? 'bg-amber-400/20 border-amber-400/50 text-amber-400'
              : 'bg-white/5 border-white/15 text-gray-500 hover:text-gray-300'
              }`}
          >
            <ScanSearch size={11} />
            {scanMode ? 'Tarama Aktif' : 'Tara'}
          </button>

          {/* İlerleme */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/50 border border-white/10">
              <div className="flex gap-1">
                {interactiveObjects.map((obj) => (
                  <div
                    key={obj.id}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${isObjectRevealed(sceneEvidence.id, obj.id)
                      ? 'bg-amber-400'
                      : 'bg-gray-700'
                      }`}
                  />
                ))}
              </div>
              <span className="text-[9px] text-gray-500 font-mono">
                {revealedCount}/{totalCount}
              </span>
            </div>
          )}
        </div>

        {/* Kapat butonu */}
        {onClose && (
          <button
            onClick={onClose}
            className="pointer-events-auto p-1.5 bg-black/50 hover:bg-black/80 rounded-full border border-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Sahne görseli — Mobilde daha dikey (4:5), masaüstünde 16:9 — Max-h ile masaüstünde kontrol altında tutuyoruz */}
      <div className="relative w-full overflow-hidden aspect-[4/5] sm:aspect-video sm:max-h-[600px] xl:max-h-[700px]">
        {/* Yükleniyor */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
            <div className="text-center space-y-3">
              <Loader2 className="text-amber-400/30 animate-spin mx-auto" size={24} />
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">Sahne Yükleniyor</p>
            </div>
          </div>
        )}

        {/* Ana görsel */}
        <img
          src={displayImage}
          alt={sceneEvidence.location}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => { setImageError(true); setImageLoaded(true); }}
          draggable={false}
        />

        {/* Atmosferik overlay — alttan gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Grain texture overlay — noir atmosferi */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '150px',
          }}
        />

        {/* Hotspot noktaları — sadece tarama modunda */}
        <AnimatePresence>
          {scanMode && imageLoaded && interactiveObjects.map((obj) => (
            <motion.div
              key={obj.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ delay: Math.random() * 0.3 }}
            >
              <HotspotPoint
                object={obj}
                isRevealed={isObjectRevealed(sceneEvidence.id, obj.id)}
                onReveal={handleReveal}
                onOpen={(o) => setActiveObject(o)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Kanal Engeli Mesajı ─────────────────────────────────────────── */}
        <AnimatePresence>
          {blockMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4"
              style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}
            >
              <div className="bg-[#1a0d00]/95 border border-amber-800/50 rounded-xl px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">🔒</span>
                <p className="text-[12px] text-amber-200/90 font-serif italic leading-relaxed">{blockMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zoom Overlay */}
        <AnimatePresence>
          {zoomedEvidence && (
            <EvidenceZoomOverlay
              evidence={zoomedEvidence}
              onClose={() => setZoomedEvidence(null)}
            />
          )}
        </AnimatePresence>

        {/* Reveal Popup — Lifted state for global positioning */}
        <AnimatePresence>
          {activeObject && (
            <RevealPopup
              object={activeObject}
              onClose={() => setActiveObject(null)}
            />
          )}
        </AnimatePresence>

        {/* Tarama modu overlay — yok değil ama kapalıyken ipucu */}
        {!scanMode && imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[11px] text-gray-600 uppercase tracking-widest">
              Taramayı etkinleştir
            </p>
          </div>
        )}
      </div>

      {/* Alt bilgi çubuğu */}
      <div className="px-4 py-3 bg-[#080808] border-t border-white/5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-amber-400/60 font-bold mb-0.5">
            {sceneEvidence.location}
          </p>
          <p className="text-[12px] text-gray-400 font-serif italic leading-relaxed line-clamp-2">
            {sceneEvidence.locationDescription}
          </p>
        </div>
        {/* Tüm nesneler keşfedildiyse tebrik */}
        {totalCount > 0 && revealedCount === totalCount && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-800/40 rounded-full"
          >
            <Sparkles size={11} className="text-amber-400" />
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest whitespace-nowrap">
              Tam Tarama
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default InteractiveScene;