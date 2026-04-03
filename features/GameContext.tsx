'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Case, GameState, Character, Evidence } from '@/types/game';
import {
  generateBaseCaseAction,
  generateSingleImageAction,
  evaluatePuzzleAction,
  evaluateAccusationAction
} from '@/app/actions/game';
import { getAvailableCaseFromCache, saveNewCaseToCache } from '@/app/actions/cache';
import { interrogateSuspectAction } from '@/app/actions/interrogate';
import { MOCK_CASE } from '@/lib/mockCase';

const INITIAL_GAME_STATE: GameState = {
  currentCaseId: null,
  solvedCaseIds: [],
  unlockedClueIds: [],
  foundEvidenceIds: [],
  interrogationHistory: {},
  accusationCount: 0,
  score: 0,
  hintsUsed: 0,
  timeStarted: new Date().toISOString(),
  suspicionLevels: {},
  notebookEntries: [],
  discoveredChapterIds: [],
  revealedObjectIds: [],
  puzzleAttempts: {},
  hintProgress: {},
};

interface GameContextType {
  currentCase: Case | null;
  gameState: GameState;
  isLoading: boolean;
  isInterrogating: boolean;
  error: string | null;
  caseResolution: any | null;
  setCaseResolution: (res: any | null) => void;
  startNewCase: (theme?: string) => Promise<void>;
  solvePuzzle: (puzzleId: string, answer: string) => Promise<{ isCorrect: boolean; feedback: string }>;
  findEvidence: (evidenceId: string) => void;
  interrogate: (characterId: string, question: string) => Promise<string | null>;
  makeAccusation: (characterId: string, evidenceIds: string[]) => any;
  confrontationResult: any | null;
  clearConfrontation: () => void;
  setSuspicionLevel: (characterId: string, level: number) => void;
  addNotebookEntry: (entry: string) => void;
  useHint: (puzzleId: string) => string | null;
  exitCase: () => void;
  revealInteractiveObject: (evidenceId: string, objectId: string) => string | null;
  isObjectRevealed: (evidenceId: string, objectId: string) => boolean;
  generationProgress: number;
  loadingMessage: string;
  notification: { type: 'success' | 'info' | 'warning'; text: string } | null;
  showNotification: (type: 'success' | 'info' | 'warning', text: string) => void;
  hasSavedGame: boolean;
  loadSavedGame: () => Promise<void>;
  clearStorage: () => Promise<void>;
  startDemoCase: () => void;
  // ── Hardcore Gizem: Akıllı Yardım ───────────────────────────────────────────
  getSmartHint: () => { type: 'scene' | 'interrogation' | 'puzzle' | 'none'; message: string; targetId?: string };
  lastActivityTime: number;
}

// ─── IndexedDB Utils ───────────────────────────────────────────────────────────
const DB_NAME = 'DedektifDB';
const STORE_NAME = 'cases';

async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('SSR');
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveCaseToDB(caseData: Case): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(caseData, 'current_case');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB save failed:', e);
  }
}

async function loadCaseFromDB(): Promise<Case | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current_case');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

async function clearCaseFromDB(): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete('current_case');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB clear failed:', e);
  }
}

function stripImagesFromCase(caseData: Case): Case {
  return {
    ...caseData,
    generatedImageUrl: undefined,
    victim: caseData.victim ? { ...caseData.victim, generatedImageUrl: undefined } : caseData.victim,
    characters: caseData.characters.map(c => ({ ...c, generatedImageUrl: undefined })),
    evidence: caseData.evidence.map(e => ({
      ...e,
      generatedImageUrl: undefined,
      sceneImageUrl: undefined,
    })),
    puzzles: caseData.puzzles.map(p => ({ ...p, generatedImageUrl: undefined })),
    chapters: (caseData.chapters || []).map(ch => ({ ...ch, generatedImageUrl: undefined })),
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────
const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'info' | 'warning', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 6000);
  }, []);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isInterrogating, setIsInterrogating] = useState(false);
  const [caseResolution, setCaseResolution] = useState<{
    correct: boolean;
    killer: Character;
    score: number;
    stats: { foundEvidence: number; solvedPuzzles: number; accusations: number };
  } | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const [confrontationResult, setConfrontationResult] = useState<any | null>(null);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [playedCaseIds, setPlayedCaseIds] = useState<string[]>([]);
  // ── Hardcore Gizem: Son aktivite zamanı (Yardım Al için) ─────────────────────
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());

  const clearConfrontation = useCallback(() => {
    setConfrontationResult(null);
  }, []);

  useEffect(() => {
    const checkStorage = async () => {
      try {
        const savedState = localStorage.getItem('dedektif_game_state_v2');
        const savedCase = await loadCaseFromDB();
        const savedPlayedIds = localStorage.getItem('dedektif_played_cases_v2');

        if (savedState && savedCase) {
          setHasSavedGame(true);
        }
        if (savedPlayedIds) {
          setPlayedCaseIds(JSON.parse(savedPlayedIds));
        }
      } catch (e) {
        console.warn('Storage check failed:', e);
      } finally {
        setHasHydrated(true);
      }
    };
    checkStorage();
  }, []);

  const loadSavedGame = useCallback(async () => {
    try {
      const savedState = localStorage.getItem('dedektif_game_state_v2');
      const savedCase = await loadCaseFromDB();

      if (savedState && savedCase) {
        const parsedState = JSON.parse(savedState);
        setGameState({
          ...INITIAL_GAME_STATE,
          ...parsedState,
          revealedObjectIds: parsedState.revealedObjectIds || [],
          puzzleAttempts: parsedState.puzzleAttempts || {},
          hintProgress: parsedState.hintProgress || {},
        });
        setCurrentCase(normalizeCase(savedCase));
        setHasSavedGame(true);
        showNotification('info', 'Soruşturma başarıyla yüklendi.');
      }
    } catch (e) {
      console.error('Load failed:', e);
      showNotification('warning', 'Kayıt yüklenemedi.');
    }
  }, [showNotification]);

  useEffect(() => {
    if (hasHydrated && currentCase) {
      localStorage.setItem('dedektif_game_state_v2', JSON.stringify(gameState));
      setHasSavedGame(true);
    }
  }, [gameState, hasHydrated, currentCase]);

  useEffect(() => {
    if (hasHydrated && currentCase) {
      saveCaseToDB(currentCase).catch(console.warn);
    }
  }, [currentCase, hasHydrated]);

  useEffect(() => {
    if (!currentCase?.chapters) return;
    const foundCount = gameState.foundEvidenceIds.length;

    const hasNewUnlocks = currentCase.chapters.some(
      ch => !ch.isUnlocked && foundCount >= (ch.unlocksAfterEvidenceCount ?? 0)
    );

    if (!hasNewUnlocks) return;

    const updatedChapters = currentCase.chapters.map(ch => ({
      ...ch,
      isUnlocked: foundCount >= (ch.unlocksAfterEvidenceCount ?? 0),
    }));

    const newlyUnlocked = updatedChapters
      .filter(ch => ch.isUnlocked && !gameState.discoveredChapterIds.includes(ch.id))
      .map(ch => ch.id);

    if (newlyUnlocked.length > 0) {
      setCurrentCase(prev => prev ? { ...prev, chapters: updatedChapters } : prev);
      setGameState(prev => ({
        ...prev,
        discoveredChapterIds: [...prev.discoveredChapterIds, ...newlyUnlocked],
      }));
    }
  }, [gameState.foundEvidenceIds.length, currentCase?.id]);

  const startNewCase = useCallback(async (theme?: string) => {
    setIsLoading(true);
    setGenerationProgress(0);
    setLoadingMessage('Soruşturma dosyası açılıyor...');
    setError(null);

    // ── GİZLİ ADIM: CACHE KONTROLÜ (Maliyet Dostu) ──────────────────────────────
    try {
      const selectedTheme = theme || "Karma Vakalar";
      
      // Mevcut vakayı ve daha önce oynananları hariç tut
      const excludeIds = currentCase?.id 
        ? Array.from(new Set([...playedCaseIds, currentCase.id]))
        : playedCaseIds;

      const cachedCase = await getAvailableCaseFromCache(selectedTheme, excludeIds);

      if (cachedCase) {
        setGenerationProgress(50);
        setLoadingMessage('Arşivden vaka dosyası getiriliyor...');

        // Simüle edilmiş bir bekleme (anında açılmasın, hissiyat için)
        await new Promise(resolve => setTimeout(resolve, 1500));

        setCurrentCase(normalizeCase(cachedCase));
        
        // ── CACHE: Görülen vakayı hemen listeye ekle (Döngüyü kırmak için) ──
        setPlayedCaseIds(prev => {
          const updated = Array.from(new Set([...prev, cachedCase.id]));
          localStorage.setItem('dedektif_played_cases_v2', JSON.stringify(updated));
          return updated;
        });

        setGameState({
          ...INITIAL_GAME_STATE,
          currentCaseId: cachedCase.id,
          solvedCaseIds: gameState.solvedCaseIds,
          timeStarted: new Date().toISOString(),
          discoveredChapterIds: cachedCase.chapters?.filter((ch: any) => ch.isUnlocked).map((ch: any) => ch.id) || [],
          revealedObjectIds: [],
          puzzleAttempts: {},
          hintProgress: {},
        });
        setGenerationProgress(100);
        setIsLoading(false);
        showNotification('info', 'Arşivdeki gizemli bir vaka dosyası açıldı.');
        return;
      }
    } catch (cacheErr) {
      console.warn('Cache check failed, moving to generation:', cacheErr);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const simulationPhases = [
      { progress: 5, message: 'Suç mahalli inceleniyor...' },
      { progress: 12, message: 'Olay yeri kordon altına alınıyor...' },
      { progress: 20, message: 'Şüphelilerin geçmişi araştırılıyor...' },
      { progress: 30, message: 'Parmak izleri taranıyor...' },
      { progress: 40, message: 'Karanlık sırlar yerleştiriliyor...' },
      { progress: 52, message: 'Adli tıp raporu hazırlanıyor...' },
      { progress: 62, message: 'Bulmacalar kurgulanıyor...' },
      { progress: 72, message: 'Tanık ifadeleri alınıyor...' },
      { progress: 82, message: 'Kanıt dosyaları düzenleniyor...' },
    ];

    let phaseIndex = 0;
    const simulationInterval = setInterval(() => {
      if (phaseIndex < simulationPhases.length) {
        const phase = simulationPhases[phaseIndex];
        setGenerationProgress(phase.progress);
        setLoadingMessage(phase.message);
        phaseIndex++;
      }
    }, 1800);

    const messages = [
      'Olay yeri kordon altına alınıyor...',
      'Parmak izleri taranıyor...',
      'Şüphelilerin geçmişi inceleniyor...',
      'Adli tıp raporu bekleniyor...',
      'Görgü tanıkları dinleniyor...',
      'Kanıtlar torbalanıyor...',
      'Balistik inceleme yapılıyor...',
      'Odalardaki ipuçları toplanıyor...',
    ];

    try {
      // 1. ADIM: Metin Verisi (Hızlı)
      const baseCase = await generateBaseCaseAction(theme);
      clearInterval(simulationInterval);

      setGenerationProgress(10);
      setLoadingMessage(messages[0]);

      // 2. ADIM: İş Listesi Oluştur
      const updatedCase = { ...baseCase };
      const tasks: { type: string; prompt: string; setter: (url: string) => void }[] = [];

      tasks.push({ type: 'main', prompt: baseCase.imagePrompt, setter: (url) => { updatedCase.generatedImageUrl = url; } });

      if (baseCase.victim) {
        tasks.push({ type: 'victim', prompt: baseCase.victim.imagePrompt, setter: (url) => { if (updatedCase.victim) updatedCase.victim.generatedImageUrl = url; } });
      }

      baseCase.characters.forEach((char, idx) => {
        tasks.push({ type: 'char', prompt: char.imagePrompt, setter: (url) => { updatedCase.characters[idx].generatedImageUrl = url; } });
      });

      baseCase.evidence.forEach((ev, idx) => {
        tasks.push({ type: 'ev-obj', prompt: ev.imagePrompt, setter: (url) => { updatedCase.evidence[idx].generatedImageUrl = url; } });
        if (ev.sceneImagePrompt) {
          tasks.push({ type: 'ev-scene', prompt: ev.sceneImagePrompt, setter: (url) => { updatedCase.evidence[idx].sceneImageUrl = url; } });
        }
      });

      baseCase.chapters.forEach((ch, idx) => {
        tasks.push({ type: 'chapter', prompt: ch.imagePrompt, setter: (url) => { updatedCase.chapters[idx].generatedImageUrl = url; } });
      });

      baseCase.puzzles.forEach((p, idx) => {
        if (p.imagePrompt) {
          tasks.push({ type: 'puzzle', prompt: p.imagePrompt, setter: (url) => { updatedCase.puzzles[idx].generatedImageUrl = url; } });
        }
      });

      // 3. ADIM: PARALEL HAVUZ (CHUNKING) MANTIĞI
      const chunkSize = 3;
      for (let i = 0; i < tasks.length; i += chunkSize) {
        const chunk = tasks.slice(i, i + chunkSize);
        const completedTasks = Math.min(i + chunkSize, tasks.length);
        const currentProgress = 10 + Math.round((completedTasks / tasks.length) * 85);
        setGenerationProgress(currentProgress);
        setLoadingMessage(messages[Math.floor(i / chunkSize) % messages.length]);

        await Promise.all(
          chunk.map(async (t) => {
            try {
              // caseId parametresini ekleyerek görselin hemen host edilmesini sağlıyoruz
              const imageUrl = await generateSingleImageAction(t.prompt, updatedCase.id);
              if (imageUrl) t.setter(imageUrl);
            } catch (err) {
              console.error(`Görsel üretilirken hata oluştu (${t.type}):`, err);
            }
          })
        );
      }

      setGenerationProgress(98);
      setLoadingMessage('Vaka arşive kaydediliyor...');

      // ── YENİ ADIM: ÜRETİLEN VAKAYI CACHE'E KAYDET ─────────────────────────────
      try {
        await saveNewCaseToCache(updatedCase);
      } catch (cacheSaveErr) {
        console.warn('Vaka cache\'e kaydedilemedi:', cacheSaveErr);
      }
      // ─────────────────────────────────────────────────────────────────────────

      // 4. ADIM: State Güncelle ve Başlat
      setCurrentCase(updatedCase);
      
      // ── CACHE: Yeni üretilen vakayı hemen görüldü listesine ekle ──
      setPlayedCaseIds(prev => {
        const updated = Array.from(new Set([...prev, updatedCase.id]));
        localStorage.setItem('dedektif_played_cases_v2', JSON.stringify(updated));
        return updated;
      });

      setGameState({
        ...INITIAL_GAME_STATE,
        currentCaseId: updatedCase.id,
        solvedCaseIds: gameState.solvedCaseIds,
        timeStarted: new Date().toISOString(),
        discoveredChapterIds: updatedCase.chapters?.filter((ch: any) => ch.isUnlocked).map((ch: any) => ch.id) || [],
        revealedObjectIds: [],
        puzzleAttempts: {},
        hintProgress: {},
      });

      setGenerationProgress(100);
      setLoadingMessage('Vaka Dosyası Hazır!');
    } catch (err: any) {
      clearInterval(simulationInterval);
      console.error(err);
      setError(err.message || 'Vaka başlatılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }, [gameState.solvedCaseIds, playedCaseIds, currentCase?.id, showNotification]);

  const startDemoCase = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage('Demo Dosyası Hazırlanıyor...');
    setGenerationProgress(10);
    setError(null);

    // ── GİZLİ ADIM: CACHE KONTROLÜ (DUMENDEN :)) ────────────────────────────
    try {
      const demoTheme = MOCK_CASE.theme; // Noir / 1950'ler
      const cachedDemo = await getAvailableCaseFromCache(demoTheme, playedCaseIds);

      if (cachedDemo) {
        setGenerationProgress(70);
        setLoadingMessage('Demo dosyası arşivden çıkarılıyor...');

        await new Promise(resolve => setTimeout(resolve, 800));

        setCurrentCase(normalizeCase(cachedDemo));
        
        // ── CACHE: Demo vakayı da görüldü olarak işaretle ──
        setPlayedCaseIds(prev => {
          const updated = Array.from(new Set([...prev, cachedDemo.id]));
          localStorage.setItem('dedektif_played_cases_v2', JSON.stringify(updated));
          return updated;
        });

        setGameState({
          ...INITIAL_GAME_STATE,
          currentCaseId: cachedDemo.id,
          solvedCaseIds: gameState.solvedCaseIds,
          timeStarted: new Date().toISOString(),
          discoveredChapterIds: cachedDemo.chapters?.filter((ch: any) => ch.isUnlocked).map((ch: any) => ch.id) || [],
          revealedObjectIds: [],
          puzzleAttempts: {},
        });

        setGenerationProgress(100);
        setIsLoading(false);
        showNotification('info', 'Arşivdeki demo vaka dosyası başarıyla açıldı.');
        return;
      }
    } catch (cacheErr) {
      console.warn('Demo cache check failed:', cacheErr);
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      // 1. ADIM: Demo Veriyi Al (Dümenden :))
      const demoCase = JSON.parse(JSON.stringify(MOCK_CASE)) as Case;

      // CRITICAL FIX: UUID Format (Postgres için gerçek UUID olmalı)
      demoCase.id = crypto.randomUUID();

      // 2. ADIM: Sadece 2 Tane Görsel Üretelim (Test İçin)
      setLoadingMessage('Demo için ana sahne çiziliyor...');
      setGenerationProgress(30);
      const mainImg = await generateSingleImageAction(demoCase.imagePrompt, demoCase.id);
      if (mainImg) demoCase.generatedImageUrl = mainImg;

      if (demoCase.victim) {
        setLoadingMessage('Demo için kurban dosyası hazırlanıyor...');
        setGenerationProgress(60);
        const victimImg = await generateSingleImageAction(demoCase.victim.imagePrompt, demoCase.id);
        if (victimImg) demoCase.victim.generatedImageUrl = victimImg;
      }

      // 3. ADIM: Supabase Cache'e Gönder (Tüm Pipeline'ı Test Et)
      setLoadingMessage('Demo vaka arşive kaydediliyor (WebP/Storage Test)...');
      setGenerationProgress(85);
      await saveNewCaseToCache(demoCase);

      // 4. ADIM: Başlat
      setCurrentCase(demoCase);
      
      // ── CACHE: Yeni üretilen demo vakayı görüldü olarak işaretle ──
      setPlayedCaseIds(prev => {
        const updated = Array.from(new Set([...prev, demoCase.id]));
        localStorage.setItem('dedektif_played_cases_v2', JSON.stringify(updated));
        return updated;
      });

      setGameState({
        ...INITIAL_GAME_STATE,
        currentCaseId: demoCase.id,
        timeStarted: new Date().toISOString(),
        discoveredChapterIds: demoCase.chapters.filter(ch => ch.isUnlocked).map(ch => ch.id),
      });

      setGenerationProgress(100);
      setIsLoading(false);
      showNotification('success', 'Demo vaka ve 2 özel görsel hazır! Supabase kontrol edilebilir.');
    } catch (err: any) {
      console.error('Demo test error:', err);
      setError('Demo testi sırasında bir hata oluştu.');
      setIsLoading(false);
    }
  }, [showNotification]);

  const findEvidence = useCallback((evidenceId: string) => {
    if (!currentCase) return;

    const targetEvidence = currentCase.evidence.find(e => e.id === evidenceId);
    if (!targetEvidence) return;

    const now = new Date().toISOString();

    setCurrentCase(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        evidence: prev.evidence.map(e =>
          e.id === evidenceId ? { ...e, isFound: true, foundAt: now } : e
        ),
      };
    });

    setGameState(prev => {
      if (prev.foundEvidenceIds.includes(evidenceId)) return prev;

      showNotification('success', targetEvidence.title + ' dosyaya eklendi! Kanıtlar sekmesini incele.');
      setLastActivityTime(Date.now());

      return {
        ...prev,
        foundEvidenceIds: [...prev.foundEvidenceIds, evidenceId],
        score: prev.score + 150,
      };
    });
  }, [currentCase, showNotification]);

  const revealInteractiveObject = useCallback((evidenceId: string, objectId: string): string | null => {
    if (!currentCase) return null;

    const compositeKey = `${evidenceId}:${objectId}`;

    if (gameState.revealedObjectIds.includes(compositeKey)) return null;

    const evidence = currentCase.evidence.find(e => e.id === evidenceId);
    if (!evidence) return null;

    const obj = evidence.interactiveObjects?.find(o => o.id === objectId);
    if (!obj) return null;

    // Önce nesneyi her durumda "keşfedildi" olarak işaretle (sahne tamamlanabilsin)
    setCurrentCase(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        evidence: prev.evidence.map(ev => {
          if (ev.id !== evidenceId) return ev;
          return {
            ...ev,
            interactiveObjects: (ev.interactiveObjects || []).map(o =>
              o.id === objectId ? { ...o, isRevealed: true } : o
            ),
          };
        }),
      };
    });

    setGameState(prev => ({
      ...prev,
      revealedObjectIds: [...prev.revealedObjectIds, compositeKey],
      score: prev.score + 25,
    }));

    // Kanıt bağlantısı varsa: kilit kontrolü yap
    if (obj.linkedEvidenceId) {
      const linkedEv = currentCase.evidence.find(e => e.id === obj.linkedEvidenceId);
      if (linkedEv?.isHidden) {
        return `🔒 Bir iz buldun! Ancak bu kanıtı açmak için önce doğru şüpheliyi sorgulayarak bilgiyi açığa çıkarmalısın.`;
      }

      const linkedPuzzle = currentCase.puzzles.find(p => p.unlocksEvidenceId === obj.linkedEvidenceId);
      if (linkedPuzzle && !linkedPuzzle.isSolved) {
        return `🧩 Bir iz buldun! Ancak bu kanıta ulaşmak için "${linkedPuzzle.title}" bulmacasını çözmelisin.`;
      }

      // Kilit yoksa kanıtı aç
      findEvidence(obj.linkedEvidenceId);
    }

    return null;
  }, [currentCase, gameState.revealedObjectIds, findEvidence]);

  const isObjectRevealed = useCallback((evidenceId: string, objectId: string): boolean => {
    return gameState.revealedObjectIds.includes(`${evidenceId}:${objectId}`);
  }, [gameState.revealedObjectIds]);

  const solvePuzzle = useCallback(async (
    puzzleId: string,
    answer: string
  ): Promise<{ isCorrect: boolean; feedback: string }> => {
    if (!currentCase) return { isCorrect: false, feedback: 'Vaka bulunamadı.' };

    const puzzle = currentCase.puzzles.find(p => p.id === puzzleId);
    if (!puzzle) return { isCorrect: false, feedback: 'Bulmaca bulunamadı.' };

    try {
      const cleanPuzzle = {
        ...puzzle,
        generatedImageUrl: undefined,
        imagePrompt: undefined,
      };

      const currentAttempts = (gameState.puzzleAttempts[puzzleId] || 0) + 1;
      setGameState(prev => ({
        ...prev,
        puzzleAttempts: { ...prev.puzzleAttempts, [puzzleId]: currentAttempts }
      }));

      const evaluation = await evaluatePuzzleAction(cleanPuzzle as any, answer, currentAttempts);

      if (evaluation.isCorrect) {
        setCurrentCase(prev => prev ? {
          ...prev,
          puzzles: prev.puzzles.map(p => p.id === puzzleId ? { ...p, isSolved: true } : p),
        } : prev);

        setGameState(prev => {
          // Çözülen bulmacaya ait hintProgress sıfırla
          const updatedHintProgress = { ...prev.hintProgress };
          delete updatedHintProgress[puzzleId];
          return {
            ...prev,
            unlockedClueIds: [...prev.unlockedClueIds, puzzleId],
            score: prev.score + (puzzle.points || 200),
            hintProgress: updatedHintProgress,
          };
        });

        if (puzzle.unlocksEvidenceId) {
          findEvidence(puzzle.unlocksEvidenceId);
        }
      }
      return evaluation;
    } catch (err) {
      console.error('Puzzle evaluation failed:', err);
      const isCorrect = puzzle.answer.toLowerCase().trim() === answer.toLowerCase().trim();
      if (isCorrect) {
        setCurrentCase(prev => prev ? {
          ...prev,
          puzzles: prev.puzzles.map(p => p.id === puzzleId ? { ...p, isSolved: true } : p),
        } : prev);
        setGameState(prev => {
          const updatedHintProgress = { ...prev.hintProgress };
          delete updatedHintProgress[puzzleId];
          return {
            ...prev,
            unlockedClueIds: [...prev.unlockedClueIds, puzzleId],
            score: prev.score + (puzzle.points || 200),
            hintProgress: updatedHintProgress,
          };
        });
        if (puzzle.unlocksEvidenceId) findEvidence(puzzle.unlocksEvidenceId);
      }
      return {
        isCorrect,
        feedback: isCorrect ? 'Doğru! (Basit eşleşme ile doğrulandı)' : 'Yanlış cevap.',
      };
    }
  }, [currentCase, findEvidence, gameState.puzzleAttempts]);

  const interrogate = useCallback(async (
    characterId: string,
    question: string
  ): Promise<string | null> => {
    if (!currentCase) return null;
    if (isInterrogating) return null;

    const character = currentCase.characters.find(c => c.id === characterId);
    if (!character) return null;

    setIsInterrogating(true);

    const history = gameState.interrogationHistory[characterId] || [];

    try {
      const cleanCharacter: Character = {
        ...character,
        generatedImageUrl: undefined,
      };

      // Client tarafında da büyük verileri temizle (Vercel Payload limit güvenliği)
      const minimalEvidence = currentCase.evidence.map(e => ({
        id: e.id,
        title: e.title,
        isHidden: e.isHidden
      } as Evidence));

      const rawResponse = await interrogateSuspectAction(
        currentCase.title,
        currentCase.fullStory,
        cleanCharacter,
        question,
        history.slice(-10),
        minimalEvidence
      );

      let response = rawResponse;
      const revealMatch = rawResponse.match(/\[REVEAL:(.+?)\]/);
      if (revealMatch) {
        const revealedId = revealMatch[1];
        response = rawResponse.replace(/\[REVEAL:.+?\]/g, '').trim();

        setGameState(prev => {
          if (!prev.foundEvidenceIds.includes(revealedId)) {
            findEvidence(revealedId);
            showNotification('success', 'Yeni bir ipucu bulundu! Kanıtlar sekmesini incele.');
          }
          return prev;
        });
      }

      setGameState(prev => ({
        ...prev,
        interrogationHistory: {
          ...prev.interrogationHistory,
          [characterId]: [
            ...history,
            { role: 'user' as const, message: question },
            { role: 'model' as const, message: response },
          ],
        },
        score: prev.score + 25,
      }));
      setLastActivityTime(Date.now());

      return response;
    } catch (err: any) {
      console.error('Interrogation failed:', err);
      return null;
    } finally {
      setIsInterrogating(false);
    }
  }, [currentCase, gameState.interrogationHistory, isInterrogating, findEvidence, showNotification]);

  const setSuspicionLevel = useCallback((characterId: string, level: number) => {
    setGameState(prev => ({
      ...prev,
      suspicionLevels: { ...prev.suspicionLevels, [characterId]: level },
    }));
  }, []);

  const addNotebookEntry = useCallback((entry: string) => {
    setGameState(prev => ({
      ...prev,
      notebookEntries: [...prev.notebookEntries, `[${new Date().toLocaleTimeString('tr-TR')}] ${entry}`],
    }));
  }, []);

  const useHint = useCallback((puzzleId: string): string | null => {
    if (!currentCase) return null;
    const puzzle = currentCase.puzzles.find(p => p.id === puzzleId);
    if (!puzzle) return null;

    // Kaç kez ipucu istendi bu bulmaca için? (sınırsız)
    const currentLevel = (gameState.hintProgress[puzzleId] || 0) + 1;

    // Puan maliyeti: ilk 3 ipucu -50, sonrakiler -25 (sürekli kullanımı cezalandırma)
    const cost = currentLevel <= 3 ? 50 : 25;

    setGameState(prev => ({
      ...prev,
      hintsUsed: prev.hintsUsed + 1,
      score: Math.max(0, prev.score - cost),
      hintProgress: { ...prev.hintProgress, [puzzleId]: currentLevel },
    }));

    const answer = puzzle.answer;

    // Kademeli ipucu metni — SINIR YOK, giderek netleşir
    if (currentLevel === 1) {
      // 1. İpucu: Yüzeysel yönlendirici — kelime sınırından kes (yarıda kırpma!)
      const words = puzzle.hint.split(' ');
      const halfWordCount = Math.max(1, Math.ceil(words.length / 2));
      const surface = words.slice(0, halfWordCount).join(' ');
      return `${surface}… (Daha fazlası için tekrar ipucu iste)`;
    } else if (currentLevel === 2) {
      // 2. İpucu: Tam ipucu metni
      return `${puzzle.hint}`;
    } else if (currentLevel === 3) {
      // 3. İpucu: Tam ipucu + hangi kanal ile çözülebileceği
      const channel = puzzle.type === 'logic' || puzzle.type === 'riddle'
        ? 'Şüphelileri sorgulayarak veya kanıtları inceleyerek'
        : 'Bulmacayı dikkatlice okuyarak';
      return `${puzzle.hint} — ${channel} bu bilgiye ulaşabilirsin.`;
    } else if (currentLevel === 4) {
      // 4. İpucu: Çok daha net — cevap uzunluğu ve ilk harf
      const firstChar = answer.charAt(0);
      return `Cevap ${answer.length} harfli bir kelime ve "${firstChar}" harfi ile başlıyor. ${puzzle.hint}`;
    } else if (currentLevel === 5) {
      // 5. İpucu: İlk 2 harf + son harf
      const start = answer.slice(0, 2);
      const end = answer.charAt(answer.length - 1);
      const masked = start + '*'.repeat(Math.max(0, answer.length - 3)) + end;
      return `Cevap: "${masked}" — ${answer.length} karakter. İlk harfler "${start}", son harf "${end}".`;
    } else if (currentLevel === 6) {
      // 6. İpucu: Cevabın yarısını göster
      const halfLen = Math.ceil(answer.length / 2);
      const revealed = answer.slice(0, halfLen) + '*'.repeat(answer.length - halfLen);
      return `Neredeyse tamam: "${revealed}" — gerisi sende.`;
    } else {
      // 7+: Cevabı neredeyse tamamen ver (sadece 1 harf gizli)
      const hideIdx = Math.max(1, Math.floor(answer.length / 2));
      const almostFull = answer.slice(0, hideIdx) + '_' + answer.slice(hideIdx + 1);
      return `Son yardım: "${almostFull}" — eksik harfi tamamla!`;
    }
  }, [currentCase, gameState.hintProgress]);

  const makeAccusation = useCallback(async (characterId: string, evidenceIds: string[]) => {
    if (!currentCase) return { correct: false, message: 'Vaka yok.' };

    setIsLoading(true);
    setLoadingMessage('Kanıtlar değerlendiriliyor...');

    try {
      const cleanCase = stripImagesFromCase(currentCase);
      const result = await evaluateAccusationAction(cleanCase, characterId, evidenceIds);
      const suspect = currentCase.characters.find(c => c.id === characterId);

      setConfrontationResult({ ...result, suspect });

      if (result.isCorrect && suspect) {
        const finalScore = Math.max(100,
          Math.floor(gameState.score + (1000 * (result.scoreModifier || 1.0)))
          - (gameState.accusationCount * 200)
          - (gameState.hintsUsed * 50)
        );

        setGameState(prev => ({
          ...prev,
          solvedCaseIds: [...prev.solvedCaseIds, currentCase.id],
          score: finalScore,
          accusationCount: prev.accusationCount + 1,
        }));

        // ── CACHE: Oynanan vakayı listeye ekle ─────────────────────────────────
        setPlayedCaseIds(prev => {
          const updated = [...prev, currentCase.id];
          localStorage.setItem('dedektif_played_cases_v2', JSON.stringify(updated));
          return updated;
        });

        return { correct: true, result };
      } else {
        setGameState(prev => ({
          ...prev,
          accusationCount: prev.accusationCount + 1,
          score: Math.max(0, prev.score - 300),
        }));

        return { correct: false, result };
      }
    } catch (error) {
      console.error("Accusation Error:", error);
      return { correct: false, message: 'Bir hata oluştu.' };
    } finally {
      setIsLoading(false);
    }
  }, [currentCase, gameState]);

  // ── Hardcore Gizem: Bağlamsal Akıllı Yardım ──────────────────────────────────
  const getSmartHint = useCallback((): {
    type: 'scene' | 'interrogation' | 'puzzle' | 'none';
    message: string;
    targetId?: string;
  } => {
    if (!currentCase) return { type: 'none', message: 'Aktif bir soruşturma yok.' };

    // Genel smart hint için ayrı bir progress key kullan: "smart_hint_global"
    const SMART_KEY = 'smart_hint_global';
    const currentLevel = (gameState.hintProgress[SMART_KEY] || 0) + 1;
    const cost = currentLevel <= 3 ? 50 : 25;

    const updateHintState = () => {
      setGameState(prev => ({
        ...prev,
        hintsUsed: prev.hintsUsed + 1,
        score: Math.max(0, prev.score - cost),
        hintProgress: { ...prev.hintProgress, [SMART_KEY]: currentLevel },
      }));
    };

    // Öncelik belirleme: Her kategoriden en acil olanı bul
    const unscannedSceneEvidence = currentCase.evidence.find(ev =>
      !ev.isFound &&
      !ev.isHidden &&
      ev.interactiveObjects && ev.interactiveObjects.length > 0 &&
      !currentCase.puzzles.some(p => p.unlocksEvidenceId === ev.id && !p.isSolved)
    );
    const unsolvedPuzzle = currentCase.puzzles.find(p => !p.isSolved);
    const leastInterrogated = currentCase.characters
      .map(c => ({ char: c, count: (gameState.interrogationHistory[c.id] || []).length / 2 }))
      .sort((a, b) => a.count - b.count)[0];

    // Her ipucu isteğinde konuya özel sayaç kullan (aynı konuda takılırsa artan netlik)
    // Farklı konuya geçince o konunun sayacı sıfırdan başlar
    const getTopicKey = (prefix: string, id?: string) => `smart_${prefix}_${id || 'general'}`;

    // 1. Öncelik: Taranmamış sahne
    if (unscannedSceneEvidence) {
      const topicKey = getTopicKey('scene', unscannedSceneEvidence.id);
      const topicLevel = (gameState.hintProgress[topicKey] || 0) + 1;

      setGameState(prev => ({
        ...prev,
        hintsUsed: prev.hintsUsed + 1,
        score: Math.max(0, prev.score - cost),
        hintProgress: { ...prev.hintProgress, [SMART_KEY]: currentLevel, [topicKey]: topicLevel },
      }));

      if (topicLevel <= 3) {
        const msgs = [
          `Olay yerinin bazı köşeleri hâlâ incelenmedi. Belki bir şeyler gözden kaçırdın.`,
          `${unscannedSceneEvidence.location} bölgesinde henüz keşfedilmemiş izler var. Sahneye gir ve nesneleri incele.`,
          `${unscannedSceneEvidence.location} sahnesinde dikkatle bak — özellikle farklı nesnelere tıkla.`,
        ];
        return { type: 'scene' as const, message: msgs[topicLevel - 1], targetId: unscannedSceneEvidence.id };
      } else {
        // 4+ net ipucu: doğrudan nesne ve konum
        const obj = unscannedSceneEvidence.interactiveObjects?.[0];
        return {
          type: 'scene' as const,
          message: `"${unscannedSceneEvidence.location}" sahnesine gir — ${obj ? `"${obj.label}" nesnesini` : 'dikkat çekici nesneleri'} incele. Orada önemli bir kanıt gizli.`,
          targetId: unscannedSceneEvidence.id,
        };
      }
    }

    // 2. Öncelik: Çözülmemiş bulmaca
    if (unsolvedPuzzle) {
      const topicKey = getTopicKey('puzzle', unsolvedPuzzle.id);
      const topicLevel = (gameState.hintProgress[topicKey] || 0) + 1;

      setGameState(prev => ({
        ...prev,
        hintsUsed: prev.hintsUsed + 1,
        score: Math.max(0, prev.score - cost),
        hintProgress: { ...prev.hintProgress, [SMART_KEY]: currentLevel, [topicKey]: topicLevel },
      }));

      if (topicLevel <= 3) {
        const msgs = [
          `Bulmacalar sekmesinde bekleyen bir şey var. Belki oraya bakmalısın.`,
          `"${unsolvedPuzzle.title}" bulmacası henüz çözülmedi. Çözersen yeni bir kanıta ulaşabilirsin.`,
          `"${unsolvedPuzzle.title}" — Tip: ${unsolvedPuzzle.type}. Bulmaca sayfasındaki ipucu butonunu dene.`,
        ];
        return { type: 'puzzle' as const, message: msgs[topicLevel - 1], targetId: unsolvedPuzzle.id };
      } else {
        return {
          type: 'puzzle' as const,
          message: `"${unsolvedPuzzle.title}" bulmacasında takıldıysan, bulmaca sayfasından "İpucu Al" butonuna birkaç kez bas — her seferinde daha net bir ipucu alacaksın.`,
          targetId: unsolvedPuzzle.id,
        };
      }
    }

    // 3. Öncelik: Az sorgulanmış şüpheli
    if (leastInterrogated && leastInterrogated.count < 3) {
      const topicKey = getTopicKey('interrogation', leastInterrogated.char.id);
      const topicLevel = (gameState.hintProgress[topicKey] || 0) + 1;

      setGameState(prev => ({
        ...prev,
        hintsUsed: prev.hintsUsed + 1,
        score: Math.max(0, prev.score - cost),
        hintProgress: { ...prev.hintProgress, [SMART_KEY]: currentLevel, [topicKey]: topicLevel },
      }));

      if (topicLevel <= 3) {
        const msgs = [
          `Bazı şüphelilerle yeterince konuşulmadı. Sorgu odası kritik bilgiler içerebilir.`,
          `${leastInterrogated.char.name} ile daha fazla konuşman gerekiyor. Alibisini ve motifini daha derinlemesine sorgula.`,
          `${leastInterrogated.char.name} — alibisi hakkında doğrudan sorular sor. Baskı uygularsan bilgi sızabilir.`,
        ];
        return { type: 'interrogation' as const, message: msgs[topicLevel - 1], targetId: leastInterrogated.char.id };
      } else {
        return {
          type: 'interrogation' as const,
          message: `${leastInterrogated.char.name}'e "${leastInterrogated.char.motive ? 'motifini' : 'alibisini'}" sorgula. Çelişkileri yakalayıp vurgula — köşeye sıkışınca ağzından kaçırabilir.`,
          targetId: leastInterrogated.char.id,
        };
      }
    }

    // 4. Genel yönlendirme (sınır yok)
    updateHintState();
    const generalMsgs = [
      'Tüm fiziksel kanıtları topladın gibi görünüyor. Şüphelilerin çapraz ifadelerini karşılaştır — biri yalan söylüyor.',
      'Şüphelilerin alibilerini birbirleriyle karşılaştır. Zaman çizelgesinde bir çelişki var.',
      'Kanıtlardaki ipucu metinlerini dikkatle oku — birden fazla kanıt aynı kişiyi işaret ediyor olabilir.',
      'Otopsi raporlarını katman katman incelediysen, sorgu odasında baskıyı artır. Gerçek katil basınç altında çatlayacak.',
    ];
    return {
      type: 'interrogation' as const,
      message: generalMsgs[Math.min(currentLevel - 1, generalMsgs.length - 1)],
    };
  }, [currentCase, gameState.interrogationHistory, gameState.hintProgress]);

  const exitCase = useCallback(async () => {
    setCurrentCase(null);
    setCaseResolution(null);
    setGameState(INITIAL_GAME_STATE);
  }, []);

  const clearStorage = useCallback(async () => {
    await clearCaseFromDB();
    localStorage.removeItem('dedektif_game_state_v2');
    localStorage.removeItem('dedektif_played_cases_v2'); // Oynananları da temizle
    setPlayedCaseIds([]);
    setHasSavedGame(false);
  }, []);

  return (
    <GameContext.Provider value={{
      currentCase,
      gameState,
      isLoading,
      isInterrogating,
      error,
      caseResolution,
      setCaseResolution,
      startNewCase,
      solvePuzzle,
      findEvidence,
      interrogate,
      makeAccusation,
      confrontationResult,
      clearConfrontation,
      setSuspicionLevel,
      addNotebookEntry,
      useHint,
      exitCase,
      clearStorage,
      hasSavedGame,
      loadSavedGame,
      revealInteractiveObject,
      isObjectRevealed,
      generationProgress,
      loadingMessage,
      notification,
      showNotification,
      startDemoCase,
      getSmartHint,
      lastActivityTime,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}

// Alias — GameView ve diğer feature dosyaları bu isimle kullanabilir
export const useGame = useGameContext;

function normalizeCase(caseData: Case): Case {
  return {
    ...caseData,
    chapters: caseData.chapters || [],
    evidence: (caseData.evidence || []).map(ev => ({
      ...ev,
      interactiveObjects: (ev.interactiveObjects || []).map(obj => ({
        ...obj,
        isRevealed: obj.isRevealed ?? false,
      })),
    })),
    puzzles: (caseData.puzzles || []).map(p => ({
      ...p,
      interactiveObjects: p.interactiveObjects || [],
    })),
  };
}