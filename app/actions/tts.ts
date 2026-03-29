'use server';

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import crypto from 'crypto';

// Server-side Memory Cache (Vaka dosyaları sıcakken API maliyetini sıfırlar)
// Not: Serverless ortamlarda (Vercel) bu cache instance kapanana kadar yaşar.
const audioCache = new Map<string, Buffer>();

/**
 * Metni parçalara böler (Paragraf bazlı veya karakter limitli)
 */
function splitTextIntoChunks(text: string, maxChars: number = 800): string[] {
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if ((currentChunk + p).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = p + " ";
    } else {
      currentChunk += p + " ";
    }
  }
  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
  return chunks;
}

/**
 * ElevenLabs + Edge TTS + In-Memory Cache
 */
export async function generateSpeechAction(text: string): Promise<string> {
  if (!text) throw new Error("Metin boş olamaz.");

  // 1. Metinden benzersiz bir hash oluştur (Cache Key)
  const textHash = crypto.createHash('md5').update(text).digest('hex');

  // 2. Hafıza (Memory) Kontrolü
  if (audioCache.has(textHash)) {
    console.log(`✅ [TTS MEMORY CACHE HIT] "${text.slice(0, 20)}..." için hazır ses döndürülüyor.`);
    const cachedBuffer = audioCache.get(textHash)!;
    return cachedBuffer.toString('base64');
  }

  try {
    console.log(`❌ [TTS MEMORY CACHE MISS] Yeni üretim başlıyor...`);

    // 3. Üretim Başlıyor (Chunking Mantığıyla)
    const chunks = splitTextIntoChunks(text);
    console.log(`📦 [TTS] Metin ${chunks.length} parçaya bölündü.`);
    
    const audioBuffers: Buffer[] = [];
    const apiKey = process.env.ELEVENLABS_API_KEY;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🎙️ [TTS] Parça ${i + 1}/${chunks.length} işleniyor...`);
        
        let chunkBuffer: Buffer | null = null;

        // --- ElevenLabs Denemesi ---
        if (apiKey) {
            try {
                const voiceId = "pNInz6obpgDQGcFmaJgB"; // Adam
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'xi-api-key': apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: chunk,
                        model_id: "eleven_multilingual_v2",
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                    }),
                });

                if (response.ok) {
                    chunkBuffer = Buffer.from(await response.arrayBuffer());
                }
            } catch (e) {
                console.warn(`[TTS] ElevenLabs parça ${i} hatası, Edge TTS'e geçiliyor...`);
            }
        }

        // --- Edge TTS Fallback (Eğer ElevenLabs başarısızsa veya yoksa) ---
        if (!chunkBuffer) {
            try {
                const tts = new MsEdgeTTS();
                await tts.setMetadata('tr-TR-AhmetNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
                
                chunkBuffer = await new Promise<Buffer>((resolve, reject) => {
                    const { audioStream } = tts.toStream(chunk);
                    const streamChunks: Buffer[] = [];
                    audioStream.on("data", (c: Buffer) => streamChunks.push(Buffer.from(c)));
                    audioStream.on("end", () => resolve(Buffer.concat(streamChunks)));
                    audioStream.on("error", (e: Error) => reject(e));
                });
            } catch (e: any) {
                console.error(`[TTS] Kritik hata (Parça ${i}):`, e);
            }
        }

        if (chunkBuffer) audioBuffers.push(chunkBuffer);
    }

    if (audioBuffers.length === 0) throw new Error("Hiçbir ses parçası üretilemedi.");

    // 4. Parçaları Birleştir
    const finalBuffer = Buffer.concat(audioBuffers);

    // 5. Hafızaya Kaydet
    audioCache.set(textHash, finalBuffer);
    console.log(`🚀 [TTS MEMORY CACHE SAVE] Ses hafızaya kaydedildi (Toplam: ${audioCache.size} öğe)`);

    return finalBuffer.toString('base64');

  } catch (error: any) {
    console.error("[TTS CRITICAL ERROR]:", error);
    throw new Error(`Sistem şu an seslendirme yapamıyor: ${error.message}`);
  }
}