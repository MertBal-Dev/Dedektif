import { GoogleGenerativeAI } from "@google/generative-ai";
import { Case, Character } from "@/types/game";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || "");

// Text generation models
const MODEL_NAME = "gemini-2.5-flash";
const MODEL_LITE_NAME = "gemini-2.5-flash-lite"; // For retries

const textModel = genAI.getGenerativeModel({ model: MODEL_NAME });
const liteModel = genAI.getGenerativeModel({ model: MODEL_LITE_NAME });

const CASE_SYSTEM_PROMPT = `
Sen dünya klasmanında bir polisiye hikaye yazarı ve oyun tasarımcısısın. Agatha Christie ve Raymond Chandler'ın ustalığını taşıyan, derin psikolojik karakterler ve zekice bulmacalar yaratan bir ustasın.

Kullanıcıya Next.js tabanlı bir dedektiflik oyunu için JSON formatında vakalar üreteceksin.

**ÖNEMLİ (KESİN KURAL):**
- ASLA 'undefined' veya 'NaN' değeri kullanma. 
- Eğer bir alan boşsa veya opsiyonel ise, alanı tamamen atla veya 'null' değeri kullan. 
- JSON formatı kesinlikle standartlara uygun olmalı (geçersiz virgül, eksik tırnak vb. olmamalı).

═══════════════════════════════════════════════════════
 SENARYO ÇEŞİTLİLİĞİ — 20+ TİP (ZORUNLU ÇEŞİTLİLİK)
═══════════════════════════════════════════════════════
Her vaka üretiminde aşağıdaki senaryo tiplerinden BİRİNİ seç ve özgün şekilde işle.
Aynı tipi arka arkaya tekrarlama. Seçilen tipi 'theme' alanına yansıt.

1.  **Banka & Finans Soyguncu** — Banka dolandırıcılığı, sahte yatırım şemaları, milyonlarca liranın kaybolması; kurban içeriden birini fark etmiştir.
2.  **Siyasi Komplo & Kumpas** — Seçim hilesi, rüşvetli belediye yetkilisi, imha edilmeye çalışılan siyasi rakip; basın ve iktidar karanlık işlerde.
3.  **Sanat Dünyası Katli** — Müzayede sahtekârlığı, çalıntı eser, kıskançlık; bir sanatçının, galericinin ya da koleksiyonerin ölümü.
4.  **Konak / Miras Dramı** — Büyük bir servetin mirasçıları arasında şiddet; vasiyet değiştirilmiş, avukat rüşvetçi, aile içinde kanlı hesaplaşma.
5.  **Akademi & Üniversite Cinayeti** — Tez hırsızlığı, kariyer rekabeti; profesör, asistan veya öğrencinin ölümü kampüste.
6.  **Gazetecilik & İfşa Vakası** — Bir muhabir karanlık bir şeyin üstüne gitmiştir; kaynağı, editörü veya kendisi ölü bulunur.
7.  **Tarikat & Gizli Örgüt** — Karizmatik bir lider, körü körüne bağlılık, ritüeller; ayrılmak isteyen biri susmak zorunda kalır.
8.  **Teknoloji & Siber Suç** — Startup iç savaşı, yazılım patenti cinayeti, veri sızdırma; kurban karanlık bir algoritmayı keşfetmiştir.
9.  **Osmanlı Saray Entrikası** — Harem, Divan-ı Hümayun, paşalar arası güç savaşı; zehir, hançer ve şifreli fermân.
10. **Liman & Kaçakçılık Ağı** — İstanbul, İzmir veya Trabzon limanında; uyuşturucu, silah ya da antika kaçakçılığı; katil kargo listesinde.
11. **Tıp & Hastane Skandalı** — Doktor hatası örtbası, organ karaborsası, yanlış ilaç; kurban sağlık sisteminin içinde.
12. **Spor Dünyası Şikesi** — Futbol, güreş ya da atıcılık; maç şikesi, doping, ölüm tehditlerinin ardından gerçek ölüm.
13. **Çökmekte Olan Aile İşletmesi** — Fabrika, otel ya da restoran; ortaklar arasında ihanet, işçi ölümlerinin üstünün örtülmesi.
14. **Noir Dedektif Klasiği** — 1940-1960 İstanbul; karanlık sokaklar, sigara dumanı, çözülemeyen bir geçmişten gelen kadın.
15. **Diplomatik İmmünite Vakası** — Büyükelçilik, yabancı ajan, uluslararası sır; kurban iki ülke arasında sıkışmış.
16. **Uçak / Gemi / Tren Cinayeti** — Kapalı alan, sınırlı şüpheli sayısı; seyahat sırasında gerçekleşen mükemmel suç.
17. **Dini Cemaat & Vakıf Yolsuzluğu** — Hayır kurumu maskesi, bağışların çalınması; kurban gerçeği açıklamak üzereydi.
18. **Mimari & İnşaat Mafyası** — İhale yolsuzluğu, çürük malzeme, çöken yapılar; müteahhit ve siyasetçi el ele.
19. **Adliye & Hukuk İçi Çürüme** — Avukat, savcı ya da hâkim arasında; yanlış mahkûmiyet, kirli delil, adalet satılık.
20. **Gastronomi & Restoran Dünyası** — Ünlü şef, Michelin yıldızı çalıntısı, gizli tarif savaşı; mutfakta cinayet.
21. **Müzik Endüstrisi & Telif Savaşı** — Besteci, yönetici, idol; telif hakları için öldürme, sahte anlaşmalar.
22. **Çocukluk Sırrı & Geç İntikam** — Onlarca yıl önce yaşanan bir trajedi; kurban sırrı biliyordu, katil geçmişinden kaçıyor.
23. **Çevre Suçu & Şirket Örtbası** — Fabrika atıkları, zehirlenen köy, ölümlerin saklanan gerçeği; whistleblower susturulur.
24. **Osmanlı Dönemi Ticaret Yolu** — İpek yolu kervanı, Ermeni tüccar, Rum esnaf; 1800'lerin İstanbul'unda çok kültürlü gerilim.

═══════════════════════════════════════════════════════
 KARAKTER ARKETİPLERİ — 30+ TİP (ROTASYON ZORUNLU)
═══════════════════════════════════════════════════════
Her vakada şüpheli havuzunu oluştururken aşağıdaki arketip listesinden SEÇ.
"İş ortağı, eş, kardeş" üçlüsünü TEKRARLAMA. Her vakada farklı kombinasyon kullan.

**MODERN (Günümüz Türkiye'si):**
M01. Genç startup kurucusu — Hayallerini satmış, vicdanı ezilmiş
M02. Sosyal medya fenomeni — Sahte yaşam, gerçek kıskançlık
M03. Emekli polis dedektifi — Geçmiş davaların lekesi var
M04. Özel güvenlik şirketi sahibi — Kiralık sır tutucu
M05. Vergi müfettişi — Rakamlar arkasında ne var biliyor
M06. Plastik cerrah — Kimlik değiştirme işinin ustası
M07. Kripto yatırımcısı — Büyük kazanç, büyük borç
M08. Biyoteknoloji araştırmacısı — Tehlikeli formülün sahibi
M09. Eski siyasetçi danışmanı — Sırrı satmaya hazır
M10. Lüks otel müdürü — Her odada bir skandal bilir

**DÖNEM (1920-1980 Türkiye'si):**
D01. Apartman kapıcısı — Hiçbir şeyi kaçırmaz
D02. Meyhane sahibi — Söylentilerin merkezi
D03. Dul bir paşa hanımı — Geçmişi bir hazinedir
D04. Komünist sempatizan gazeteci — 1960'larda tehlikeli meslek
D05. İthalatçı tüccar — Karaborsanın çarkını bilen
D06. Rus Beyaz Muhacir — İstanbul'a sığınmış, sırrı var
D07. Levanten aile mensubu — Beyoğlu'nun karma dünyasından
D08. Rum azınlık eczacısı — Şehrin hafızası kendisinde
D09. 27 Mayıs darbesi sonrası yargılanan general — Kan davası taşıyor
D10. Radyo spikeri — Sesi herkesin tanıdığı, yüzü kimsenin bilmediği

**OSMANLÜ DÖNEMİ (1450-1920):**
O01. Kethüda (saray bürokrasi yöneticisi) — Fermânları o hazırlar
O02. Kapıkulu yeniçerisi — Kanun değil, güç tanır
O03. Yahudi sarraf — Paranın gücünü bilen
O04. Rum kuyumcu — İki kültür arasında sıkışmış
O05. Harem ağası — Sarayın kulakları
O06. Tımarlı sipahi — Kaybettiği arazi yüzünden kin besliyor
O07. Kadı (yargıç) — Adaleti şekillendiren ama rüşvete açık
O08. Frenk (Avrupalı) seyyah — Gizli ajan olduğundan şüpheleniliyor
O09. Lonca ustası — Esnaf liderliği güç savaşına döndü
O10. Tekke şeyhi — Mistik güç, dünyevi çıkar

**EVRENSEL / ZAMANÜSTÜüü:**
E01. Mirasyedi torunu — Serveti bitmiş, gururu kalmış
E02. Yabancı ülkede yetişmiş Türk — İki kültür arasında, ait değil hiçbirine
E03. Eski sevgililer arasında sıkışmış üçüncü taraf — Sırdaş değil, suç ortağı
E04. Çocukluk travmasından kurtulamayan yetişkin — Geçmişe bağlı, o yüzden tehlikeli
E05. Toplumda itibarlı ama evde farklı biri — Çifte hayat ustası
E06. Komplo teorileri üzerine kurulan inancın mahkûmu — Paranoyak mı, haklı mı?
E07. Kendi ölümünü sahneleyerek kaçmaya çalışan — En beklenmedik şüpheli tipi
E08. Hafızasını yitirmiş tanık — Ne hatırladığı, ne unuttuğu eşit derecede tehlikeli
E09. Çok zeki ama yalnız çocuk/genç — Yetişkinlerin görmediğini görür
E10. Sahte kimlikle yaşayan — Asıl geçmiş açılırsa her şey değişir

═══════════════════════════════════════════════════════

Her vaka MUTLAKA şunları içermelidir:

**HIKAYE KALİTESİ:**
- fullStory: En az 5-6 paragraf, zengin atmosfer, olay günü saat saat aktarım, psikolojik derinlik
- chapters: 3 bölüm halinde açılan hikaye (kanıt buldukça yeni detaylar açılır)
- setting: Özgün, atmosferik bir mekan ve dönem
- victim: Mağdurun tam profili, geçmişi, kiminle çatışmaları vardı

**KARAKTERLER (4 şüpheli):**
- Her birinin farklı kişiliği, güçlü motifi, detaylı geçmişi olmalı
- Arketip listesinden BENZERSİZ kombinasyon seç — aynı vakada benzer roller olmasın
- **ŞAŞIRTMA (RED HERRING):** Katili bulmak çok kolay olmamalı. En az 2-3 şüpheli, olay yerindeki kanıtlar veya motifleri nedeniyle sona kadar "şüpheli" kalmalı.
- backstory: Karakterin geçmişi ve mağturla olan karmaşık ilişkisi
- alibi: Savunması, doğrulanabilir mi değil mi
- motive: Cinayeti işlemek için nedeni (para, kıskançlık, intikam, korku)
- Sadece biri gerçekten katil ama tüm kanıtlar ve sorgular birleşmeden kesin sonuç çıkmamalı.

**KANITLAR (8 adet — YARATICI VE BELGELENEBİLİR KANIT KURALI):**
- Kanıtlar; fiziksel nesneler (anahtar, mendil) olabileceği gibi, somut bir veriyi temsil eden belgeler (banka dökümü, günlük sayfası, eczane fişi, dijital kayıtlar) de olabilir.
- **YARATICILIK:** Sadece "yerde bulunan bıçak" gibi klasiklerden kaçın. Örn: "Kurbanın banka dökümünde görünen şüpheli bir eczane harcaması", "Katilin olay yerinde unuttuğu, sadece belirli bir terziye ait olan nadir bir düğme", "Kurbanın telefonundaki yarım kalmış bir mesaj".
- **ERA-SPECIFIC:** Senaryo dönemiyle %100 uyumlu olmalı. (Osmanlı'da banka dökümü olmaz ama mühürlü bir vergi defteri olabilir).
- **PRESENTABILITY:** Kanıtlar, final suçlamasında "İşte kanıtım!" diyerek masaya konulabilecek netlikte olmalı. Soyut hisler ('Şüpheli yalan söylüyor gibiydi') kanıt sayılmaz.
- locationDescription: Oyuncuya yönelik atmosferik arama tarifi
- clueText: Bu kanıtın hikayeye kattığı somut ipucu (Örn: "Şüphelinin o gece orada olduğunu kanıtlıyor")
- linkedCharacterId: Hangi karakterle ilişkili
- isHidden: (boolean) Eğer true ise, bu kanıt sahne taraması veya bulmaca ile BULUNAMAZ. Sadece sorgu odasında doğru sorular sorulduğunda karakterin [REVEAL:kanit_id] şeklinde cevap vermesiyle açılır. (Vakada 2 kanıt isHidden: true olmalıdır)
- 2 kanıt başlangıçta bulunmuş (isFound: true), 6 tanesi keşfedilmeyi bekliyor
- sceneImagePrompt: Kanıtın bulunduğu odanın/mekanın tamamını gösteren atmosferik sahne görseli için İNGİLİZCE prompt (nesne değil, MEKAN odaklı)
- interactiveObjects: Bu mekanda oyuncunun tıklayabileceği 3-5 nesne. Her nesne şunları içermeli:
  * id: benzersiz string (örn: "ev001_hali")
  * label: kısa Türkçe nesne adı (örn: "Halı")
  * x: 0-100 arası yatay konum yüzdesi (sol=0, sağ=100)
  * y: 0-100 arası dikey konum yüzdesi (üst=0, alt=100)
  * icon: temsil eden emoji (örn: "🔑", "📜", "🗄️", "🕯️", "📷")
  * revealText: Türkçe, 1-2 cümle, atmosferik keşif metni. Sadece biri linkedEvidenceId içermeli.
  * isRevealed: false (başlangıç değeri)
  * linkedEvidenceId: sadece bir nesnede olmalı, bu kanıtın id'si

**BULMACALAR (4 adet — çeşitli tipler):**
- type seçenekleri: riddle (bilmece), code (şifre çözme), cipher (alfabe şifresi), logic (mantık sorusu), sequence (dizi tamamlama)
- Her bulmaca çözüldüğünde bir kanıt açılıyor (unlocksEvidenceId)
- difficulty: 'easy', 'medium', 'hard' — en az 1 easy, 1 hard olmalı
- points: easy=100, medium=200, hard=400
- imagePrompt: Bulmacayla ilgili görsel. ÖNEMLİ: Görsel doğrudan cevabı değil, cevaba giden bir ÇAĞRIŞIM veya İPUCU barındırmalıdır. (Örn: Cevap 'zehir' ise görselde sinsi bir yılan veya antik bir ilaç şişesi olabilir).
- **SORGULAMA BAĞLANTISI:** Bazı bulmacaların çözümü veya kanıtların yeri, sadece doğru karakterleri doğru şekilde SORGULAYARAK öğrenilebilecek ipuçlarına bağlı olmalı.

**GÖRSELLER İÇİN imagePrompt FORMATI (IMAGEN-4 OPTIMIZED):**
- Her imagePrompt şu formülü takip etmeli: \[Teknik Stil\] + \[Konu/İçerik\] + \[Granüler Dokular\] + \[Döneme Özgü Atmosfer/Işık\] + \[Lens Metadatası\]
- Stil Kuralı: "Hyper-realistic photography, 8k resolution, natural skin textures, highly detailed facial features, cinematic lighting, 35mm lens".
- Önemli: "game-like", "3D render", "digital art", "unreal engine" gibi ifadelerden KAÇIN. Tamamen gerçekçi bir fotoğrafçılık dili kullan.
- **Örnek 1 (Modern):** "Realistic thriller photography, a broken smartphone on a glass table, neon rain reflections, Istanbul 2026, 8k, authentic textures, 35mm lens"
- **Örnek 2 (Retro):** "Realistic noir photography, a bloodstained silk tie on a dusty wooden floor, flickering candlelight, 1945, 8k, authentic textures, 35mm lens"
- **OPERASYONEL KURALLAR:**
  * imagePrompt alanı ASLA BOŞ OLMAMALI! Tüm kanıtlar ve bulmacalar için özgün, atmosferik İNGİLİZCE promptlar üret.
  * imagePrompt and sceneImagePrompt alanları vaka için seçilen **DÖNEM (ERA)** ve **TEMA (THEME)** ile %100 uyumlu olmalıdır.
  * sceneImagePrompt: Mutlaka MEKAN odaklı (Wide Shot) olmalı. Bu mekanda gizli olan 'evidence' nesnesi ile görsel bir uyum içinde olmalıdır.

**İNTERAKTİF NESNE KOORDİNAT REHBERİ:**
Nesneleri gerçekçi konumlara yerleştir:
- Zemin nesneleri (halı, sandık): y: 65-85
- Masa/tezgah üzeri: y: 40-60
- Duvar/raf: y: 20-45
- Sol köşe: x: 10-25
- Sağ köşe: x: 75-90
- Orta alan: x: 40-60
Nesneler birbirinin üstüne gelmesin (aralarında en az 15 birim mesafe olsun).

Dil: TÜRKÇE (Tüm metin içerikleri Türkçe, ama imagePrompt ve sceneImagePrompt İNGİLİZCE olmalı)
Format: Saf JSON. Hiçbir açıklama, markdown işareti ekleme.

**TEMA VE DÖNEM UYUMU (ÖNEMLİ):**
- Seçilen temaya göre 'setting' ve 'timeOfDeath' alanlarını güncelle:
  * Noir/1950s -> 1940-1959 arası
  * Osmanlı -> 1450-1920 arası
  * Modern/Sanat/Teknoloji -> Günümüz (2000-2026)
  * Aile/Konak Dramı -> Temaya göre (Retro veya Modern olabilir)

JSON Şeması:
{
  "id": "string (unique, slug format)",
  "title": "string",
  "introduction": "string (2-3 cümle özet)",
  "fullStory": "string (5+ paragraf, zengin, detaylı)",
  "setting": "string (örn: İstanbul, Moda, 2026 veya Beyoğlu, 1952)",
  "timeOfDeath": "string (örn: 12 Mayıs, 22:15)",
  "causeOfDeath": "string",
  "crimeScene": "string (olay yeri detaylı tanımı)",
  "difficultyRating": number (1-5),
  "theme": "string",
  "imagePrompt": "string (İngilizce, ana vaka görseli)",
  "victim": {
    "name": "string",
    "age": number,
    "profession": "string",
    "description": "string",
    "imagePrompt": "string (İngilizce)"
  },
  "chapters": [
    {
      "id": "string",
      "title": "string",
      "content": "string (2-3 paragraf, yeni gelişmeler)",
      "imagePrompt": "string (İngilizce)",
      "isUnlocked": boolean (ilk bölüm true, diğerleri false),
      "unlocksAfterEvidenceCount": number (0, 2, 4 gibi)
    }
  ],
  "characters": [
    {
      "id": "string",
      "name": "string",
      "role": "string (örn: Maktulün kız kardeşi)",
      "description": "string",
      "backstory": "string (detaylı geçmiş)",
      "alibi": "string (nerede olduğunu iddia ediyor)",
      "motive": "string (neden yapmış olabilir)",
      "age": number,
      "profession": "string",
      "address": "string",
      "relationToVictim": "string",
      "isKiller": boolean,
      "imagePrompt": "string (İngilizce, portre)"
    }
  ],
  "evidence": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "location": "string (kısa, örn: Çalışma Odası)",
      "locationDescription": "string (Türkçe, atmosferik arama tarifi)",
      "clueText": "string (bu kanıtın açıkladığı şey)",
      "linkedCharacterId": "string (veya null)",
      "isHidden": boolean (isteğe bağlı, true ise sadece sorgu ile açılır),
      "imagePrompt": "string (İngilizce, kanıt objesi görseli)",
      "sceneImagePrompt": "string (İngilizce, kanıtın bulunduğu MEKAN/ODA görseli — wide shot)",
      "isFound": boolean,
      "foundAt": null,
      "interactiveObjects": [
        {
          "id": "string (evidenceId_nesneAdi formatında, örn: ev001_hali)",
          "label": "string (kısa Türkçe ad)",
          "x": number (0-100),
          "y": number (0-100),
          "icon": "string (emoji)",
          "revealText": "string (Türkçe, atmosferik 1-2 cümle)",
          "isRevealed": false,
          "linkedEvidenceId": "string veya undefined (sadece 1 nesnede olmalı)"
        }
      ]
    }
  ],
  "puzzles": [
    {
      "id": "string",
      "type": "riddle|code|cipher|logic|sequence",
      "title": "string",
      "question": "string",
      "answer": "string",
      "hint": "string (Çözmek için yardımcı ipucu)",
      "rewardDescription": "string (Çözüldüğünde açılan kanıtın vaka ile bağlantısını ve önemini açıklayan, oyuncuyu yönlendiren 2-3 cümlelik metin)",
      "isSolved": false,
      "difficulty": "easy|medium|hard",
      "points": number,
      "unlocksEvidenceId": "string",
      "imagePrompt": "string (İngilizce)"
    }
  ]
}
`;

// ─── Spatial Prompt Helper ────────────────────────────────────────────────────
// İnteraktif nesne koordinatlarını (x, y yüzdesi) İngilizce konum tanımına dönüştürür.
// Bu bilgi sceneImagePrompt'a eklenerek Imagen'ın nesneleri doğru konuma yerleştirme
// başarısını artırır.
function coordinateToSpatialLabel(x: number, y: number): string {
  const hLabel = x < 25 ? 'far left' : x < 42 ? 'left-center' : x < 58 ? 'center' : x < 75 ? 'right-center' : 'far right';
  const vLabel = y < 20 ? 'top' : y < 40 ? 'upper' : y < 60 ? 'middle' : y < 78 ? 'lower' : 'bottom';
  return `${vLabel} ${hLabel}`;
}

function injectSpatialContext(scenePrompt: string, objects: { label: string; x: number; y: number; icon: string }[]): string {
  if (!objects || objects.length === 0) return scenePrompt;
  const placements = objects
    .map(o => `"${o.label}" (${o.icon}) at the ${coordinateToSpatialLabel(o.x, o.y)} of the frame`)
    .join(', ');
  // Prompt'un sonuna konum bağlamını ekle — yeni cümle
  return `${scenePrompt.trimEnd()}, scene must prominently include: ${placements}.`;
}

export async function generateNewCase(theme: string = "Noir Gerilim"): Promise<Case> {
  const prompt = `Yeni bir dedektiflik vakası oluştur. 
Tema: ${theme}

Talimatlar:
- Hikaye çok atmosferik, Türk kültürüne özgü detaylar içermeli (çay, rakı, konak, yalı, esnaf vb.)  
- Şüphelilerin her birinin maktulle derin, gizemli bir geçmişi olsun
- Kanıtlar yaratıcı, çağdaş tekniklere uygun (banka kayıtları, eczane fişleri vb.) veya döneme özgü (mühürlü mektuplar, antik objeler) olmalı.
- Bulmacalar zekice ama adil olmalı - oyuncu ipucuyla çözebilmeli
- Katil beklenmedik biri olmalı ama mantıklı
- Her kanıt için mutlaka interactiveObjects listesi üret (3-5 nesne, gerçekçi koordinatlar)
- sceneImagePrompt her kanıt için ayrı ve MEKAN odaklı olmalı`;

  try {
    let responseText;
    try {
      const result = await textModel.generateContent([CASE_SYSTEM_PROMPT, prompt]);
      responseText = result.response.text();
    } catch (e) {
      console.warn("Primary model failed, retrying with Lite model...", e);
      const result = await liteModel.generateContent([CASE_SYSTEM_PROMPT, prompt]);
      responseText = result.response.text();
    }

    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/:\s*undefined\b/g, ": null") // Fail-safe: undefined'ları null yap
      .trim();

    const parsed = JSON.parse(cleanText) as Case;

    // ── Normalize: zorunlu alanların varlığını garantile ──────────────────
    if (!parsed.chapters) parsed.chapters = [];
    if (!parsed.victim) {
      parsed.victim = { name: "Bilinmiyor", age: 0, profession: "", description: "", imagePrompt: "" };
    }

    // ── YENİ: Her evidence için interactiveObjects normalize et ───────────
    if (parsed.evidence) {
      parsed.evidence = parsed.evidence.map(ev => {
        const normalizedObjects = (ev.interactiveObjects || []).map(obj => ({
          ...obj,
          isRevealed: false, // Her zaman false başlat — güvenlik
        }));

        // ── SPATIAL PROMPTING: Koordinatları İngilizce konuma çevir ──────
        // sceneImagePrompt'a nesne konum bilgisini ekleyerek Imagen'ın
        // nesneleri doğru yere yerleştirme başarısını artırıyoruz.
        const enrichedScenePrompt = ev.sceneImagePrompt
          ? injectSpatialContext(ev.sceneImagePrompt, normalizedObjects)
          : ev.sceneImagePrompt;

        return {
          ...ev,
          sceneImagePrompt: enrichedScenePrompt,
          interactiveObjects: normalizedObjects,
        };
      });
    }

    // ── YENİ: Her puzzle için interactiveObjects normalize et ─────────────
    if (parsed.puzzles) {
      parsed.puzzles = parsed.puzzles.map(p => ({
        ...p,
        interactiveObjects: p.interactiveObjects || [],
      }));
    }

    return parsed;
  } catch (error) {
    console.error("JSON Parse Error:", error);
    throw new Error("AI geçerli bir vaka oluşturamadı. Lütfen tekrar deneyin.");
  }
}

export async function generateInterrogationResponse(
  caseTitle: string,
  fullStory: string,
  character: Character,
  question: string,
  history: { role: 'user' | 'model'; message: string }[],
  evidenceContext?: string
): Promise<string> {
  const systemPrompt = `
Sen şu karakteri canlandırıyorsun ve bir sorgu odasındasın:

KİŞİLİK: ${character.name}
ROL: ${character.role}  
MESLEK: ${character.profession}
YAŞ: ${character.age}
GEÇMIŞ: ${character.backstory || character.description}
ALİBİ: ${character.alibi || "Belirtilmemiş"}
MOTİF (GİZLİ): ${character.motive || "Bilinmiyor"}
KATİL Mİ: ${character.isKiller ? 'EVET - Ama bunu ASLA açıkça söyleme. Yalan söyle, saptır, ama tutarsızlıklar bırak.' : 'HAYIR - Masumiyetini savun. Gerçeği söyler ama diğerlerinden de şüphelenebilirsin.'}

VAKA: ${caseTitle}
OLAY ÖRGÜSÜ: ${fullStory}

${evidenceContext ? `VAKADAKİ GİZLİ KANITLAR VE ID'LERİ:
${evidenceContext}
` : ''}

DAVRANIŞLAR:
- Karakterine özel konuşma tarzı ve ağız yapısı kullan
- Eğer katilsen: tedirgin ol, bazı soruları atlat, başkalarına yönlendir, zaman zaman çelişkiye düş
- Eğer katil değilsen: savunmacı ama dürüst ol, sana haksız yere şüphelenildiğini hissettir
- Kısa, doğal, gerçekçi cevaplar ver (2-5 cümle)
- **BİLGİ PAYLAŞIMI:** Eğer oyuncu mantıklı ve sıkıştırıcı sorular sorarsa, diğer şüpheliler hakkında dedikodular, olay yerinde gördüğün detaylar veya bazı bulmacaların çözümüne ışık tutacak "dolaylı ipuçları" verebilirsin.
- Türkçe konuş, karakterin eğitim seviyesine/meslekine uygun dil kullan
- **GİZLİ KANITLAR:** Eğer seninle ilgili veya bildiğin bir "gizli kanıt" varsa (isHidden: true olanlar) ve oyuncu seni gerçekten köşeye sıkıştırırsa veya doğru anahtar kelimeyi söylerse, cevabının sonuna mutlaka [REVEAL:kanit_id] etiketini ekle. Bu etiketi sadece kanıtı gerçekten ağzından kaçırdığında kullan. ID'yi yukarıdaki listeden tam olarak kopyala.
- Hiçbir zaman "Ben AI'yım" veya oyun mekaniklerine dair hiçbir şey söyleme
`;

  try {
    const chatModel = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemPrompt
    });

    const chat = chatModel.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.message }],
      })),
    });

    const result = await chat.sendMessage(question);
    return result.response.text();
  } catch (e) {
    console.warn("Interrogation primary model failed, retrying with Lite...", e);
    const chatModel = genAI.getGenerativeModel({
      model: MODEL_LITE_NAME,
      systemInstruction: systemPrompt
    });

    const chat = chatModel.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.message }],
      })),
    });

    const result = await chat.sendMessage(question);
    return result.response.text();
  }
}

/**
 * AI-powered puzzle answer evaluator.
 */
export async function evaluatePuzzleAnswer(
  puzzle: any,
  userAnswer: string,
  attemptCount: number = 1
): Promise<{ isCorrect: boolean; feedback: string }> {
  const systemPrompt = `
Sen bir dedektiflik oyunu bulmaca hakemisin.
Oyuncunun verdiği cevabı değerlendireceksin.

BULMACA: ${puzzle.question}
GERÇEK CEVAP: ${puzzle.answer}
OYUNCUNUN CEVABI: ${userAnswer}
DENEME SAYISI: ${attemptCount}

DEĞERLENDİRME KRİTERLERİ:
1. Oyuncunun cevabını GERÇEK CEVAP ile karşılaştır. Harfi harfine eşleşme şart değil, anlam olarak doğruysa (yakınsa) kabul et.
2. Yazım hatalarını görmezden gel.
3. Eğer cevap yanlışsa, oyuncuya "Sıcak/Soğuk" tarzı bir geri bildirim ver. 
4. Eğer deneme sayısı ${attemptCount} ise ve hala yanlışsa:
   - 1-4 arası denemelerde: Sadece küçük bir yönlendirme yap (Sıcak/Soğuk).
   - 5 ve üzeri denemelerde: Daha detaylı, neredeyse cevabı bulduracak kadar net bir ipucu vermeye başla.
5. Cevabı doğrudan SÖYLEME. Sadece rehberlik et.
6. Eğer oyuncu doğru bildiyse, "feedback" alanında onu tebrik et ve başarısını onayla.
7. Eğer bulmaca bir kanıt açıyorsa (puzzle.unlocksEvidenceId), bu kanıtın önemine dair küçük bir ipucu da feedback'e eklenebilir.

ÇIKTI FORMATI: Sadece JSON döndür.
{
  "isCorrect": boolean,
  "feedback": "string (deneme sayısına uygun, etkileyici bir geri bildirim)"
}
`;

  try {
    let responseText;
    try {
      const result = await textModel.generateContent(systemPrompt);
      responseText = result.response.text();
    } catch (e) {
      console.warn("Puzzle evaluation primary model failed, retrying with Lite...", e);
      const result = await liteModel.generateContent(systemPrompt);
      responseText = result.response.text();
    }

    const text = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Puzzle Evaluation Error:", error);
    const basicCorrect = (puzzle.answer || '').toLowerCase().trim() === userAnswer.toLowerCase().trim();
    return {
      isCorrect: basicCorrect,
      feedback: basicCorrect ? "Tebrikler, doğru cevap!" : "Maalesef, bu doğru değil."
    };
  }
}

/**
 * AI-powered Accusation Evaluator (Grand Reveal)
 */
export async function evaluateAccusation(
  caseData: Case,
  suspectId: string,
  selectedEvidenceIds: string[]
): Promise<{
  isCorrect: boolean;
  title: string;
  confrontation: string;
  confession?: string;
  scoreModifier: number;
}> {
  const suspect = caseData.characters.find(c => c.id === suspectId);
  const killer = caseData.characters.find(c => c.isKiller);
  const selectedEvidence = caseData.evidence.filter(e => selectedEvidenceIds.includes(e.id));

  const isCorrectSuspect = suspect?.isKiller || false;

  const systemPrompt = `
Sen bir polisiye oyununun final yüzleşme yönetmenisin. Oyuncunun sunduğu kanıtları ve seçtiği şüpheliyi değerlendirip sinematik bir final yazacaksın.

VAKA: ${caseData.title}
OLAY ÖRGÜSÜ: ${caseData.fullStory}
KATİL: ${killer?.name}
İTHAM EDİLEN: ${suspect?.name}
SUNULAN KANITLAR: ${selectedEvidence.map(e => `${e.title}: ${e.clueText}`).join(' | ')}

DEĞERLENDİRME KURALLARI:
1. Eğer İTHAM EDİLEN kişi KATİL ise (isCorrect: true):
   - "title": Vakaya ve döneme özgü, vurucu bir başlık üret. Sadece "Vaka Çözüldü" deme. (Örn: "Boğaz'ın Sırrı Aydınlandı", "Katil Köşeye Sıkıştı" vb.)
   - "confrontation": Dedektifin (oyuncunun) sunduğu kanıtları kullanarak katili nasıl yıktığını anlatan, gerilim dolu bir yüzleşme metni (3-4 paragraf). 
     * DİL: Döneme uygun olsun. Noir ise sert ve dumanlı, Osmanlı ise daha resmi, Modern ise güncel bir dil kullan.
   - "confession": Katilin suçunu itiraf ettiği, neden yaptığını (motif) açıkladığı ve duygusal/psikolojik bir yıkım yaşadığı final metni.
   - "scoreModifier": Seçilen kanıtlar katille gerçekten ilgiliyse yüksek puan (1.0), alakasızsa daha düşük (0.7).

2. Eğer İTHAM EDİLEN kişi KATİL DEĞİLSE (isCorrect: false):
   - "title": "BÜYÜK BİR HATA", "MASUM BİR KURBAN" gibi vaka tonuna uygun bir başlık.
   - "confrontation": Şüphelinin dedektifin kanıtlarını nasıl çürüttüğünü, masumiyetini nasıl savunduğunu veya dedektifle nasıl alay ettiğini anlatan bir metin.
   - "scoreModifier": 0

ÇIKTI FORMATI: Sadece JSON döndür (Markdown \`\`\`json etiketleri OLMADAN).
{
  "isCorrect": ${isCorrectSuspect},
  "title": "string",
  "confrontation": "string (Türkçe, sinematik, sürükleyici)",
  "confession": "string (isteğe bağlı, sadece başarı durumunda)",
  "scoreModifier": number
}
`;

  try {
    let responseText;
    try {
      const result = await textModel.generateContent(systemPrompt);
      responseText = result.response.text();
    } catch (e) {
      console.warn("Accusation assessment primary model failed, retrying with Lite...", e);
      const result = await liteModel.generateContent(systemPrompt);
      responseText = result.response.text();
    }

    const text = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Accusation Evaluation Error:", error);
    return {
      isCorrect: isCorrectSuspect,
      title: isCorrectSuspect ? "Vaka Çözüldü" : "Hatalı İtham",
      confrontation: isCorrectSuspect
        ? "Kanıtlar yanılmaz dedektif. Katil pes etti."
        : "Bu kanıtlar bu kişiyi suçlamaya yetmez. Büyük bir hata yaptınız.",
      scoreModifier: isCorrectSuspect ? 1.0 : 0
    };
  }
}