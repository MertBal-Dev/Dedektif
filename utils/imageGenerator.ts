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
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        console.log(`🎨 Generated image via Gemini Imagen (${modelId})`);
        return `data:image/webp;base64,${data.predictions[0].bytesBase64Encoded}`;
      }
    } else {
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
 * Helper to delay between sequential requests to avoid Rate Limits (429).
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main image generation entry point with Multi-Model Retry logic.
 * Optimized for 2026: Min Cost, Max Quality.
 */
export async function generateImage(prompt: string): Promise<string | null> {
  const geminiModels = [
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image-preview",
    "nano-banana-pro-preview",
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-generate-001",
    "gemini-3-pro-image-preview",
    "imagen-4.0-ultra-generate-001",
    "imagen-3.0-fast-generate-001",
    "imagen-3.0-generate-001"
  ];

  for (const modelId of geminiModels) {
    const fullModelId = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
    const img = await generateGeminiImage(prompt, fullModelId);
    if (img) return img;
    await wait(300);
  }

  console.log("🔄 All Gemini models failed or hit quota. Falling back to Pollinations Keyed Tier...");
  const keyedPollinations = await generatePollinationsImage(prompt, true);
  if (keyedPollinations) return keyedPollinations;

  console.log("⚠️ Keyed Pollinations also failed. Last resort: Pollinations FREE.");
  return await generatePollinationsImage(prompt, false);
}

// ── YENİ: Paralel İşlem Havuzu (Chunking) YARDIMCISI ────────────────
type Task = () => Promise<void>;

async function processInChunks(tasks: Task[], chunkSize: number) {
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    await Promise.all(chunk.map(task => task()));
    await wait(200); // Havuzlar arası ufak bir nefes
  }
}

/**
 * Generates images for all assets of a case in PARALLEL order with progress reporting.
 */
export async function generateCaseImages(
  caseData: Case,
  onProgress?: (percent: number) => void
): Promise<Case> {
  console.log(`🖼️ Starting PARALLEL image generation for case: "${caseData.title}"`);

  const updated = { ...caseData };
  let currentStep = 0;

  const totalSteps =
    1 +
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

  // 1. TIER 1: Ana ve Kurban Görselleri (Sıralı - Oyuna hızlı giriş için)
  updated.generatedImageUrl = (await generateImage(caseData.imagePrompt)) || undefined;
  updateProgress();

  if (caseData.victim?.imagePrompt) {
    const victimImg = await generateImage(caseData.victim.imagePrompt);
    if (victimImg && updated.victim) updated.victim.generatedImageUrl = victimImg;
    updateProgress();
  }

  // 2. TIER 2: Karakterler, Kanıtlar, Bölümler ve Bulmacalar (Paralel Havuz)
  const backgroundTasks: Task[] = [];

  if (caseData.characters) {
    caseData.characters.forEach((char, i) => {
      backgroundTasks.push(async () => {
        const img = await generateImage(char.imagePrompt);
        updated.characters![i].generatedImageUrl = img || undefined;
        updateProgress();
      });
    });
  }

  if (caseData.evidence) {
    caseData.evidence.forEach((ev, i) => {
      backgroundTasks.push(async () => {
        const evidenceImg = await generateImage(ev.imagePrompt);
        updated.evidence![i].generatedImageUrl = evidenceImg || undefined;
        updateProgress();
      });

      if (ev.sceneImagePrompt) {
        backgroundTasks.push(async () => {
          const sceneImg = await generateImage(ev.sceneImagePrompt!);
          updated.evidence![i].sceneImageUrl = sceneImg || undefined;
          updateProgress();
        });
      }
    });
  }

  if (caseData.chapters) {
    caseData.chapters.forEach((chapter, i) => {
      backgroundTasks.push(async () => {
        const img = await generateImage(chapter.imagePrompt);
        updated.chapters![i].generatedImageUrl = img || undefined;
        updateProgress();
      });
    });
  }

  if (caseData.puzzles) {
    caseData.puzzles.forEach((puzzle, i) => {
      if (puzzle.imagePrompt) {
        backgroundTasks.push(async () => {
          const img = await generateImage(puzzle.imagePrompt!);
          updated.puzzles![i].generatedImageUrl = img || undefined;
          updateProgress();
        });
      }
    });
  }

  console.log(`🚀 Processing ${backgroundTasks.length} secondary images in parallel chunks of 3...`);
  await processInChunks(backgroundTasks, 3);

  if (onProgress) onProgress(100);
  console.log(`✅ All images for case "${caseData.title}" have been successfully generated.`);
  return updated;
}