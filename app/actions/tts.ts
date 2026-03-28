'use server';

/**
 * ElevenLabs Metin Okuma (TTS) Sunucu Eylemi
 * Bu eylem, verilen metni ElevenLabs API'sini kullanarak sese dönüştürür.
 */
export async function generateSpeechAction(text: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY bulunamadı!");
    throw new Error("Seslendirme servisi şu an yapılandırılmamış.");
  }

  // Ücretsiz planda çalışan "Adam" ses kimliği: pNInz6obpgDQGcFmaJgB
  const voiceId = "pNInz6obpgDQGcFmaJgB";
  const modelId = "eleven_multilingual_v2"; // Türkçe için gerekli model

  try {
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
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API Hatası (${response.status}):`, errorText);
      throw new Error(`Ses üretilemedi (${response.status}): ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}
