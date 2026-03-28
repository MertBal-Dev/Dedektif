import { Case } from "@/types/game";

/**
 * Generates an image using Gemini's Imagen or Multimodal (Banana) models.
 * Supports both :predict (Imagen) and :generateContent (Gemini-Multimodal) endpoints.
 * Returns a base64 Data URL.
 */
async function generateGeminiImage(prompt: string, modelId: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    console.warn("⚠️ GEMINI_KEY bulunamadı, Imagen kullanılamıyor.");
    return null;
  }

  // Model tipini ve metodunu belirle
  const isMultimodal = modelId.includes("gemini") || modelId.includes("banana");
  const method = isMultimodal ? "generateContent" : "predict";
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:${method}?key=${apiKey}`;

  let body: any;
  if (method === "predict") {
    // --- IMAGEN (PREDICT) FORMATI ---
    body = {
      instances: [{ 
        prompt: `${prompt}, hyper-realistic photography, 8k resolution, cinematic lighting, natural skin textures, 35mm lens, film noir atmosphere, detailed facial features` 
      }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        outputMimeType: "image/webp"
      }
    };
  } else {
    // --- GEMINI MULTIMODAL (GENERATECONTENT) FORMATI ---
    body = {
      contents: [{
        parts: [{ 
          text: `Generate a high-quality, professional image: ${prompt}, hyper-realistic photography, cinematic lighting, film noir atmosphere.` 
        }]
      }],
      generationConfig: {
        // Multimodal image generation için özel parametreler (gerekirse burası modele göre değişebilir)
        candidateCount: 1,
      }
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`⚠️ Gemini ${modelId} failed (${response.status}):`, JSON.stringify(errorData));
      return null;
    }

    const data = await response.json();
    
    // --- RESPONS PARSING ---
    if (method === "predict") {
      // Imagen formatı: predictions[0].bytesBase64Encoded
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        console.log(`🎨 Generated image via Gemini Imagen (${modelId})`);
        return `data:image/webp;base64,${data.predictions[0].bytesBase64Encoded}`;
      }
    } else {
      // Gemini formatı: candidates[0].content.parts[0].inline_data.data (genelde blob döner)
      // Veya bazı preview modellerde farklı olabilir, en yaygın olanı kontrol et:
      const part = data.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        console.log(`🎨 Generated image via Gemini Multimodal (${modelId})`);
        return `data:${part.inlineData.mimeType || 'image/webp'};base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error(`❌ Gemini Image generation (${modelId}) failed:`, error);
  }
  return null;
}

/**
 * Generates a Pollinations image URL.
 */
async function generatePollinationsImage(prompt: string, useKey: boolean = true): Promise<string | null> {
  try {
    const fullPrompt = `${prompt}, movie still, highly detailed, dramatic lighting, detective noir atmosphere`;
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    const model = "zimage";

    const apiKey = useKey ? process.env.POLLINATIONS_API_KEY : null;

    let imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}&width=800&height=800&seed=${seed}`;
    if (apiKey) imageUrl += `&key=${apiKey}`;

    console.log(`🎨 Pollinations URL (${useKey ? 'Keyed' : 'Free'}): ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error("❌ Pollinations URL creation failed:", error);
    return null;
  }
}

/**
 * Main image generation entry point with Multi-Model Retry logic.
 * Optimized for 2026: Min Cost, Max Quality.
 */
export async function generateImage(prompt: string): Promise<string | null> {
  // ── Fiyat/Performans ve Kota Odaklı Sıralama (Best to Fallback) ────────────────
  const geminiModels = [
    "imagen-4.0-fast-generate-001",       // Imagen 4 Fast (Hızlı ve kaliteli)
    "gemini-2.5-flash-image",             // Nano Banana (En yüksek kota/hız)
    "gemini-3.1-flash-image-preview",     // Nano Banana 2 (Yeni nesil denge)
    "imagen-4.0-generate-001",            // Imagen 4 (Yüksek kalite)
    "gemini-3-pro-image-preview",         // Nano Banana Pro (Üstün kalite)
    "imagen-4.0-ultra-generate-001",      // Imagen 4 Ultra (En üst kalite, düşük kota)
    "nano-banana-pro-preview",            // Alternatif Pro (Son çare Gemini)
    "imagen-3.0-fast-generate-001",       // Eski nesil hızlı
    "imagen-3.0-generate-001"             // Eski nesil standart
  ];

  for (const modelId of geminiModels) {
    // API URL için 'models/' prefix'ini ekle (eğer yoksa)
    const fullModelId = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
    const img = await generateGeminiImage(prompt, fullModelId);
    if (img) return img;
    // Rate limit yememek için başarısız denemeler arası küçük bekleme
    await wait(300);
  }

  // ── Ücretli Gemini Modelleri Tükenirse Fallback ────────────────────────────
  console.log("🔄 All Gemini models failed or hit quota. Falling back to Pollinations Keyed Tier...");
  const keyedPollinations = await generatePollinationsImage(prompt, true);
  if (keyedPollinations) return keyedPollinations;

  console.log("⚠️ Keyed Pollinations also failed. Last resort: Pollinations FREE.");
  return await generatePollinationsImage(prompt, false);
}

/**
 * Helper to delay between sequential requests to avoid Rate Limits (429).
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates images for all assets of a case in SEQUENTIAL order.
 * ── YENİ: Her evidence için sceneImageUrl de üretilir (sceneImagePrompt varsa).
 */
/**
 * Generates images for all assets of a case in SEQUENTIAL order with progress reporting.
 */
export async function generateCaseImages(
  caseData: Case,
  onProgress?: (percent: number) => void
): Promise<Case> {
  console.log(`🖼️ Starting SEQUENTIAL image generation for case: "${caseData.title}"`);

  const updated = { ...caseData };
  let currentStep = 0;

  // Toplam beklenen görsel sayısını hesapla (Yaklaşık 25)
  const totalSteps =
    1 + // Main
    (caseData.victim ? 1 : 0) +
    (caseData.characters?.length || 0) +
    (caseData.evidence?.reduce((acc, ev) => acc + (ev.sceneImagePrompt ? 2 : 1), 0) || 0) +
    (caseData.chapters?.length || 0) +
    (caseData.puzzles?.reduce((acc, p) => acc + (p.imagePrompt ? 1 : 0), 0) || 0);

  const updateProgress = () => {
    currentStep++;
    if (onProgress) {
      const percent = Math.min(Math.round((currentStep / totalSteps) * 100), 100);
      onProgress(percent);
    }
  };

  // 1. Main Case Image
  updated.generatedImageUrl = (await generateImage(caseData.imagePrompt)) || undefined;
  updateProgress();
  await wait(500);

  // 2. Victim
  if (caseData.victim?.imagePrompt) {
    const victimImg = await generateImage(caseData.victim.imagePrompt);
    if (victimImg && updated.victim) updated.victim.generatedImageUrl = victimImg;
    updateProgress();
    await wait(500);
  }

  // 3. Characters
  if (caseData.characters) {
    for (let i = 0; i < caseData.characters.length; i++) {
      const img = await generateImage(caseData.characters[i].imagePrompt);
      updated.characters[i].generatedImageUrl = img || undefined;
      updateProgress();
      await wait(500);
    }
  }

  // 4. Evidence — kanıt görseli + sahne görseli
  if (caseData.evidence) {
    for (let i = 0; i < caseData.evidence.length; i++) {
      // 4a. Kanıt objesi görseli (imagePrompt)
      const evidenceImg = await generateImage(caseData.evidence[i].imagePrompt);
      updated.evidence[i].generatedImageUrl = evidenceImg || undefined;
      updateProgress();
      await wait(500);

      // 4b. Sahne görseli (sceneImagePrompt)
      if (caseData.evidence[i].sceneImagePrompt) {
        const sceneImg = await generateImage(caseData.evidence[i].sceneImagePrompt!);
        updated.evidence[i].sceneImageUrl = sceneImg || undefined;
        updateProgress();
        await wait(500);
      }
    }
  }

  // 5. Chapters
  if (caseData.chapters) {
    for (let i = 0; i < caseData.chapters.length; i++) {
      const img = await generateImage(caseData.chapters[i].imagePrompt);
      updated.chapters[i].generatedImageUrl = img || undefined;
      updateProgress();
      await wait(500);
    }
  }

  // 6. Puzzles
  if (caseData.puzzles) {
    for (let i = 0; i < caseData.puzzles.length; i++) {
      if (caseData.puzzles[i].imagePrompt) {
        const img = await generateImage(caseData.puzzles[i].imagePrompt!);
        updated.puzzles[i].generatedImageUrl = img || undefined;
        updateProgress();
        await wait(500);
      }
    }
  }

  if (onProgress) onProgress(100);
  console.log(`✅ All images for case "${caseData.title}" have been successfully generated.`);
  return updated;
}