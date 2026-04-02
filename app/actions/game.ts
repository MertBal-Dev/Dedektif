'use server';

import { generateNewCase, evaluatePuzzleAnswer } from '@/lib/gemini';
import { generateCaseImages } from '@/utils/imageGenerator';
import { Case, Puzzle } from '@/types/game';

/**
 * 1. ADIM: Sadece vaka metin verisini (JSON) oluşturur. Hızlıdır (~5-10 saniye).
 */
export async function generateBaseCaseAction(theme?: string): Promise<Case> {
  const themes = [
    "Noir Gerilim",
    "Osmanlı Gizemi",
    "1950'ler İstanbul",
    "Modern Gerilim",
    "Sanat Dünyası",
    "Konak Dramı",
  ];

  const selectedTheme = theme || themes[Math.floor(Math.random() * themes.length)];

  try {
    return await generateNewCase(selectedTheme);
  } catch (error) {
    console.error("Base Case Generation Error:", error);
    throw new Error("Soruşturma metni hazırlanamadı.");
  }
}

/**
 * 2. ADIM: Tek bir prompt için görsel üretir.
 * ÖNEMLİ: Eğer görsel base64 olarak dönerse (Gemini), bunu HEMEN Supabase'e yükler
 * ve URL döndürür. Böylece 413 Payload Too Large hatası önlenmiş olur.
 */
export async function generateSingleImageAction(prompt: string, caseId?: string): Promise<string | null> {
  try {
    const { generateImage } = await import('@/utils/imageGenerator');
    const result = await generateImage(prompt);
    
    if (!result) return null;

    // Eğer sonuç bir base64 verisi ise (data:image/...)
    if (result.startsWith('data:image')) {
      console.log("♻️ [URL CONVERT] Base64 görsel algılandı, Supabase'e yükleniyor...");
      const { processAndUploadImage } = await import('@/utils/supabaseStorage');
      
      // Geçici bir ID kullan veya varsa vaka ID'sini kullan
      const folderId = caseId || `temp_${Date.now()}`;
      const fileName = `img_${Math.random().toString(36).substring(7)}`;
      
      const publicUrl = await processAndUploadImage(result, folderId, fileName);
      if (publicUrl) {
        console.log("✅ [URL CONVERT] Görsel başarıyla host edildi:", publicUrl);
        return publicUrl;
      }
    }

    return result;
  } catch (error) {
    console.error("Single Image Generation Error:", error);
    return null;
  }
}

/**
 * BUG FIX: Puzzle evaluation action.
 * 
 * SORUN: GameContext'ten gelen puzzle nesnesi içinde `generatedImageUrl`
 * alanı base64 encoded görsel veri içeriyor (data:image/webp;base64,...).
 * Bu veri ~500KB-2MB arasında olabilir ve Next.js Server Action 1MB body limitini aşıyor.
 * 
 * ÇÖZÜM: Sadece AI'ın cevabı değerlendirmesi için gereken metin alanlarını gönder.
 * generatedImageUrl kesinlikle gönderilmez.
 */
export async function evaluatePuzzleAction(
  puzzle: Puzzle,
  answer: string,
  attemptCount: number = 1
): Promise<{ isCorrect: boolean; feedback: string }> {
  // Sadece değerlendirme için gereken metin alanları — görsel VERİSİ HİÇBİR ZAMAN gönderilmez
  const cleanPuzzle = {
    id: puzzle.id,
    type: puzzle.type,
    title: puzzle.title,
    question: puzzle.question,
    answer: puzzle.answer,
    hint: puzzle.hint,
    rewardDescription: puzzle.rewardDescription,
    difficulty: puzzle.difficulty,
    points: puzzle.points,
    unlocksEvidenceId: puzzle.unlocksEvidenceId,
    isSolved: puzzle.isSolved,
    // generatedImageUrl: OMITTED — base64 görsel verisi asla server action'a gönderilmez
    // imagePrompt: OMITTED — gerekmiyor
  };

  try {
    return await evaluatePuzzleAnswer(cleanPuzzle as Puzzle, answer, attemptCount);
  } catch (error) {
    console.error("Evaluate Puzzle Action Error:", error);
    // Fallback: basit string karşılaştırma
    const isCorrect = (cleanPuzzle.answer || '').toLowerCase().trim() === answer.toLowerCase().trim();
    return {
      isCorrect,
      feedback: isCorrect
        ? "Evet! Doğru cevap. Tebrikler dedektif."
        : "Bu doğru değil. Farklı bir açıdan düşünmeye çalış.",
    };
  }
}

/**
 * 3. ADIM: Büyük Yüzleşme (Accusation) Değerlendirmesi
 */
export async function evaluateAccusationAction(
  caseData: Case,
  suspectId: string,
  selectedEvidenceIds: string[]
): Promise<{ 
  isCorrect: boolean; 
  title: string;
  confrontation: string; 
  confession?: string;
  scoreModifier: number;
}> {
  // Görsel verilerini temizle (Next.js server action body limit güvenliği için)
  const cleanCase = {
    ...caseData,
    generatedImageUrl: undefined,
    victim: caseData.victim ? { ...caseData.victim, generatedImageUrl: undefined } : undefined,
    characters: caseData.characters.map(c => ({ ...c, generatedImageUrl: undefined })),
    evidence: caseData.evidence.map(e => ({ ...e, generatedImageUrl: undefined, sceneImageUrl: undefined })),
    puzzles: caseData.puzzles.map(p => ({ ...p, generatedImageUrl: undefined })),
    chapters: (caseData.chapters || []).map(ch => ({ ...ch, generatedImageUrl: undefined })),
  };

  try {
    const { evaluateAccusation } = await import('@/lib/gemini');
    return await evaluateAccusation(cleanCase as Case, suspectId, selectedEvidenceIds);
  } catch (error) {
    console.error("Accusation Action Error:", error);
    const killer = caseData.characters.find(c => c.isKiller);
    const isCorrect = suspectId === killer?.id;
    return {
      isCorrect,
      title: isCorrect ? "Adalet Yerini Buldu" : "Hatalı Tahmin",
      confrontation: isCorrect 
        ? "Katili köşeye sıkıştırdınız! Kanıtlar yanılmaz." 
        : "Bu kişi masum görünüyor. Başka birini araştırmalısınız.",
      scoreModifier: isCorrect ? 1.0 : 0
    };
  }
}