'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Case, GameState, Character } from '@/types/game';
import {
  generateBaseCaseAction,
  generateSingleImageAction,
  evaluatePuzzleAction,
  evaluateAccusationAction
} from '@/app/actions/game';
import { interrogateSuspectAction } from '@/app/actions/interrogate';

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
  // ── YENİ ──────────────────────────────────────────────────────────────────
  revealedObjectIds: [], // "evidenceId:objectId" formatında tutulan keşfedilmiş nesneler
  puzzleAttempts: {},
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
  // ── YENİ ──────────────────────────────────────────────────────────────────
  revealInteractiveObject: (evidenceId: string, objectId: string) => void;
  isObjectRevealed: (evidenceId: string, objectId: string) => boolean;
  generationProgress: number;
  loadingMessage: string;
  notification: { type: 'success' | 'info' | 'warning'; text: string } | null;
  showNotification: (type: 'success' | 'info' | 'warning', text: string) => void;
  hasSavedGame: boolean;
  loadSavedGame: () => Promise<void>;
  clearStorage: () => Promise<void>;
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

/**
 * Strips all base64 image data from a Case object before sending to server actions.
 */
function stripImagesFromCase(caseData: Case): Case {
  return {
    ...caseData,
    generatedImageUrl: undefined,
    victim: caseData.victim ? { ...caseData.victim, generatedImageUrl: undefined } : caseData.victim,
    characters: caseData.characters.map(c => ({ ...c, generatedImageUrl: undefined })),
    evidence: caseData.evidence.map(e => ({
      ...e,
      generatedImageUrl: undefined,
      sceneImageUrl: undefined, // ── YENİ: sahne görselini de temizle
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
    setTimeout(() => setNotification(null), 3500);
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

  const clearConfrontation = useCallback(() => {
    setConfrontationResult(null);
  }, []);

  // Detect/Load saved game on mount
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const savedState = localStorage.getItem('dedektif_game_state_v2');
        const savedCase = await loadCaseFromDB();

        if (savedState && savedCase) {
          setHasSavedGame(true);
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

  // Persist game state
  useEffect(() => {
    // SADECE aktif bir vaka varsa kaydet. 
    // Böylece ana menüye dönüldüğünde (currentCase null iken) son geçerli kayıt silinmez.
    if (hasHydrated && currentCase) {
      localStorage.setItem('dedektif_game_state_v2', JSON.stringify(gameState));
      setHasSavedGame(true);
    }
  }, [gameState, hasHydrated, currentCase]);

  // Persist current case
  useEffect(() => {
    if (hasHydrated && currentCase) {
      saveCaseToDB(currentCase).catch(console.warn);
    }
  }, [currentCase, hasHydrated]);

  // Auto-unlock chapters based on found evidence count
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

      setGenerationProgress(10);
      setLoadingMessage(messages[0]);

      // 2. ADIM: İş Listesi Oluştur
      const updatedCase = { ...baseCase };
      const tasks: { type: string; prompt: string; setter: (url: string) => void }[] = [];

      // Ana görsel
      tasks.push({ type: 'main', prompt: baseCase.imagePrompt, setter: (url) => { updatedCase.generatedImageUrl = url; } });

      // Kurban
      if (baseCase.victim) {
        tasks.push({ type: 'victim', prompt: baseCase.victim.imagePrompt, setter: (url) => { if (updatedCase.victim) updatedCase.victim.generatedImageUrl = url; } });
      }

      // Şüpheliler
      baseCase.characters.forEach((char, idx) => {
        tasks.push({ type: 'char', prompt: char.imagePrompt, setter: (url) => { updatedCase.characters[idx].generatedImageUrl = url; } });
      });

      // Kanıtlar (Obje + Sahne)
      baseCase.evidence.forEach((ev, idx) => {
        tasks.push({ type: 'ev-obj', prompt: ev.imagePrompt, setter: (url) => { updatedCase.evidence[idx].generatedImageUrl = url; } });
        if (ev.sceneImagePrompt) {
          tasks.push({ type: 'ev-scene', prompt: ev.sceneImagePrompt, setter: (url) => { updatedCase.evidence[idx].sceneImageUrl = url; } });
        }
      });

      // Bölümler (Chapters)
      baseCase.chapters.forEach((ch, idx) => {
        tasks.push({ type: 'chapter', prompt: ch.imagePrompt, setter: (url) => { updatedCase.chapters[idx].generatedImageUrl = url; } });
      });

      // Bulmacalar
      baseCase.puzzles.forEach((p, idx) => {
        if (p.imagePrompt) {
          tasks.push({ type: 'puzzle', prompt: p.imagePrompt, setter: (url) => { updatedCase.puzzles[idx].generatedImageUrl = url; } });
        }
      });

      // 3. ADIM: Görselleri Sırayla Üret ve İlerlemeyi Güncelle
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const currentProgress = 10 + Math.round(((i + 1) / tasks.length) * 85);
        setGenerationProgress(currentProgress);
        setLoadingMessage(messages[i % messages.length]);

        const imageUrl = await generateSingleImageAction(t.prompt);
        if (imageUrl) t.setter(imageUrl);
      }

      setGenerationProgress(98);
      setLoadingMessage('Kanıt dosyaları mühürleniyor...');

      // 4. ADIM: State Güncelle ve Başlat
      setCurrentCase(updatedCase);
      setGameState({
        ...INITIAL_GAME_STATE,
        currentCaseId: updatedCase.id,
        solvedCaseIds: gameState.solvedCaseIds,
        timeStarted: new Date().toISOString(),
        discoveredChapterIds: updatedCase.chapters?.filter((ch: any) => ch.isUnlocked).map((ch: any) => ch.id) || [],
        revealedObjectIds: [],
        puzzleAttempts: {},
      });

      setGenerationProgress(100);
      setLoadingMessage('Vaka Dosyası Hazır!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Vaka başlatılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }, [gameState.solvedCaseIds]);

  const findEvidence = useCallback((evidenceId: string) => {
    if (!currentCase) return;
    if (gameState.foundEvidenceIds.includes(evidenceId)) return;

    const evidence = currentCase.evidence.find(e => e.id === evidenceId);
    if (!evidence) return;

    const now = new Date().toISOString();

    setCurrentCase(prev => prev ? {
      ...prev,
      evidence: prev.evidence.map(e =>
        e.id === evidenceId ? { ...e, isFound: true, foundAt: now } : e
      ),
    } : prev);

    setGameState(prev => ({
      ...prev,
      foundEvidenceIds: [...prev.foundEvidenceIds, evidenceId],
      score: prev.score + 150,
    }));
  }, [currentCase, gameState.foundEvidenceIds]);

  // ── YENİ: İnteraktif nesne keşfetme ─────────────────────────────────────────
  const revealInteractiveObject = useCallback((evidenceId: string, objectId: string) => {
    if (!currentCase) return;

    const compositeKey = `${evidenceId}:${objectId}`;

    // Zaten keşfedildiyse tekrar işlem yapma
    if (gameState.revealedObjectIds.includes(compositeKey)) return;

    // currentCase içindeki evidence'ı bul ve nesneyi işaretle
    setCurrentCase(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        evidence: prev.evidence.map(ev => {
          if (ev.id !== evidenceId) return ev;
          return {
            ...ev,
            interactiveObjects: (ev.interactiveObjects || []).map(obj =>
              obj.id === objectId ? { ...obj, isRevealed: true } : obj
            ),
          };
        }),
      };
    });

    // Game state'e kaydet ve küçük puan ver
    setGameState(prev => ({
      ...prev,
      revealedObjectIds: [...prev.revealedObjectIds, compositeKey],
      score: prev.score + 25, // Nesne keşfetme puanı
    }));

    // LinkedEvidenceId varsa o kanıtı da bul
    const evidence = currentCase.evidence.find(e => e.id === evidenceId);
    if (evidence?.interactiveObjects) {
      const obj = evidence.interactiveObjects.find(o => o.id === objectId);
      if (obj?.linkedEvidenceId) {
        findEvidence(obj.linkedEvidenceId);
      }
    }
  }, [currentCase, gameState.revealedObjectIds, findEvidence]);

  // ── YENİ: Nesnenin keşfedilip keşfedilmediğini kontrol et ────────────────────
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

      // Deneme sayısını artır
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

        setGameState(prev => ({
          ...prev,
          unlockedClueIds: [...prev.unlockedClueIds, puzzleId],
          score: prev.score + (puzzle.points || 200),
        }));

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
        setGameState(prev => ({
          ...prev,
          unlockedClueIds: [...prev.unlockedClueIds, puzzleId],
          score: prev.score + (puzzle.points || 200),
        }));
        if (puzzle.unlocksEvidenceId) findEvidence(puzzle.unlocksEvidenceId);
      }
      return {
        isCorrect,
        feedback: isCorrect ? 'Doğru! (Basit eşleşme ile doğrulandı)' : 'Yanlış cevap.',
      };
    }
  }, [currentCase, findEvidence]);

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

      const rawResponse = await interrogateSuspectAction(
        currentCase.title,
        currentCase.fullStory,
        cleanCharacter,
        question,
        history.slice(-10)
      );

      // ── YENİ: REVEAL Etiketi Kontrolü ──────────────────────────────────────
      let response = rawResponse;
      const revealMatch = rawResponse.match(/\[REVEAL:(.+?)\]/);
      if (revealMatch) {
        const revealedId = revealMatch[1];
        // Etiketi metinden temizle (opsiyonel, ama daha temiz görünür)
        response = rawResponse.replace(/\[REVEAL:.+?\]/g, '').trim();

        // Eğer bu kanıt zaten bulunmadıysa bul
        if (!gameState.foundEvidenceIds.includes(revealedId)) {
          findEvidence(revealedId);
          showNotification('success', 'Yeni bir ipucu bulundu! Kanıtlar sekmesini incele.');
        }
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

      return response;
    } catch (err: any) {
      console.error('Interrogation failed:', err);
      return null;
    } finally {
      setIsInterrogating(false);
    }
  }, [currentCase, gameState.interrogationHistory, isInterrogating]);

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

    setGameState(prev => ({
      ...prev,
      hintsUsed: prev.hintsUsed + 1,
      score: Math.max(0, prev.score - 50),
    }));

    return puzzle.hint;
  }, [currentCase]);

  const makeAccusation = useCallback(async (characterId: string, evidenceIds: string[]) => {
    if (!currentCase) return { correct: false, message: 'Vaka yok.' };

    setIsLoading(true);
    setLoadingMessage('Kanıtlar değerlendiriliyor...');

    try {
      const cleanCase = stripImagesFromCase(currentCase);
      const result = await evaluateAccusationAction(cleanCase, characterId, evidenceIds);
      const suspect = currentCase.characters.find(c => c.id === characterId);

      // AI sonucunu hafızaya al (UI bunu kullanacak)
      setConfrontationResult({ ...result, suspect });

      if (result.isCorrect && suspect) {
        const finalScore = Math.max(100,
          Math.floor(gameState.score + (1000 * (result.scoreModifier || 1.0)))
          - (gameState.accusationCount * 200)
          - (gameState.hintsUsed * 50)
        );

        // State'i güncelliyoruz ki vaka çözülmüş sayılsın (Arka planda)
        setGameState(prev => ({
          ...prev,
          solvedCaseIds: [...prev.solvedCaseIds, currentCase.id],
          score: finalScore,
          accusationCount: prev.accusationCount + 1,
        }));

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

  const exitCase = useCallback(async () => {
    setCurrentCase(null);
    setCaseResolution(null);
    setGameState(INITIAL_GAME_STATE);
    // Kaydı silmiyoruz, böylece ana ekrandan "Devam Et" denebilir.
  }, []);

  const clearStorage = useCallback(async () => {
    await clearCaseFromDB();
    localStorage.removeItem('dedektif_game_state_v2');
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

// ─── Yardımcı: Eski/eksik vaka verilerini normalize et ────────────────────────
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