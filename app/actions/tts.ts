'use server';

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

/**
 * ElevenLabs + Edge TTS Fallback Seslendirme Eylemi
 * Önce en kaliteli sonuç için ElevenLabs'ı dener.
 * Kota dolması veya hata durumunda tamamen ücretsiz Edge TTS'e (Microsoft Neural) geçer.
 */
export async function generateSpeechAction(text: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  // ─── 1. Deneme: ElevenLabs (Yüksek Kalite) ─────────────────────────
  if (apiKey) {
    try {
      const voiceId = "pNInz6obpgDQGcFmaJgB"; // Ücretsiz "Adam" sesi
      const modelId = "eleven_multilingual_v2";

      console.log("[TTS] ElevenLabs deneniyor...");
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        console.log("[TTS] ElevenLabs başarılı.");
        return Buffer.from(arrayBuffer).toString('base64');
      }

      const errorText = await response.text();
      console.warn(`[TTS] ElevenLabs Kotası Dolmuş veya Hata: ${response.status}`, errorText);
    } catch (error) {
      console.error("[TTS] ElevenLabs hatası, Edge TTS'e geçiliyor:", error);
    }
  }

  // ─── 2. Deneme: Edge TTS (Ücretsiz & Sınırsız Fallback) ──────────────
  try {
    console.log("[TTS] Edge TTS (Microsoft Neural) devreye giriyor...");
    const tts = new MsEdgeTTS();

    // Ses kalitesi ve formatını ayarlıyoruz
    await tts.setMetadata('tr-TR-AhmetNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    return await new Promise((resolve, reject) => {
      // ÇÖZÜM: toStream() nesne döner, içinden audioStream'i parçalayarak (destructuring) alıyoruz
      const { audioStream } = tts.toStream(text);
      const chunks: Buffer[] = [];

      // ÇÖZÜM: 'chunk' ve 'error' için TypeScript tiplerini açıkça belirtiyoruz
      audioStream.on("data", (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      });

      audioStream.on("end", () => {
        if (chunks.length === 0) {
          reject(new Error("Edge TTS boş ses döndürdü."));
          return;
        }
        const audioBuffer = Buffer.concat(chunks);
        console.log("[TTS] Edge TTS başarılı.");
        resolve(audioBuffer.toString('base64'));
      });

      audioStream.on("error", (error: Error) => {
        console.error("[TTS] Edge TTS Stream hatası:", error);
        reject(error);
      });
    });

  } catch (error: any) {
    console.error("[TTS] Kritik Hata: Her iki ses servisi de başarısız oldu!", {
      message: error.message,
      stack: error.stack
    });
    throw new Error(`Seslendirme hatası: ${error.message}`);
  }
}