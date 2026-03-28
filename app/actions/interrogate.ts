'use server';

import { generateInterrogationResponse } from '@/lib/gemini';
import { Character } from '@/types/game';

/**
 * BUG FIX: Interrogation action.
 *
 * SORUN 1: character.generatedImageUrl base64 görsel verisi içeriyor → 1MB limit aşılıyor.
 * SORUN 2: history dizisi çok uzarsa body limiti aşılıyor.
 * SORUN 3: fullStory çok uzunsa zaten prompt boyutu sorun çıkarıyor —
 *          bu server-side kalıyor, sorun değil; ama character image verisi client'tan geliyor.
 *
 * ÇÖZÜM: generatedImageUrl kesinlikle çıkar, history son 10 mesajla sınırla.
 */
export async function interrogateSuspectAction(
  caseTitle: string,
  fullStory: string,
  character: Character,
  question: string,
  history: { role: 'user' | 'model'; message: string }[]
): Promise<string> {
  // Image verisi asla server action'a gönderilmez
  const cleanCharacter: Omit<Character, 'generatedImageUrl'> & { generatedImageUrl?: undefined } = {
    ...character,
    generatedImageUrl: undefined,
  };

  // History'yi son 10 mesajla sınırla (5 Q&A turu) — context yeterli, body küçük
  const trimmedHistory = history.slice(-10);

  try {
    return await generateInterrogationResponse(
      caseTitle,
      fullStory,
      cleanCharacter as Character,
      question,
      trimmedHistory
    );
  } catch (error) {
    console.error("Interrogation Action Error:", error);
    throw new Error("Şüpheli şu an cevap veremiyor. Lütfen tekrar deneyin.");
  }
}