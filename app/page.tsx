'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Scroll, Shield, Fingerprint, ChevronRight } from 'lucide-react';
import { useGame } from '@/features/useGame';
import GameView from '@/components/GameView';

const THEMES = [
  { id: 'noir', label: 'Noir Gerilim', description: 'Boğaz yalıları, koyu sırlar', emoji: '🌃' },
  { id: 'ottoman', label: 'Osmanlı Gizemi', description: 'Tarihi konaklar, gizli toplantılar', emoji: '🕌' },
  { id: '50s', label: '1950\'ler İstanbul', description: 'Retro Boğaz, dönemin atmosferi', emoji: '🚢' },
  { id: 'modern', label: 'Modern Gerilim', description: 'Teknoloji, şirket entrikası', emoji: '💻' },
  { id: 'art', label: 'Sanat Dünyası', description: 'Galeri katliamı, sahte tablolar', emoji: '🎨' },
  { id: 'family', label: 'Konak Dramı', description: 'Miras, aile sırları, ihanet', emoji: '🏚️' },
];

export default function Home() {
  const { currentCase, isLoading, startNewCase, generationProgress, loadingMessage, hasSavedGame, loadSavedGame } = useGame();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(false);

  if (currentCase) {
    return <GameView caseData={currentCase} />;
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4">
      {/* Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 transform -rotate-12">
          <Fingerprint size={280} className="text-accent" />
        </div>
        <div className="absolute bottom-10 right-10 transform rotate-12">
          <Search size={280} className="text-accent" />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="z-10 text-center max-w-3xl w-full"
      >
        <span className="text-accent tracking-[0.4em] uppercase text-xs mb-4 block glow-text font-bold">
          Yapay Zeka Destekli Polisiye Deneyimi
        </span>

        <h1 className="text-7xl md:text-9xl font-serif mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-600 font-bold tracking-tighter">
          DEDEKTİF
        </h1>

        <p className="text-lg typewriter-text text-gray-500 mb-10 leading-relaxed max-w-xl mx-auto">
          Gemini AI tarafından anında oluşturulan benzersiz vakalar.
          Sorgula, kanıt topla, katili bul.
        </p>

        {/* Theme selection */}
        <AnimatePresence>
          {showThemes && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(selectedTheme === theme.id ? null : theme.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${selectedTheme === theme.id
                        ? 'border-accent/60 bg-accent/10 text-white'
                        : 'border-white/10 bg-white/3 text-gray-500 hover:bg-white/8'
                      }`}
                  >
                    <span className="text-xl mb-2 block">{theme.emoji}</span>
                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5">{theme.label}</p>
                    <p className="text-[9px] text-gray-600">{theme.description}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => {
              const theme = selectedTheme
                ? THEMES.find(t => t.id === selectedTheme)?.label
                : undefined;
              startNewCase(theme);
            }}
            disabled={isLoading}
            className="group relative px-10 py-4 bg-primary text-white font-bold rounded-lg detective-border transition-all hover:bg-red-900 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Vaka Dosyası Hazırlanıyor...
              </span>
            ) : (
              <span className="flex items-center gap-2 uppercase tracking-widest text-sm">
                <Scroll className="group-hover:rotate-12 transition-transform" size={18} />
                {selectedTheme ? `${THEMES.find(t => t.id === selectedTheme)?.label} Vakası` : 'Rastgele Vaka'}
              </span>
            )}
          </button>

          {hasSavedGame && !isLoading && (
            <button
              onClick={loadSavedGame}
              className="group relative px-10 py-4 bg-accent/10 border border-accent/30 text-accent font-bold rounded-lg transition-all hover:bg-accent/20 active:scale-95 shadow-[0_0_20px_rgba(212,175,55,0.05)]"
            >
              <span className="flex items-center gap-2 uppercase tracking-widest text-sm">
                <Shield className="group-hover:scale-110 transition-transform" size={18} />
                Vakaya Devam Et
              </span>
            </button>
          )}

          <button
            onClick={() => setShowThemes(!showThemes)}
            className="px-6 py-4 border border-white/15 text-gray-400 hover:text-white hover:border-white/30 rounded-lg text-sm uppercase tracking-widest font-bold transition-all flex items-center gap-2"
          >
            Tema Seç
            <ChevronRight size={14} className={`transition-transform ${showThemes ? 'rotate-90' : ''}`} />
          </button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            { icon: <Search className="text-accent" size={20} />, title: 'Kanıt Keşfet', desc: 'Olay yerini tara, gizli kanıtları bul ve analiz et.' },
            { icon: <Shield className="text-accent" size={20} />, title: 'Derin Sorgula', desc: 'AI destekli şüpheliler her soruya karakter uyumlu cevap verir.' },
            { icon: <Fingerprint className="text-accent" size={20} />, title: 'Bulmacaları Çöz', desc: 'Şifreler, mantık soruları, bilmeceler — her vaka benzersiz.' },
          ].map((f) => (
            <div key={f.title} className="p-5 border border-white/8 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-serif text-base mb-1 text-white">{f.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md px-6 text-center"
          >
            {/* Background Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.1 }}
              transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
              className="absolute pointer-events-none"
            >
              <Fingerprint size={400} className="text-accent" />
            </motion.div>

            <div className="relative z-10 max-w-md w-full">
              {/* Progress Percentage */}
              <motion.div 
                key={generationProgress}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl font-serif mb-2 text-white/20 italic"
              >
                %{generationProgress}
              </motion.div>

              {/* Atmospheric Message */}
              <motion.div
                key={loadingMessage}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xl md:text-2xl font-serif text-white mb-10 min-h-[3rem] px-4"
              >
                {loadingMessage}
              </motion.div>

              {/* Progress Bar Container */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-4 detective-border-soft">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${generationProgress}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 20 }}
                  className="h-full bg-accent shadow-[0_0_15px_rgba(153,27,27,0.8)]"
                />
              </div>

              {/* Sub-text */}
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] animate-pulse">
                Soruşturma Dosyası Hazırlanıyor
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="absolute bottom-6 text-gray-700 text-[10px] tracking-widest uppercase typewriter-text">
        &copy; 2026 Dedektif AI Storyteller · Gemini Powered
      </footer>
    </main>
  );
}