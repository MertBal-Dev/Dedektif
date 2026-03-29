'use server';

import { generateInterrogationResponse } from '@/lib/gemini';
import { Character, Evidence } from '@/types/game';

/**
 * Şüpheli sorgulama server action.
 * Vercel 4.5MB Payload limitine takılmaması için image verileri CLIENT TARAFINDA temizlenmiş olmalıdır.
 * Ayrıca burada da ek güvenlik önlemleri alınır.
 */
export async function interrogateSuspectAction(
  caseTitle: string,
  fullStory: string,
  character: Character,
  question: string,
  history: { role: 'user' | 'model'; message: string }[],
  evidence: Evidence[] = []
): Promise<string> {
  // 1. Görsel verileri asla server action'a gönderilmemeli/işlenmemeli
  const cleanCharacter: Character = {
    ...character,
    generatedImageUrl: undefined,
  };

  // 2. Kanıt bağlamını sadece metin olarak derle (Body küçültme)
  const evidenceContext = (evidence || [])
    .map(e => `- ID: ${e.id}, Title: ${e.title}, Hidden: ${e.isHidden ? 'YES' : 'NO'}`)
    .join('\n');

  // 3. History'yi son 10 mesajla sınırla (Context güvenliği ve payload yönetimi)
  const trimmedHistory = (history || []).slice(-10);

  try {
    return await generateInterrogationResponse(
      caseTitle,
      fullStory,
      cleanCharacter,
      question,
      trimmedHistory,
      evidenceContext
    );
  } catch (error) {
    console.error("Interrogation Action Error:", error);
    throw new Error("Şüpheli şu an cevap veremiyor. Lütfen tekrar deneyin.");
  }
}