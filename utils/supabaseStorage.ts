import { getSupabaseAdmin } from '@/lib/supabase';
import sharp from 'sharp';

/**
 * Verilen görsel URL'ini indirir, WebP formatına sıkıştırır ve Supabase Storage'a yükler.
 * Zaten host edilmiş görselleri (Supabase URL) tespit eder ve atlar.
 * @param imageUrl Gemini/Imagen/Supabase görsel URL'i
 * @param caseId Vaka ID'si (klasörleme için)
 * @param fileName Kaydedilecek dosya adı
 * @returns Supabase Storage üzerindeki halka açık URL
 */
export async function processAndUploadImage(
  imageUrl: string,
  caseId: string,
  fileName: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const bucketName = 'case-images';
    const filePath = `${caseId}/${fileName}.webp`;

    // --- OPTİMİZASYON: Zaten bu vaka için host edilmişse atla (Redundant Upload Fix) ---
    if (imageUrl.includes(`storage/v1/object/public/${bucketName}/${caseId}`)) {
      console.log(`⏭️ [IMAGE PERSIST] Görsel zaten host edilmiş, atlanıyor: ${fileName}`);
      return imageUrl;
    }

    // 1. Görseli indir
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`⚠️ [IMAGE SKIP] Görsel indirilemedi (${response.statusText}): ${imageUrl}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 2. Sharp ile WebP'ye dönüştür ve sıkıştır
    const optimizedBuffer = await sharp(inputBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // 3. Supabase Storage'a yükle
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 4. Public URL'i al
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    console.log(`🖼️ [IMAGE PERSIST] Görsel optimize edildi ve yüklendi: ${fileName}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`Görsel işleme hatası (${fileName}):`, error);
    return null;
  }
}

/**
 * Bir vakanın tüm görsellerini işleyip Supabase Storage'a yüklemek için yardımcı fonksiyon.
 */
export async function uploadAllCaseImages(caseId: string, imageTasks: { url: string; name: string }[]): Promise<Record<string, string>> {
  const urlMap: Record<string, string> = {};
  
  // 3'erli gruplar halinde paralel işle
  const chunkSize = 3;
  for (let i = 0; i < imageTasks.length; i += chunkSize) {
    const chunk = imageTasks.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (task) => {
        const publicUrl = await processAndUploadImage(task.url, caseId, task.name);
        if (publicUrl) {
          urlMap[task.url] = publicUrl;
        }
      })
    );
  }
  
  return urlMap;
}
