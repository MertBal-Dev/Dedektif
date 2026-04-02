import { Case } from "@/types/game";
import { GoogleAuth } from "google-auth-library";

/**
 * Helper to delay between sequential requests.
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * CLEANUP: Removes technical markers like [Kritik Not] or (Emoji) from the prompt
 * so the AI doesn't render them as text.
 */
function cleanImagePrompt(prompt: string): string {
  return prompt
    .replace(/\[.*?\]/g, "") // Removes [ text ]
    .replace(/\(.*?\)/g, "") // Removes ( text )
    .replace(/\"(.*?)\"/g, "$1") // Removes quotes around text
    .replace(/scene must prominently include:/gi, "an atmospheric scene including")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gets a fresh access token for Vertex AI REST calls.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    let keyStr = process.env.GCP_SERVICE_ACCOUNT_KEY || "";
    // Strip potential wrapping quotes
    if (keyStr.startsWith("'") && keyStr.endsWith("'")) keyStr = keyStr.slice(1, -1);
    if (keyStr.startsWith('"') && keyStr.endsWith('"')) keyStr = keyStr.slice(1, -1);

    const credentials = JSON.parse(keyStr);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token || null;
  } catch (error: any) {
    console.error("❌ Auth Token Error:", error.message);
    return null;
  }
}

/**
 * Generates an image using Vertex AI Imagen models via Direct REST API (Predict).
 */
async function generateImagenImage(prompt: string, modelId: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const projectId = process.env.GCP_PROJECT_ID || "";
  const location = process.env.GCP_LOCATION || "us-central1";
  const cleanedPrompt = cleanImagePrompt(prompt);
  
  const predictUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

  const requestBody = {
    instances: [{
      prompt: `${cleanedPrompt}, hyper-realistic photography, high quality, 35mm lens, cinematic lighting, 8k resolution, highly detailed texture, professional color grading`
    }],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1",
      outputMimeType: "image/webp"
    }
  };

  try {
    const response = await fetch(predictUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && data.predictions?.[0]?.bytesBase64Encoded) {
      console.log(`✅ [GENERATE SUCCESS] ${modelId}`);
      return `data:image/webp;base64,${data.predictions[0].bytesBase64Encoded}`;
    } else {
      const msg = data.error?.message || response.statusText || "Unknown Error";
      console.error(`❌ [GENERATE FAIL] ${modelId}: ${msg}`);
      return null;
    }
  } catch (error: any) {
    console.error(`❌ [FETCH ERROR] ${modelId}:`, error.message);
    return null;
  }
}

/**
 * Main image generation entry point with Persistent Retry logic.
 */
export async function generateImage(prompt: string): Promise<string | null> {
  const imagenModels = [
    "imagen-4.0-ultra-generate-001",   // EN KALİTELİ (En başa aldık)
    "imagen-4.0-generate-001",         // Yüksek Kalite
    "imagen-4.0-fast-generate-001",    // Hızlı (Alternatif)
    "imagen-3.0-fast-generate-001",    // Hızlı (Alternatif)
    "imagen-3.0-capability-001"        // Yedek
  ];

  let attempts = 0;
  const maxAttempts = 5; // Prevent infinite loops in case of global GCP outages

  while (attempts < maxAttempts) {
    for (const modelId of imagenModels) {
      console.log(`⏳ [ATTEMPT] ${modelId} (Image: ${prompt.substring(0, 30)}...)`);
      const img = await generateImagenImage(prompt, modelId);
      if (img) return img;
      
      // Delay between model switches
      await wait(1500);
    }
    
    attempts++;
    console.log(`📡 [RETRY] Round ${attempts} failed. All Google models hit. Waiting 3s...`);
    await wait(3000); // Wait 3s before starting a new round of all models
  }

  // FALLBACK: If Google fails 5 whole rounds, try Pollinations
  console.log("🔄 Persistent Google retries failed. Falling back to Pollinations...");
  const encodedPrompt = encodeURIComponent(cleanImagePrompt(prompt));
  return `https://gen.pollinations.ai/image/${encodedPrompt}?model=zimage&width=800&height=800&seed=${Math.floor(Math.random() * 1000000)}&key=${process.env.POLLINATIONS_API_KEY || ""}`;
}

/**
 * Paralel İşlem Havuzu (Chunking) YARDIMCISI
 */
type Task = () => Promise<void>;

async function processInChunks(tasks: Task[], chunkSize: number) {
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    await Promise.all(chunk.map(task => task()));
    await wait(500); 
  }
}

/**
 * Generates images for all assets of a case in chunked order.
 */
export async function generateCaseImages(
  caseData: Case,
  onProgress?: (percent: number) => void
): Promise<Case> {
  console.log(`🖼️ Starting PERSISTENT image generation for case: "${caseData.title}"`);

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

  // TIER 1: Ana Kapak ve Kurban (Sıralı)
  updated.generatedImageUrl = (await generateImage(caseData.imagePrompt)) || undefined;
  updateProgress();

  if (caseData.victim?.imagePrompt) {
    const victimImg = await generateImage(caseData.victim.imagePrompt);
    if (victimImg && updated.victim) updated.victim.generatedImageUrl = victimImg;
    updateProgress();
  }

  // TIER 2: Diğerleri (Chunked Parallel)
  const tasks: Task[] = [];

  if (caseData.characters) {
    caseData.characters.forEach((char, i) => {
      tasks.push(async () => {
        const img = await generateImage(char.imagePrompt);
        updated.characters![i].generatedImageUrl = img || undefined;
        updateProgress();
      });
    });
  }

  if (caseData.evidence) {
    caseData.evidence.forEach((ev, i) => {
      tasks.push(async () => {
        const evidenceImg = await generateImage(ev.imagePrompt);
        updated.evidence![i].generatedImageUrl = evidenceImg || undefined;
        updateProgress();
      });
      if (ev.sceneImagePrompt) {
        tasks.push(async () => {
          const sceneImg = await generateImage(ev.sceneImagePrompt!);
          updated.evidence![i].sceneImageUrl = sceneImg || undefined;
          updateProgress();
        });
      }
    });
  }

  if (caseData.chapters) {
    caseData.chapters.forEach((chapter, i) => {
      tasks.push(async () => {
        const img = await generateImage(chapter.imagePrompt);
        updated.chapters![i].generatedImageUrl = img || undefined;
        updateProgress();
      });
    });
  }

  if (caseData.puzzles) {
    caseData.puzzles.forEach((puzzle, i) => {
      if (puzzle.imagePrompt) {
        tasks.push(async () => {
          const img = await generateImage(puzzle.imagePrompt!);
          updated.puzzles![i].generatedImageUrl = img || undefined;
          updateProgress();
        });
      }
    });
  }

  // 2'şerli gruplar halinde (RPM koruması için)
  await processInChunks(tasks, 2);

  if (onProgress) onProgress(100);
  console.log(`✅ All persistent images for case "${caseData.title}" have been generated.`);
  return updated;
}