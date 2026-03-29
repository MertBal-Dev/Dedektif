'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import { Case } from '@/types/game';
import { uploadAllCaseImages } from '@/utils/supabaseStorage';

const CACHE_LIMIT_PER_THEME = 5;

/**
 * Supabase Cache'den kullanıcının daha önce oynamadığı bir vaka getirir.
 */
export async function getAvailableCaseFromCache(theme: string, playedIds: string[]): Promise<Case | null> {
  try {
    const supabase = getSupabaseAdmin();

    console.log(`🔍 [CACHE QUERY] Tema: "${theme}", PlayedIDs: ${JSON.stringify(playedIds)}`);
    
    let query = supabase
      .from('cases')
      .select('case_data')
      .ilike('theme', theme.trim()); // Case-insensitive ve temiz arama

    if (playedIds && playedIds.length > 0) {
      // UUID'ler tırnak içinde gönderilmeli: ("id1","id2")
      const idsForPostgrest = `(${playedIds.map(id => `"${id}"`).join(',')})`;
      query = query.not('id', 'in', idsForPostgrest);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ [CACHE QUERY ERROR]:', JSON.stringify(error, null, 2));
      return null;
    }

    if (data) {
      console.log(`✅ [CACHE HIT] Vaka başarıyla arşivden getirildi.`);
      return data.case_data as unknown as Case;
    } else {
      console.log(`❌ [CACHE MISS] Veritabanında eşleşen vaka bulunamadı.`);
      return null;
    }
  } catch (err) {
    console.error('getAvailableCaseFromCache beklenmedik hata:', err);
    return null;
  }
}

/**
 * Yeni üretilen bir vakayı görselleriyle birlikte Supabase Cache'e kaydeder.
 * Rotasyon mantığını uygular (Her tema için en fazla 5 vaka).
 */
export async function saveNewCaseToCache(caseObject: Case): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const caseId = caseObject.id;

    console.log(`📡 [CACHE SAVE START] ${caseObject.title} için vaka kaydı başlıyor...`);

    // 1. İşlenecek görsel listesini hazırla
    const imageTasks: { url: string; name: string }[] = [];
    if (caseObject.generatedImageUrl) imageTasks.push({ url: caseObject.generatedImageUrl, name: 'main' });
    if (caseObject.victim?.generatedImageUrl) imageTasks.push({ url: caseObject.victim.generatedImageUrl, name: 'victim' });
    
    caseObject.characters.forEach((c, i) => {
      if (c.generatedImageUrl) imageTasks.push({ url: c.generatedImageUrl, name: `char_${i}` });
    });
    
    caseObject.evidence.forEach((e, i) => {
      if (e.generatedImageUrl) imageTasks.push({ url: e.generatedImageUrl, name: `ev_${i}` });
      if (e.sceneImageUrl) imageTasks.push({ url: e.sceneImageUrl, name: `ev_scene_${i}` });
    });

    caseObject.chapters.forEach((ch, i) => {
      if (ch.generatedImageUrl) imageTasks.push({ url: ch.generatedImageUrl, name: `chapter_${i}` });
    });

    caseObject.puzzles.forEach((p, i) => {
      if (p.generatedImageUrl) imageTasks.push({ url: p.generatedImageUrl, name: `puzzle_${i}` });
    });

    console.log(`🖼️ [CACHE SAVE] ${imageTasks.length} adet görsel işlenecek...`);

    // 2. Görselleri paralel olarak WebP'ye çevirip Storage'a yükle
    const urlMap = await uploadAllCaseImages(caseId, imageTasks);
    console.log(`✅ [CACHE SAVE] Görsel işleme bitti. Yüklenen: ${Object.keys(urlMap).length}/${imageTasks.length}`);

    // 3. Vaka verisindeki URL'leri yenileriyle güncelle (Deep Clone ve Update)
    const updatedCase = JSON.parse(JSON.stringify(caseObject)) as Case;
    
    const updateUrl = (oldUrl: string | undefined) => {
      if (oldUrl && urlMap[oldUrl]) return urlMap[oldUrl];
      return oldUrl;
    };

    updatedCase.generatedImageUrl = updateUrl(updatedCase.generatedImageUrl);
    if (updatedCase.victim) updatedCase.victim.generatedImageUrl = updateUrl(updatedCase.victim.generatedImageUrl);
    updatedCase.characters.forEach(c => { c.generatedImageUrl = updateUrl(c.generatedImageUrl); });
    updatedCase.evidence.forEach(e => {
      e.generatedImageUrl = updateUrl(e.generatedImageUrl);
      e.sceneImageUrl = updateUrl(e.sceneImageUrl);
    });
    updatedCase.chapters.forEach(ch => { ch.generatedImageUrl = updateUrl(ch.generatedImageUrl); });
    updatedCase.puzzles.forEach(p => { p.generatedImageUrl = updateUrl(p.generatedImageUrl); });

    // 4. Rotasyon Kontrolü (LRU)
    console.log(`🔄 [CACHE SAVE] Rotasyon kontrolü yapılıyor (${updatedCase.theme})...`);
    const { count } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('theme', updatedCase.theme);

    if (count && count >= CACHE_LIMIT_PER_THEME) {
      console.log(`🧹 [CACHE SAVE] Tema limiti dolmuş (${count}), en eski vaka temizleniyor...`);
      // En eski vakayı bul
      const { data: oldest } = await supabase
        .from('cases')
        .select('id')
        .eq('theme', updatedCase.theme)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (oldest) {
        // Önce Storage'daki klasörünü temizle (Dosyaları listele ve sil)
        const { data: files } = await supabase.storage.from('case-images').list(oldest.id);
        if (files && files.length > 0) {
          await supabase.storage
            .from('case-images')
            .remove(files.map(f => `${oldest.id}/${f.name}`));
        }
        // DB'den sil
        await supabase.from('cases').delete().eq('id', oldest.id);
      }
    }

    // 5. Yeni vakayı DB'ye kaydet (Varsa güncelle, yoksa ekle - Upsert)
    console.log(`💾 [CACHE SAVE] Veritabanına upsert işlemi başlıyor...`);
    const { error: dbError } = await supabase
      .from('cases')
      .upsert({
        id: updatedCase.id,
        theme: updatedCase.theme,
        case_data: updatedCase,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (dbError) {
      console.error('💾 [CACHE SAVE ERROR] Veritabanı hatası:', JSON.stringify(dbError, null, 2));
      throw dbError;
    }

    console.log(`🚀 [CACHE SAVE SUCCESS] ${updatedCase.title} başarıyla kaydedildi!`);
    return true;
  } catch (err) {
    console.error('❌ [CACHE SAVE CRITICAL] Beklenmedik hata:', err);
    return false;
  }
}
