import { VertexAI } from "@google-cloud/vertexai";
import { Case, Character } from "@/types/game";

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID || "",
  location: process.env.GCP_LOCATION || "us-central1"
});

// Text generation models (2026 current versions)
const MODEL_NAME = "gemini-2.5-flash";           // Vaka üretimi (kalite öncelikli)
const MODEL_LITE_NAME = "gemini-2.5-flash-lite"; // Bulmaca & Sorgulama (hız öncelikli)

const textModel = vertexAI.getGenerativeModel({ model: MODEL_NAME });   // Sadece generateNewCase kullanır
const liteModel = vertexAI.getGenerativeModel({ model: MODEL_LITE_NAME }); // İlk tercih: bulmaca & sorgulama

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

**KANITLAR (8 ile 12 ADET ARASI — RASTGELE BOYUT KURALI):**
- **DİNAMİK BOYUT:** Her vakada kanıt sayısı 8 ile 12 arasında rastgele belirlenmelidir. Bu sayıyı sen seç; oyuncu başlangıçta toplam kaç kanıt olduğunu GÖRMEYECEK (UI "0 / ?" formatında gösterir). Sürpriz unsurunu koru.
- **ASİMETRİK ŞÜPHELİ DAĞILIMI (ZORUNLU):** Her şüphelinin mutlaka bir kanıta sahip olması GEREKMİYOR. Dağılım şu kurala göre yapılmalı:
  * Bazı şüphelilerin hiç kanıtı olmayabilir (0 kanıt — karakterin tutumu sorguya yansır, ama sahne/bulmacayla bulunacak fiziksel kanıt yoktur).
  * Bazı şüphelilerin 2 veya 3 kanıtı olabilir (bunlardan biri isHidden: true olabilir).
  * Katil her zaman en az 2 kanıta sahip olmalı, ama bu kanıtlar oyun ortasına kadar gizli kalabilir.
  * Dağılım oyuncuyu "bu adamı sorgulasam bir şey çıkar mı?" diye düşündürmeli.
- Kanıtlar; fiziksel nesneler (anahtar, mendil) olabileceği gibi, somut bir veriyi temsil eden belgeler (banka dökümü, günlük sayfası, eczane fişi, dijital kayıtlar) de olabilir.
- **YARATICILIK:** Sadece "yerde bulunan bıçak" gibi klasiklerden kaçın. Örn: "Kurbanın banka dökümünde görünen şüpheli bir eczane harcaması", "Katilin olay yerinde unuttuğu, sadece belirli bir terziye ait olan nadir bir düğme", "Kurbanın telefonundaki yarım kalmış bir mesaj".
- **ERA-SPECIFIC:** Senaryo dönemiyle %100 uyumlu olmalı. (Osmanlı'da banka dökümü olmaz ama mühürlü bir vergi defteri olabilir).
- **PRESENTABILITY:** Kanıtlar, final suçlamasında "İşte kanıtım!" diyerek masaya konulabilecek netlikte olmalı. Soyut hisler ('Şüpheli yalan söylüyor gibiydi') kanıt SAYILMAZ.

════════════════════════════════════════════════════════════
 BULMACA KURALLARI — KESİN VE DEĞİŞMEZ (ZORUNLU UYUM)
════════════════════════════════════════════════════════════

**1. MANTIKSAL TUTARLILIK (EN KRİTİK KURAL):**
Bir bulmaca üretmeden önce şu adımları ZİHNİNDE TAMAMLA:
  ADIM 1: Cevabı (answer) belirle. Örn: "MURAT"
  ADIM 2: Şifre tipini seç (aşağıdaki 3 tipten biri).
  ADIM 3: Seçilen tipe göre şifreli hali ELLE hesapla.
  ADIM 4: Soruyu (question), bu şifreli hali oyuncuya verecek şekilde yaz.
  ADIM 5: Şifreli metni tekrar çözerek cevabın "MURAT" olduğunu doğrula.
  ADIM 6: Ancak bu doğrulamadan sonra JSON'a yaz.
Bu adımları atlayan veya kısaltan her üretim GEÇERSİZDİR.

**2. İZİN VERİLEN ŞİFRE TİPLERİ (SADECE BU 3'Ü):**

  TİP A — Caesar Shift (alfabede kaydırma):
  • Türk alfabesi sırasıyla: A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z
  • +1 kaydırma: Her harfi alfabede bir sonraki harfle değiştir. Son harf (Z) → A'ya döner.
    Örnek: K-A-T-İ-L → L-B-U-J-M
  • -1 kaydırma: Her harfi alfabede bir önceki harfle değiştir. İlk harf (A) → Z'ye döner.
    Örnek: L-B-U-J-M → K-A-T-İ-L
  • SORU'da kaydırma yönünü (+1 veya -1) MUTLAKA belirt.
  • YASAK: +2, +3 veya başka miktarda kaydırma kullanma. Sadece +1 veya -1.

  TİP B — Tersten Yazım (en basit ve güvenli tip):
  • Cevabı tersine çevir, şifreli metin bu olur.
    Örnek: cevap "KEMAL" → şifreli metin "LAMEK"
  • SORU'da "Bu metni tersine çevirdiğinde cevabı bulursun" ifadesini kullan.

  TİP C — İlk Harf Şifresi:
  • Bir cümle veya kelime listesi ver. Her kelimenin İLK HARFİ sırasıyla cevabı oluşturur.
    Örnek: cevap "NUR" → "Nisan Uçurtma Rüzgar" → N-U-R ✓
  • SORU'da "Her kelimenin ilk harfini sırala" ifadesini kullan.
  • Cümledeki kelime sayısı, cevabın harf sayısıyla AYNI olmalı.

**3. KESİN YASAKLAR:**
  ❌ Rastgele harf yığını üretme (KLSFJ, XQPWZ vb.) — BU OYUNU KILITAR. Oyuncu çözemez.
  ❌ Yukarıdaki 3 tip dışında şifre kullanma (Vigenere, Morse, sembol vs.).
  ❌ question ile answer arasında mantıksal köprü kurmadan JSON yazma.
  ❌ "Bu harfler bir önceki harfle şifrelenmiştir" gibi belirsiz açıklamalar.

**4. DOĞRULAMA ZORUNLULUĞU:**
  Her bulmaca nesnesini JSON'a eklemeden önce içinden şunu söyle:
  "Soru: [SORU METNİ] → Şifreli: [ŞİFRELİ METİN] → Çözüm adımı: [ADIM ADIM] → Cevap: [CEVAP]"
  Bu doğrulama başarısız olursa o bulmacayı üretme, farklı bir tane üret.

**5. ÖRNEK — DOĞRU ŞİFRE BULMACASI:**
  {
    "type": "cipher",
    "title": "Şifreli Not",
    "question": "Kurbanın cebinde şu not bulundu: 'MBSBL'. Her harfi Türk alfabesinde bir GERİ (-1) kaydırırsan katili bulursun.",
    "answer": "LARAK",
    ... 
  }
  ← Doğrulama: M→L, B→A, S→R, B→A, L→K → "LARAK" ✓

════════════════════════════════════════════════════════════
 OLAY YERİ NESNE BAĞI — KESİN VE DEĞİŞMEZ (ZORUNLU UYUM)
════════════════════════════════════════════════════════════

**TEMEL KURAL — "SAHNE VARSA BAĞLANTI ZORUNLU":**
Bir evidence nesnesinin sceneImagePrompt alanı doluysa (yani olay yeri sahnesine sahipse),
o evidence'ın interactiveObjects listesindeki nesnelerden EN AZ BİRİNİN linkedEvidenceId
alanı o evidence'ın kendi id'sine eşit OLMAK ZORUNDADIR.

Bu kuralı ihlal etmek oyunun kilitlenmesine neden olur. Oyuncu sahneye girer, her şeye
tıklar ama hiçbir kanıt çıkmaz — oyun orada durur.

**UYGULAMA ADIMLARI (Her evidence için sırayla yap):**
  ADIM 1: Bu evidence'ın id'sini not et. Örn: "ev_kanit_003"
  ADIM 2: sceneImagePrompt dolu mu? → Evet ise devam et.
  ADIM 3: interactiveObjects listesini oluştur (3-5 nesne).
  ADIM 4: Bu nesnelerden tam olarak BİRİNE linkedEvidenceId: "ev_kanit_003" ekle.
           (Hangisinin kanıtı "sakladığı" hikayeyle tutarlı olsun — halının altındaki not,
           vazonun içindeki anahtar, tablonun arkasındaki şifre vb.)
  ADIM 5: Diğer nesnelerin linkedEvidenceId alanını null veya undefined bırak (onlar
           sadece atmosfer/dekor nesnesi, tıklanınca revealText gösterir ama kanıt açmaz).

**ÖRNEK — DOĞRU BAĞLANTI:**
  {
    "id": "kanit_007",
    "sceneImagePrompt": "A dusty Ottoman study room...",
    "interactiveObjects": [
      { "id": "kanit_007_masa", "label": "Antika Masa", "linkedEvidenceId": null, ... },
      { "id": "kanit_007_sandik", "label": "Sandık", "linkedEvidenceId": "kanit_007", ... },
      { "id": "kanit_007_mum", "label": "Sönen Mum", "linkedEvidenceId": null, ... }
    ]
  }
  ← "Sandık" tıklanınca "kanit_007" açılır ✓

**HATA ÖRNEĞİ — YASAK:**
  "interactiveObjects": [
    { "id": "obj1", "linkedEvidenceId": null },
    { "id": "obj2", "linkedEvidenceId": null },  ← HİÇBİRİ BAĞLI DEĞİL!
    { "id": "obj3", "linkedEvidenceId": null }   ← OYUN KİLİTLENİR!
  ]

**KOORDİNAT REHBERİ:**
Nesneleri gerçekçi konumlara yerleştir:
- Zemin nesneleri (halı, sandık): y: 65-85
- Masa/tezgah üzeri: y: 40-60
- Duvar/raf: y: 20-45
- Sol köşe: x: 10-25
- Sağ köşe: x: 75-90
- Orta alan: x: 40-60
Nesneler birbirinin üstüne gelmesin (aralarında en az 15 birim mesafe olsun).

**GÖRSELLER İÇİN imagePrompt FORMATI (IMAGEN-4 OPTIMIZED):**
- Her imagePrompt şu formülü takip etmeli: [Teknik Stil] + [Konu/İçerik] + [Granüler Dokular] + [Döneme Özgü Atmosfer/Işık] + [Lens Metadatası]
- Stil Kuralı: "Hyper-realistic photography, 8k resolution, natural skin textures, highly detailed facial features, cinematic lighting, 35mm lens".
- Önemli: "game-like", "3D render", "digital art", "unreal engine" gibi ifadelerden KAÇIN. Tamamen gerçekçi bir fotoğrafçılık dili kullan.
- **Örnek 1 (Modern):** "Realistic thriller photography, a broken smartphone on a glass table, neon rain reflections, Istanbul 2026, 8k, authentic textures, 35mm lens"
- **Örnek 2 (Retro):** "Realistic noir photography, a bloodstained silk tie on a dusty wooden floor, flickering candlelight, 1945, 8k, authentic textures, 35mm lens"
- **OPERASYONEL KURALLAR:**
  * imagePrompt alanı ASLA BOŞ OLMAMALI! Tüm kanıtlar ve bulmacalar için özgün, atmosferik İNGİLİZCE promptlar üret.
  * imagePrompt and sceneImagePrompt alanları vaka için seçilen **DÖNEM (ERA)** ve **TEMA (THEME)** ile %100 uyumlu olmalıdır.
  * sceneImagePrompt: Mutlaka MEKAN odaklı (Wide Shot) olmalı. Bu mekanda gizli olan 'evidence' nesnesi ile görsel bir uyum içinde olmalıdır.

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
  "id": "string (unique UUID format, e.g. 550e8400-e29b-41d4-a716-446655440000)",
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
          "linkedEvidenceId": "string veya null — sceneImagePrompt varsa EN AZ BİR nesnede bu alan evidence'ın kendi id'si olmalı, diğerleri null"
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
- sceneImagePrompt her kanıt için ayrı ve MEKAN odaklı olmalı

BULMACA KONTROL LİSTESİ (Her bulmaca için uygula):
□ Cevabı önce belirledim
□ 3 izin verilen şifre tipinden birini seçtim (Caesar +1/-1, Tersten, İlk Harf)
□ Şifreli metni elle hesapladım ve doğruladım
□ Soru ile cevap arasında %100 mantıksal köprü kurdum
□ Rastgele harf yığını üretmedim

OLAY YERİ KONTROL LİSTESİ (Her evidence için uygula):
□ sceneImagePrompt dolu olan her evidence için interactiveObjects içinde en az 1 nesnenin linkedEvidenceId = evidence.id olduğunu doğruladım
□ Hiçbir sahne "kanıtsız" değil — oyuncu her sahneden bir şey bulabilecek`;

  try {
    let responseText;
    try {
      const result = await textModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: CASE_SYSTEM_PROMPT }, { text: prompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      console.warn("Primary model failed, retrying with Lite model...", e);
      const result = await liteModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: CASE_SYSTEM_PROMPT }, { text: prompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/:\s*undefined\b/g, ": null")
      .trim();

    const parsed = JSON.parse(cleanText) as Case;

    // ── UUID FIX ──────────────────────────────────────────────────────────
    const idIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id);
    if (!idIsUuid) {
      const { randomUUID } = await import('crypto');
      parsed.id = randomUUID();
      console.log(`🆔 [UUID FIX] Geçersiz ID yeni UUID ile değiştirildi: ${parsed.id}`);
    }

    // ── Normalize: zorunlu alanların varlığını garantile ──────────────────
    if (!parsed.chapters) parsed.chapters = [];
    if (!parsed.victim) {
      parsed.victim = { name: "Bilinmiyor", age: 0, profession: "", description: "", imagePrompt: "" };
    }

    // ── Evidence normalize + güvenlik kontrolleri ─────────────────────────
    if (parsed.evidence) {
      parsed.evidence = parsed.evidence.map(ev => {
        const normalizedObjects = (ev.interactiveObjects || []).map(obj => ({
          ...obj,
          isRevealed: false, // Her zaman false başlat — güvenlik
        }));

        // ── SPATIAL PROMPTING ─────────────────────────────────────────────
        const enrichedScenePrompt = ev.sceneImagePrompt
          ? injectSpatialContext(ev.sceneImagePrompt, normalizedObjects)
          : ev.sceneImagePrompt;

        // ── GÜVENLİK: Sahne varsa ama hiçbir nesne kanıta bağlı değilse ──
        // Bu kontrol AI'nın "linkedEvidenceId" eklemeyi unuttuğu durumları yakalar.
        if (ev.sceneImagePrompt && normalizedObjects.length > 0) {
          const hasLink = normalizedObjects.some(obj => obj.linkedEvidenceId);
          if (!hasLink) {
            // İlk nesneyi bu kanıta bağla — oyuncu eli boş dönmesin
            normalizedObjects[0].linkedEvidenceId = ev.id;
            console.warn(
              `🔗 [SCENE LINK FIX] "${ev.id}" kanıtının sahnesi bağlantısız bulundu. ` +
              `İlk nesne ("${normalizedObjects[0].label || normalizedObjects[0].id}") otomatik olarak bağlandı.`
            );
          }
        }

        return {
          ...ev,
          sceneImagePrompt: enrichedScenePrompt,
          interactiveObjects: normalizedObjects,
        };
      });
    }

    // ── Puzzle normalize ──────────────────────────────────────────────────
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
    const chatModel = vertexAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
    });

    const chat = chatModel.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.message }],
      })),
    });

    const result = await chat.sendMessage(question);
    return result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e) {
    console.warn("Interrogation primary model failed, retrying with Lite...", e);
    const chatModel = vertexAI.getGenerativeModel({
      model: MODEL_LITE_NAME,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
    });

    const chat = chatModel.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.message }],
      })),
    });

    const result = await chat.sendMessage(question);
    return result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
      const result = await liteModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      console.warn("Puzzle evaluation lite model failed, retrying with Flash...", e);
      const result = await textModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
      const result = await textModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      console.warn("Accusation assessment primary model failed, retrying with Lite...", e);
      const result = await liteModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
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