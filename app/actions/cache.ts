'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import { Case } from '@/types/game';
import { uploadAllCaseImages } from '@/utils/supabaseStorage';

/**
 * Belirli bir temada, daha önce oynanmamış (cache'lenmiş) bir vaka getirir.
 */
export async function getAvailableCaseFromCache(theme: string, playedIds: string[] = []): Promise<Case | null> {
  try {
    const supabase = getSupabaseAdmin();

    // ── HER ŞEYİ OKUYABİLEN ID SİSTEMİ ───────────────────────────────────────
    // Artık DB kolon tipi TEXT olduğu için UUID zorunluluğu yok. 
    // playedIds içindeki her şeyi (slug veya uuid) filtre olarak kullanabiliriz.
    const validPlayedIds = (playedIds || []);

    let query = supabase
      .from('cases')
      .select('case_data')
      .eq('theme', theme);

    if (validPlayedIds.length > 0) {
      // Postgres IN operatörü TEXT dizisi ile her türlü stringi arayabilir.
      query = query.not('id', 'in', `(${validPlayedIds.map(id => `"${id}"`).join(',')})`);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('🔍 [CACHE QUERY ERROR]:', JSON.stringify(error, null, 2));
      return null;
    }

    if (data && data.case_data) {
      console.log(`✅ [CACHE HIT] "${data.case_data.title}" arşivden getirildi.`);
      return data.case_data as Case;
    }

    console.log(`❌ [CACHE MISS] "${theme}" için uygun vaka bulunamadı.`);
    return null;
  } catch (err) {
    console.error('❌ [CACHE QUERY CRITICAL]:', err);
    return null;
  }
}

/**
 * Yeni üretilen bir vakayı görselleriyle birlikte arşive (Supabase) kaydeder.
 */
export async function saveNewCaseToCache(caseObject: Case): Promise<boolean> {
  try {
    console.log(`📡 [CACHE SAVE START] ${caseObject.title} için vaka kaydı başlıyor...`);
    const supabase = getSupabaseAdmin();

    // ── HER ŞEYİ OKUYABİLEN ID SİSTEMİ ───────────────────────────────────────
    // DB kolon tipi TEXT olduğu için UUID zorunluluğu kaldırıldı.
    // slug (sanat-dunyasi-katli) veya uuid (550e8...) olduğu gibi kaydedilir.
    const caseId = caseObject.id;

    // 1. İşlenecek görsel listesini hazırla
    const imageTasks: { url: string; name: string }[] = [];
    if (caseObject.generatedImageUrl) imageTasks.push({ url: caseObject.generatedImageUrl, name: 'main' });
    if (caseObject.victim?.generatedImageUrl) imageTasks.push({ url: caseObject.victim.generatedImageUrl, name: 'victim' });
    
    caseObject.characters.forEach((char, idx) => {
      if (char.generatedImageUrl) imageTasks.push({ url: char.generatedImageUrl, name: `char_${idx}` });
    });

    caseObject.evidence.forEach((ev, idx) => {
      if (ev.generatedImageUrl) imageTasks.push({ url: ev.generatedImageUrl, name: `ev_${idx}` });
      if (ev.sceneImageUrl) imageTasks.push({ url: ev.sceneImageUrl, name: `ev_scene_${idx}` });
    });

    caseObject.chapters.forEach((ch, idx) => {
      if (ch.generatedImageUrl) imageTasks.push({ url: ch.generatedImageUrl, name: `chapter_${idx}` });
    });

    caseObject.puzzles.forEach((p, idx) => {
      if (p.generatedImageUrl) imageTasks.push({ url: p.generatedImageUrl, name: `puzzle_${idx}` });
    });

    // 2. Görselleri paralel işleyip Supabase Storage'a aktar (3'erli gruplar halinde)
    const urlMap = await uploadAllCaseImages(caseId, imageTasks);
    
    // 3. Vaka objesini yeni storage URL'leri ile güncelle (Deep Copy)
    const updatedCase = JSON.parse(JSON.stringify(caseObject)) as Case;
    
    if (updatedCase.generatedImageUrl && urlMap[updatedCase.generatedImageUrl]) {
      updatedCase.generatedImageUrl = urlMap[updatedCase.generatedImageUrl];
    }
    if (updatedCase.victim?.generatedImageUrl && urlMap[updatedCase.victim.generatedImageUrl]) {
      updatedCase.victim.generatedImageUrl = urlMap[updatedCase.victim.generatedImageUrl];
    }
    
    updatedCase.characters.forEach((char, idx) => {
      const originalUrl = caseObject.characters[idx].generatedImageUrl;
      if (originalUrl && urlMap[originalUrl]) {
        char.generatedImageUrl = urlMap[originalUrl];
      }
    });

    updatedCase.evidence.forEach((ev, idx) => {
      const originalImgUrl = caseObject.evidence[idx].generatedImageUrl;
      if (originalImgUrl && urlMap[originalImgUrl]) ev.generatedImageUrl = urlMap[originalImgUrl];
      
      const originalSceneUrl = caseObject.evidence[idx].sceneImageUrl;
      if (originalSceneUrl && urlMap[originalSceneUrl]) ev.sceneImageUrl = urlMap[originalSceneUrl];
    });

    updatedCase.chapters.forEach((ch, idx) => {
      const originalUrl = caseObject.chapters[idx].generatedImageUrl;
      if (originalUrl && urlMap[originalUrl]) ch.generatedImageUrl = urlMap[originalUrl];
    });

    updatedCase.puzzles.forEach((p, idx) => {
      const originalUrl = caseObject.puzzles[idx].generatedImageUrl;
      if (originalUrl && urlMap[originalUrl]) p.generatedImageUrl = urlMap[originalUrl];
    });

    console.log(`✅ [CACHE SAVE] Görsel işleme bitti. Yüklenen: ${Object.keys(urlMap).length}/${imageTasks.length}`);

    // 4. Rotasyon Kontrolü (Max 5 vaka kuralı)
    try {
      const { data: existingCases } = await supabase
        .from('cases')
        .select('id')
        .eq('theme', updatedCase.theme)
        .order('created_at', { ascending: true });

      if (existingCases && existingCases.length >= 5) {
        const oldestId = existingCases[0].id;
        console.log(`♻️ [CACHE ROTATION] Tema "${updatedCase.theme}" için 5 vaka doldu. Eskisi siliniyor: ${oldestId}`);
        await supabase.from('cases').delete().eq('id', oldestId);
      }
    } catch (rotErr) {
      console.warn('⚠️ [CACHE ROTATION WARNING]:', rotErr);
    }

    // 5. Yeni vakayı DB'ye kaydet
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ [CACHE SAVE ERROR] SUPABASE_SERVICE_ROLE_KEY eksik!');
      return false;
    }

    const { error: dbError } = await supabase
      .from('cases')
      .upsert({
        id: updatedCase.id,
        theme: updatedCase.theme,
        case_data: updatedCase,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (dbError) {
      console.error('💾 [CACHE SAVE ERROR] Veritabanı hatası:', dbError.message);
      return false;
    }

    console.log(`🚀 [CACHE SAVE SUCCESS] "${updatedCase.title}" başarıyla arşivlendi! [ID: ${updatedCase.id}]`);
    return true;
  } catch (err) {
    console.error('❌ [CACHE SAVE CRITICAL] Beklenmedik hata:', err);
    return false;
  }
}
