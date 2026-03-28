export type CaseStatus = 'active' | 'solved' | 'failed';

// ─── InteractiveObject ────────────────────────────────────────────────────────
// Bir sahnede tıklanabilir/incelenebilir nesneleri temsil eder.
// x ve y değerleri 0-100 arasında YÜZDE bazlıdır — görsel boyutundan bağımsız.
export interface InteractiveObject {
  id: string;
  label: string;                  // Kısa nesne adı, örn: "Halı", "Kasa", "Mektup"
  x: number;                      // Yatay konum, 0-100 (yüzde)
  y: number;                      // Dikey konum, 0-100 (yüzde)
  revealText: string;             // Tıklanınca gösterilecek Türkçe atmosferik metin
  icon: string;                   // Emoji ile temsil, örn: "🔑", "📜", "🗄️"
  isRevealed: boolean;            // Oyuncu bu nesneyi keşfetti mi?
  linkedEvidenceId?: string;      // Bu nesne hangi kanıtı açıyor (opsiyonel)
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  backstory: string;
  alibi: string;
  motive: string;
  age: number;
  profession: string;
  address: string;
  relationToVictim: string;
  isKiller: boolean;
  imagePrompt: string;
  generatedImageUrl?: string;
  suspicionLevel?: number; // 0-100, set by player
}

export interface Evidence {
  id: string;
  title: string;
  description: string;
  imagePrompt: string;
  generatedImageUrl?: string;
  isFound: boolean;
  location: string;
  locationDescription: string;
  linkedCharacterId?: string;
  clueText: string;
  foundAt?: string;
  // ── YENİ: İnteraktif sahne nesneleri ─────────────────────────────────────
  interactiveObjects?: InteractiveObject[]; // Sahnedeki tıklanabilir nesneler
  sceneImagePrompt?: string;               // Sahnenin tamamı için ayrı görsel prompt
  sceneImageUrl?: string;                  // Üretilen sahne görseli (IndexedDB'de)
  isHidden?: boolean;                      // ── YENİ: Sadece sorguyla açılan gizli kanıt mı?
}

export interface Puzzle {
  id: string;
  type: 'riddle' | 'code' | 'cipher' | 'logic' | 'image' | 'sequence';
  title: string;
  question: string;
  answer: string;
  hint: string;
  isSolved: boolean;
  imagePrompt?: string;
  generatedImageUrl?: string;
  unlocksEvidenceId?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  // ── YENİ: Bulmaca sahnesi için interaktif nesneler ────────────────────────
  interactiveObjects?: InteractiveObject[]; // Bulmaca görselindeki ipucu nesneleri
}

export interface CaseChapter {
  id: string;
  title: string;
  content: string;
  imagePrompt: string;
  generatedImageUrl?: string;
  isUnlocked: boolean;
  unlocksAfterEvidenceCount: number;
}

export interface Case {
  id: string;
  title: string;
  introduction: string;
  fullStory: string;
  chapters: CaseChapter[];
  theme: string;
  setting: string;
  victim: {
    name: string;
    age: number;
    profession: string;
    description: string;
    imagePrompt: string;
    generatedImageUrl?: string;
  };
  characters: Character[];
  evidence: Evidence[];
  puzzles: Puzzle[];
  imagePrompt: string;
  generatedImageUrl?: string;
  timeOfDeath: string;
  causeOfDeath: string;
  crimeScene: string;
  difficultyRating: number; // 1-5
}

export interface GameState {
  currentCaseId: string | null;
  solvedCaseIds: string[];
  unlockedClueIds: string[];
  foundEvidenceIds: string[];
  interrogationHistory: Record<string, { role: 'user' | 'model'; message: string }[]>;
  accusationCount: number;
  score: number;
  hintsUsed: number;
  timeStarted: string;
  suspicionLevels: Record<string, number>;
  notebookEntries: string[];
  discoveredChapterIds: string[];
  puzzleAttempts: Record<string, number>;
  // ── YENİ: İnteraktif nesne takibi ────────────────────────────────────────
  revealedObjectIds: string[]; // "evidenceId:objectId" formatında
}