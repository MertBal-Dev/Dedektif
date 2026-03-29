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

  const clearConfrontation = useCallback(() => {
    setConfrontationResult(null);
  }, []);

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

      // ── YENİ 3. ADIM: PARALEL HAVUZ (CHUNKING) MANTIĞI ───────────────────────
      // Artık görselleri tek tek beklemiyoruz. 3'lü gruplar halinde aynı anda istiyoruz.
      const chunkSize = 3;

      for (let i = 0; i < tasks.length; i += chunkSize) {
        // Sıradaki 3 görevi (chunk) al
        const chunk = tasks.slice(i, i + chunkSize);

        // Progress bar ve yükleme mesajını güncelle
        const completedTasks = Math.min(i + chunkSize, tasks.length);
        const currentProgress = 10 + Math.round((completedTasks / tasks.length) * 85);
        setGenerationProgress(currentProgress);
        setLoadingMessage(messages[Math.floor(i / chunkSize) % messages.length]);

        // Bu 3 görevin hepsini AYNI ANDA server'a gönder ve hepsinin dönmesini bekle
        await Promise.all(
          chunk.map(async (t) => {
            try {
              const imageUrl = await generateSingleImageAction(t.prompt);
              if (imageUrl) t.setter(imageUrl);
            } catch (err) {
              console.error(`Görsel üretilirken hata oluştu (${t.type}):`, err);
            }
          })
        );
      }
      // ─────────────────────────────────────────────────────────────────────────

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
      clearInterval(simulationInterval);
      console.error(err);
      setError(err.message || 'Vaka başlatılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }, [gameState.solvedCaseIds]);

  const startDemoCase = useCallback(() => {
    setIsLoading(true);
    setLoadingMessage('Demo Dosyası Hazırlanıyor...');
    setGenerationProgress(50);

    setTimeout(() => {
      setCurrentCase(MOCK_CASE);
      setGameState({
        ...INITIAL_GAME_STATE,
        currentCaseId: MOCK_CASE.id,
        timeStarted: new Date().toISOString(),
        discoveredChapterIds: MOCK_CASE.chapters.filter(ch => ch.isUnlocked).map(ch => ch.id),
      });
      setIsLoading(false);
      setGenerationProgress(100);
      showNotification('success', 'Demo vaka başlatıldı. İyi testler!');
    }, 1000);
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

    if (obj.linkedEvidenceId) {
      const linkedEv = currentCase.evidence.find(e => e.id === obj.linkedEvidenceId);
      if (linkedEv?.isHidden) {
        return `🔒 Bu nesnede gizli bir ipucu var, ancak önce doğru şüpheliyi sorgulayarak bu bilgiyi açığa çıkarmalısın.`;
      }

      const linkedPuzzle = currentCase.puzzles.find(p => p.unlocksEvidenceId === obj.linkedEvidenceId);
      if (linkedPuzzle && !linkedPuzzle.isSolved) {
        return `🧩 Bu nesne bir bulmacayla kilitli. "${linkedPuzzle.title}" bulmacasını çözersen bu kanıta ulaşabilirsin.`;
      }
    }

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

    if (obj.linkedEvidenceId) {
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

      const rawResponse = await interrogateSuspectAction(
        currentCase.title,
        currentCase.fullStory,
        cleanCharacter,
        question,
        history.slice(-10),
        currentCase.evidence
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
      startDemoCase,
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