'use server';

import { generateInterrogationResponse } from '@/lib/gemini';
import { Character, Evidence } from '@/types/game';

export async function interrogateSuspectAction(
  caseTitle: string,
  fullStory: string,
  character: Character,
  question: string,
  history: { role: 'user' | 'model'; message: string }[],
  evidence: Evidence[] = []
): Promise<string> {
  // Image verisi asla server action'a gönderilmez
  const cleanCharacter: Omit<Character, 'generatedImageUrl'> & { generatedImageUrl?: undefined } = {
    ...character,
    generatedImageUrl: undefined,
  };

  // Kanıt bağlamını oluştur (özellikle gizli olanlar ve ID'leri)
  const evidenceContext = evidence
    .map(e => `- ID: ${e.id}, Title: ${e.title}, Hidden: ${e.isHidden ? 'YES' : 'NO'}`)
    .join('\n');

  // History'yi son 10 mesajla sınırla (5 Q&A turu) — context yeterli, body küçük
  const trimmedHistory = history.slice(-10);

  try {
    return await generateInterrogationResponse(
      caseTitle,
      fullStory,
      cleanCharacter as Character,
      question,
      trimmedHistory,
      evidenceContext
    );
  } catch (error) {
    console.error("Interrogation Action Error:", error);
    throw new Error("Şüpheli şu an cevap veremiyor. Lütfen tekrar deneyin.");
  }
}