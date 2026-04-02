import { VertexAI } from "@google-cloud/vertexai";
import { Case, Character } from "@/types/game";

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID || "",
  location: process.env.GCP_LOCATION || "us-central1",
  googleAuthOptions: process.env.GCP_SERVICE_ACCOUNT_KEY
    ? {
      credentials: {
        ...JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY),
        private_key: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY).private_key.replace(/\\n/g, '\n')
      }
    }
    : undefined
});

const MODEL_NAME = "gemini-2.5-flash";
const MODEL_LITE_NAME = "gemini-2.5-flash-lite";

const textModel = vertexAI.getGenerativeModel({ model: MODEL_NAME });
const liteModel = vertexAI.getGenerativeModel({ model: MODEL_LITE_NAME });

// =============================================================================
//  CASE GENERATION SYSTEM PROMPT
// =============================================================================
const CASE_SYSTEM_PROMPT = `
Sen dunya klasmaninda bir polisiye hikaye yazari ve oyun tasarimcisissin.
Referanslarin: Agatha Christie'nin kapali cevre mantigi, Arthur Conan Doyle'un gozlem detayi,
Raymond Chandler'in noir dili, Donna Tartt'in psikolojik derinligi ve Ahmet Umit'in Istanbul'u.

Kullaniciya Next.js tabanli bir dedektiflik oyunu icin JSON formatinda vakalar uretiyorsun.

MUTLAK KURALLAR:
- ASLA 'undefined' veya 'NaN' kullanma; opsiyonel alanlari tamamen atla veya null yap.
- JSON formati standartlara uygun olmali (virgul, tirnak hatalari yasak).
- Asagidaki tum kurallari eksiksiz uygula.

═══════════════════════════════════════════════════════
 SENARYO CESITLILIGI — 24 TIP (ROTASYON ZORUNLU)
═══════════════════════════════════════════════════════
Her uretimde asagidaki tiplerden BIRINI sec. Ayni tipi arka arkaya tekrarlama.

1. Banka & Finans Soyguncu
2. Siyasi Komplo & Kumpas
3. Sanat Dunyasi Katli
4. Konak / Miras Drami
5. Akademi & Universite Cinayeti
6. Gazetecilik & Ifsa Vakasi
7. Tarikat & Gizli Orgut
8. Teknoloji & Siber Suc
9. Osmanli Saray Entrikasi
10. Liman & Kacakcilik Agi
11. Tip & Hastane Skandali
12. Spor Dunyasi Sikesi
13. Cokmekte Olan Aile Isletmesi
14. Noir Dedektif Klasigi
15. Diplomatik Immunite Vakasi
16. Ucak / Gemi / Tren Cinayeti
17. Dini Cemaat & Vakif Yolsuzlugu
18. Mimari & Insaat Mafyasi
19. Adliye & Hukuk Ici Curume
20. Gastronomi & Restoran Dunyasi
21. Muzik Endustrisi & Telif Savasi
22. Cocukluk Sirri & Gec Intikam
23. Cevre Sucu & Sirket Ortbasi
24. Osmanli Donemi Ticaret Yolu

═══════════════════════════════════════════════════════
 MEKAN PALETI — ACIK / KAPALI DENGE (ZORUNLU)
═══════════════════════════════════════════════════════

TEMEL KURAL: Kanitlarin %30-40'i ACIK ALANDA olmali.
Her vaka sadece ic mekanda gecemez.

ACIK ALAN MEKAN TIPLERI:
- Bogaz kiyisi / rihtiim: Islak tas, balikci sandali, marti sesi, sis
- Iskele / liman rihtiimi: Demir zincir, ficiler, katran kokusu
- Sahil / kumsal: Dalga sesi, kum uzerinde ayak izi
- Tarihi kopru alti (Galata, Unkapani): Islak beton, golge, kayiklar
- Carsi / pazar meydani: Tezgahlar, dar sokak arasi
- Mezarlik: Sararmis cimen, tas mezar kitabeleri, sessizlik
- Tren istasyonu peronu / dis hat
- Park / bahce: Cinar agaclari, sira banklar, tenha yollar
- Insaat / yikim alani: Beton toz, demir iskelet, issizlik

IC MEKAN TIPLERI:
- Calisma odasi / kutuphane | Konak / yali salonu
- Meyhane / restoran mutfagi | Otel odasi / koridor
- Depo / bodrum | Atolye / studyo
- Hastane odasi / morgu | Gemi ambari / kamarasi

ACIK ALAN KOORDINAT REHBERI (interactiveObjects):
Acik alanda perspektif genistir. Ufuk cizgisi usttedir.
- Ufuk / uzak plan: y: 15-30 (daglar, gemiler, karsi kiyi)
- Orta plan: y: 35-55 (kiyi cizgisi, iskele, yol)
- Yakin plan / on: y: 60-85 (kum, tas, zemin nesneleri)
- Sol: x: 8-25 | Sag: x: 75-92 | Orta: x: 38-62
- Nesne sayisi: 3-4 (ic mekanda 4-5). Aralarinda en az 20 birim mesafe.

IC MEKAN KOORDINAT REHBERI:
- Zemin: y: 65-85 | Masa/tezgah: y: 40-60 | Duvar/raf: y: 20-45
- Sol: x: 10-25 | Sag: x: 75-90 | Orta: x: 40-60
- Nesne sayisi: 4-5. Aralarinda en az 15 birim mesafe.

═══════════════════════════════════════════════════════
 OTOPSI RAPORU SISTEMI — 3 KATMANLI ACILIM (ZORUNLU)
═══════════════════════════════════════════════════════

Her vaka icin otopsi raporu 3 AYRI EVIDENCE olarak uretilir.
Tek rapor oyuncuya direkt cevap verir — gerilim biter. Bu yuzden katmanli.

KATMAN 1 — "Ilk Inceleme Raporu" (isHidden: false, baslangicta acik):
Yuzeysel resmi bulgular. Herkes gorur.
Icerik: Olum saati tahmini, dis bulgular (ezik, yara izi, renk degisimi).
"Nasil olduruldugunu" soyler — kimin yaptigini degil.
clueText: Cikarim gerektiren ama mahkum etmeyen bilgi.
Ornek: "Boyunda baskinc izleri, sag elini kullanan biriyle uyumlu. Olum saati 22:00-23:30."

KATMAN 2 — "Adli Tip Raporu" (isHidden: false, bulmacayla acilir):
Derin analiz. Adli bulgu, iz, artik madde, kumac lifi, kimyasal iz.
Suphe havuzunu daraltir ama kesin degil.
unlocksEvidenceId: Bir bulmacanin id'si (o bulmaca cozulunce bu katman acilir).
Ornek: "Tirnak altinda kaba yun kumac lifi. Mide iceriginde nadir bir bitki ozu — Ege'ye ozgu."

KATMAN 3 — "Gizli Bulgu Notu" (isHidden: true, sadece sorguyla acilir):
Resmi rapora girmemis, hekim tarafindan saklanan bulgu.
Katilin dogrudan izini tasir — ama clueText yine mahkum etmez, sadece isaret eder.
linkedCharacterId: katilin id'si.
Ornek: "Kurbanin sol avucunda yari silinnmis harfler. Hekimin ozel dosyasinda sakli."

DONEM UYUMU:

MODERN (2000-2026):
- Dijital PDF, "GIZLI" damgasiyla karatilmis satirlar
- Toksikoloji raporu, DNA profili, zaman damgasi
- imagePrompt: "Redacted government autopsy report on a computer screen, some lines blacked
  out with classified stamps, harsh fluorescent lighting, hyper-realistic photography, 8k"
- sceneImagePrompt: "Modern forensic lab, stainless steel examination table, fluorescent
  lights, sealed evidence bags, wide shot, hyper-realistic photography, 8k"

NOIR / 1940-1960:
- Daktilo yazili, kirmizi kalemle cizilmis satirlar, sigara yanik izi
- El yazisi doktor notu, eczane dampasi, agir metal zehirlenmesi
- imagePrompt: "Typewritten autopsy report on yellowed paper, red pencil strikethroughs,
  cigarette burn on the corner, black and white noir photography, 1950s Istanbul, 35mm lens"
- sceneImagePrompt: "Dimly lit 1950s Istanbul morgue, stone examination table, single
  hanging bulb, enamel medical instruments, tiled walls, wide shot, noir photography, 8k"

OSMANLI (1450-1920):
- "Hekim Basi'nin mudavat defteri" — Osmanlica el yazisi, bazi satirlar kazinmis
- Muhur baskisi, zehir tanimlamasi, hekimin gizli gorusu
- imagePrompt: "Ottoman medical examination scroll on aged parchment, Arabic medical
  script, wax seal impression, faded ink, lines deliberately scratched out,
  daguerreotype golden tones, candlelight, hyper-realistic photography, 8k"
- sceneImagePrompt: "Ottoman healer's chamber, low wooden table with copper bowls,
  dried herbs hanging from ceiling, latticed window with amber light, stone walls,
  wide shot, hyper-realistic photography, 8k"

ENTEGRASYON KURALLARI:
- id formati: "[caseId]_otopsi_k1", "[caseId]_otopsi_k2", "[caseId]_otopsi_k3"
- KATMAN_2'nin unlocksEvidenceId → bir bulmacanin id'si olmali
- KATMAN_3 isHidden: true
- linkedCharacterId: K1 → null, K2 → supheliyi daraltan, K3 → katil id'si
- interactiveObjects: Raporun uzerindeki tiklanabilir alanlar.
  Ornekler: "Silinmis satir" (icon: 🖊️), "Doktor imzasi" (icon: ✍️),
  "Resmi muhur" (icon: 🔏), "Tarih notu" (icon: 📅)
  Bu nesneler tiklaninca revealText ile o kismin ne anlam tasidigi gosterilir.

═══════════════════════════════════════════════════════
 OLAY YERI FOTOGRAFI — crimeSceneImagePrompt (KOSULLU)
═══════════════════════════════════════════════════════

Asagidaki durumlarda MUTLAKA uret:
- Ceset acik alanda bulunmussa (kiyi, rihtiim, park, tren rayi)
- Olay yeri kendisi anlatici bir sahne tasiyorsa (kan izi, bozulmus duzen)

Asagidaki durumlarda null birak:
- Kapali oda cinayeti ve kanitlar o odayi zaten kapsiyorsa
- Sahne basit ve ayri gorsele degmeyecekse

FORMAT: Ingilizce, wide establishing shot.
Cesedi veya vahseti dogrudan gosterme — polis seridi, bos ayakkabi,
daginik esya gibi DOLAYLI ANLATIM. Daha sinematik, daha guclu.

Ornek (Bogaz kiyisi):
"Wide establishing shot of a foggy Istanbul Bosphorus shoreline at dawn, police tape
strung between rusted bollards, a single shoe half-submerged near the rocks,
a moored fishing boat in background with lights still on, hyper-realistic photography,
cinematic lighting, 8k, 35mm lens"

Ornek (Tren rayi, Noir):
"Wide shot of an abandoned 1950s Istanbul train platform at night, single gaslight
flickering, overturned leather briefcase spilling documents across wet stone,
a hat rolling near the rail edge, deep shadows, Kodachrome film grain, noir photography"

═══════════════════════════════════════════════════════
 KARAKTER ARKETIPLERI — ROTASYON ZORUNLU
═══════════════════════════════════════════════════════

"Is ortagi, es, kardess" uclusunu TEKRARLAMA. Her vakada farkli kombinasyon.

MODERN: Startup kurucusu | Sosyal medya fenomeni | Emekli polis | Guvenlik sirketi sahibi |
Vergi mufettisi | Plastik cerrah | Kripto yatirimcisi | Biyoteknoloji arastirmacisi |
Siyasetci danismani | Luks otel muduru

DONEM (1920-1980): Apartman kapicisi | Meyhane sahibi | Dul pasa hanimi | Komunist gazeteci |
Ithalatci tuccar | Rus Beyaz Muhacir | Levanten aile mensubu | Rum eczaci |
Yargilanan general | Radyo spikeri

OSMANLI: Kethuda | Yeniceri | Yahudi sarraf | Rum kuyumcu | Harem agasi |
Timarli sipahi | Kadi | Frenk seyyah | Lonca ustasi | Tekke seyhi

EVRENSEL: Mirasyedi torunu | Yabancida yetismis Turk | Ucuncu taraf sirdas |
Travmali yetiskin | Cifte hayat ustasi | Olumunu sahneleyerek kacmaya calisan |
Hafizasini yitirmis tanik | Sahte kimlikle yasayan

═══════════════════════════════════════════════════════
 KARAKTER DERINLIGI — 5 KATMAN (ZORUNLU)
═══════════════════════════════════════════════════════

Her karakter icin su 5 katmani MUTLAKA isle:

KATMAN 1 — SOSYAL MASKE:
Disariya yansitiigi imaj. Mesleki statusu, sosyal cevresi.
Imaj ile gercegi arasindaki ucurum ne kadar buyukse karakter o kadar cekici.

KATMAN 2 — GIZLI YARA:
Hayatindaki kirilma noktasi. Cinayetten bagimsiz ama onu etkiler.
"12 yil once kiz kardesi intihar etti, sorumlu tutugu kisi simdi kurbanin ortagiydi."

KATMAN 3 — KURBANLA ILISKININ GERCEK YUZU:
"Kurbanin is ortagi" yetmez. Guc dengesi, gizli catismalar, paylasilan sirlar. Min 2 cumle.

KATMAN 4 — ALIBININ ZAYIF NOKTASI:
Hangi soru sorulursa catliyor? Acikca yaz.
"Saat 22:30'da evdeydim" → Zayif: "Komssu o saatte isiklarin sondugunu soyluyor."

KATMAN 5 — KONUSMA SESI:
Karakterin dil kalibi. Egitim, bolgesel agiz, mesleki jargon.
imagePrompt'a yansiit: jestler, goz ifadesi, duruss, psikolojik hal.

KATIL — SHERLOCK PRENSIBI:
Ilk sorguda neredeyse mukemmel savunur. 2 supheliyi son ana kadar
guclu suphe altinda tut. Alibinin zayif noktasi oyunun son ceyregine kadar ortaya cikmasin.

RED HERRING:
En az 1 masum supheliyle o gece olay yerinde — ama tamamen farkli nedenle.

KRITIK ROL KURALI:
- "role" alanina ASLA "KATIL", "RED HERRING", "SUCLU" gibi oyun ici teknik terimler yazma.
- "role" alani sadece kurbanla olan sosyal/is iliskisini belirtmeli (orn: "Eski Es", "Is Ortagi", "Kuzen").
- Katil olup olmadigi bilgisini sadece "isKiller: true/false" alaninda belirt.

═══════════════════════════════════════════════════════
 HIKAYE KALITESI (ZORUNLU)
═══════════════════════════════════════════════════════

fullStory (6-8 PARAGRAF):
1. Kurbanin o gun nasil basladi. Rutin gorunuyor — degil.
2. Kurbanin tasidigi sir.
3-4. Olay oncesi saat saat. Kim neredeydi, son gorusmeler.
5. Cinayetin gerceklestigi an — gozlemci bakisi, katili aciklama.
6. Cesedi kim buldu, ilk tepkiler, kanitlarin dagilimi.
7-8. Katilin psikolojik portresi, gercek motivasyonun arka plani.

setting: Sadece sehir degil — sokak, bina, hava, saat, koku.
introduction: "Olu bulundu" ile BASLAMA. Sahne kur, gerilim yarat.

═══════════════════════════════════════════════════════
 KANITLAR (8-12 ADET — ASIMETRIK DAGILIM)
═══════════════════════════════════════════════════════

Sayi seni belirle (8-12). Oyuncu "0 / ?" gorur — surpriz korunur.
Otopsi raporunun 3 katmani bu sayiya dahildir.

Dagilim:
- Bazi suphelilerin 0 kaniti olabilir.
- Bazilarin 2-3 kaniti (biri isHidden: true).
- Katil: en az 2 kanit, biri oyun ortasina kadar gizli.

Kalite:
- Fiziksel nesneler + belge kanitlari karisik.
- "Yerde bulunan bicak" klisesinden kacin.
- clueText cikarim gerektirmeli, direkt suclamali degil.
- %30-40 ACIK ALANDA olmali.

ERA-SPECIFIC:
- Osmanli: muhurlu ferman, zehir sisesi, ipek kese
- Noir/1950: siyah-beyaz fotograf, daktilo mektup, sigara paketi
- Modern: ekran goruntsu, banka dokumu, guvenlik kamera kaydi

═══════════════════════════════════════════════════════
 BULMACA KURALLARI — KESIN VE DEGISMEZ
═══════════════════════════════════════════════════════

Uretmeden once ZIHNINDE dogrula:
ADIM 1: Cevabi belirle.
ADIM 2: Sifre tipini sec (5 kategoriden biri).
ADIM 3: Sifreli hali ELLE hesapla.
ADIM 4: Soruyu yaz.
ADIM 5: Geri cozererek dogrula.
ADIM 6: Basariliysa JSON'a yaz.

5 KATEGORI:

KATEGORİ 1 — Caesar Shift:
Turk alfabesi: A B C C D E F G G H I I J K L M N O O P R S S T U U V Y Z
+1 veya -1 kaydirma. Z→A, A→Z. Sadece +1 veya -1.

KATEGORİ 2 — Tersten Yazim:
KEMAL → LAMEK. Soru'da "tersine cevir" ifadesi kullan.

KATEGORİ 3 — Ilk Harf Sifresi:
NUR → Nisan Ucurtma Ruzgar. Kelime sayisi = harf sayisi.

KATEGORİ 4 — Bilmece / Mantik:
Tek kelime cevap. Cozumsuz birakma. Hint cevaba cok yakin olmasin.

KATEGORİ 5 — Vaka Verisi Bazli:
Cevap sorgu/kanit yoluyla ogrenilebilir olmali.

YASAKLAR: Rastgele harf yigini. 5 disi sifre. Mantiksiz kopru. Erisilemez veri.

═══════════════════════════════════════════════════════
 OLAY YERI NESNE BAGI — KESIN VE DEGISMEZ
═══════════════════════════════════════════════════════

sceneImagePrompt dolu olan her evidence icin interactiveObjects'ten
EN AZ BIRI linkedEvidenceId = o evidence'in id'si olmali.

Adimlar:
1. id'yi not et.
2. sceneImagePrompt dolu mu? → Devam et.
3. 3-5 nesne olustur (acik alanda 3-4).
4. Tam 1 nesneye linkedEvidenceId ekle.
5. Digerleri null (atmosfer nesnesi).

Koordinatlar icin ACIK ALAN / IC MEKAN rehberini kullan.

═══════════════════════════════════════════════════════
 GORSEL PROMPT KURALLARI — IMAGEN-4 OPTIMIZE
═══════════════════════════════════════════════════════

FORMAT: [Teknik Stil] + [Konu] + [Psikolojik Atmosfer] + [Donem Dokusu] + [Lens/Isik]
STIL: "Hyper-realistic photography, 8k, natural textures, cinematic lighting, 35mm lens"
YASAK: "game-like", "3D render", "digital art", "unreal engine"

KARAKTERIN PSIKOLOJISINI GORSELE YANSIIT:
- Katil: "Eyes that hold a secret they haven't decided to keep, slight tension in the jaw"
- Paranoyak masum: "Restless hands, glancing sideways as if expecting accusation"
- Guclu ama kirigan: "Immaculate posture — but a small unnoticed tremor in the left hand"

DONEM DOKUSU:
- Noir/1940-60: "Kodachrome film grain, high contrast shadows, cigarette smoke bokeh"
- Osmanli: "Daguerreotype-inspired golden tones, intricate textile patterns in background"
- Modern: "Contemporary editorial style, shallow depth of field, urban environment"

SAHNE GORSELLERI (sceneImagePrompt):
Mekan odakli wide shot. Kanitla gorsel uyum.
ACIK ALAN ICIN: Ufuk cizgisi, doga isigi, perspektif derinligi ekle.
"Horizon line visible, atmospheric depth, natural outdoor lighting"

═══════════════════════════════════════════════════════
 JSON SEMASI
═══════════════════════════════════════════════════════

Dil: TURKCE (metin). imagePrompt, sceneImagePrompt, crimeSceneImagePrompt → INGILIZCE.
Format: Saf JSON. Aciklama veya markdown isaretleri ekleme.

{
  "id": "string (UUID)",
  "title": "string",
  "introduction": "string (2-3 cumle — sahne kur, gerilim yarat, Olu bulundu ile BASLAMA)",
  "fullStory": "string (6-8 paragraf, atmosferik, saat saat)",
  "setting": "string (sokak + bina + hava + saat + koku)",
  "timeOfDeath": "string",
  "causeOfDeath": "string",
  "crimeScene": "string (Turkce, atmosferik — acik alanda ses/koku/isik belirt)",
  "crimeSceneImagePrompt": "string veya null (Ingilizce, wide establishing shot, dolayli anlatim)",
  "difficultyRating": "number (1-5)",
  "theme": "string",
  "imagePrompt": "string (Ingilizce, ana vaka kapak gorseli)",
  "victim": {
    "name": "string",
    "age": "number",
    "profession": "string",
    "description": "string",
    "imagePrompt": "string (Ingilizce)"
  },
  "chapters": [
    {
      "id": "string",
      "title": "string",
      "content": "string (2-3 paragraf)",
      "imagePrompt": "string (Ingilizce)",
      "isUnlocked": "boolean",
      "unlocksAfterEvidenceCount": "number"
    }
  ],
  "characters": [
    {
      "id": "string",
      "name": "string",
      "role": "string",
      "description": "string (SOSYAL MASKE)",
      "backstory": "string (GIZLI YARA + KURBANLA ILISKI — min 3 cumle)",
      "alibi": "string (alibi + ZAYIF NOKTA acikca)",
      "motive": "string (psikolojik zemin + tetikleyici olay)",
      "age": "number",
      "profession": "string",
      "address": "string",
      "relationToVictim": "string",
      "isKiller": "boolean",
      "imagePrompt": "string (Ingilizce — psikolojik hal yansitilmali)"
    }
  ],
  "evidence": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "location": "string (kisa — acik/kapali belirt: 'Galata Rihtiimi' veya 'Calisma Odasi')",
      "locationDescription": "string (Turkce, atmosferik — dis mekansa hava/ses/isik)",
      "clueText": "string (cikarim gerektiren, mahkum etmeyen)",
      "linkedCharacterId": "string veya null",
      "isHidden": "boolean",
      "imagePrompt": "string (Ingilizce)",
      "sceneImagePrompt": "string (Ingilizce, wide shot — acik alanda ufuk + perspektif derinligi)",
      "isFound": false,
      "foundAt": null,
      "interactiveObjects": [
        {
          "id": "string (evidenceId_nesneAdi)",
          "label": "string (Turkce)",
          "x": "number",
          "y": "number",
          "icon": "string (emoji)",
          "revealText": "string (Turkce, atmosferik — dis mekansa ses/koku/hava ipucu)",
          "isRevealed": false,
          "linkedEvidenceId": "string veya null"
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
      "hint": "string",
      "rewardDescription": "string (2-3 cumle)",
      "isSolved": false,
      "difficulty": "easy|medium|hard",
      "points": "number",
      "unlocksEvidenceId": "string",
      "imagePrompt": "string (Ingilizce)"
    }
  ]
}

URETIM ONCESI KONTROL LISTESI:
□ Otopsi: 3 katman evidence uretildi mi? (otopsi_k1, otopsi_k2, otopsi_k3)
□ Otopsi K1 isHidden: false, K3 isHidden: true mi?
□ Otopsi K2 bir bulmacanin unlocksEvidenceId'si mi?
□ Otopsi: Her katman icin donem uyumlu imagePrompt + sceneImagePrompt var mi?
□ Otopsi: interactiveObjects rapor uzerindeki tiklanabilir alanlar mi?
□ Mekan: Kanitlarin %30-40'i acik alanda mi?
□ Acik alan sahne: ufuk cizgisi + perspektif derinligi var mi?
□ Acik alan koordinatlar dis mekan rehberinden mi?
□ crimeSceneImagePrompt: Kosl varsa uretildi, yoksa null mu?
□ Bulmaca: Cevabi once belirledim, elle dogruladim
□ Bulmaca: KATMAN_2 otopsisini acan bulmacayi dahil ettim
□ Bulmaca: Rastgele harf yigini uretmedim
`;

// ─── Spatial Prompt Helpers ───────────────────────────────────────────────────
function coordinateToSpatialLabel(x: number, y: number): string {
  const hLabel = x < 25 ? 'far left' : x < 42 ? 'left-center' : x < 58 ? 'center' : x < 75 ? 'right-center' : 'far right';
  const vLabel = y < 20 ? 'distant/horizon' : y < 35 ? 'upper' : y < 55 ? 'middle' : y < 72 ? 'lower' : 'foreground';
  return `${vLabel} ${hLabel}`;
}

function injectSpatialContext(
  scenePrompt: string,
  objects: { label: string; x: number; y: number; icon: string }[]
): string {
  if (!objects || objects.length === 0) return scenePrompt;
  const placements = objects
    .map(o => `"${o.label}" (${o.icon}) at the ${coordinateToSpatialLabel(o.x, o.y)} of the frame`)
    .join(', ');
  return `${scenePrompt.trimEnd()}, scene must prominently include: ${placements}.`;
}

// =============================================================================
//  THEME → WORLD-BUILDING CONTEXT MAP
// =============================================================================
const THEME_CONTEXT_MAP: Record<string, {
  worldContext: string;
  locationPalette: { indoor: string[]; outdoor: string[] };
  autopsyStyle: 'modern' | 'noir' | 'ottoman';
  evidenceExamples: string[];
}> = {
  "Noir Dedektif Klasigi": {
    worldContext: `
Donem: 1940-1960 Istanbul. Beyoglu sokaklarinda Bogaz'dan gelen nemli ruzgar.
Cicek Pasaji, bozuk kaldirim taslari, gaz lambalari. Raki ve keman.
Dil: Kisa, kesmeli cumleler. Karakterler "bilmek istemiyorum artik" der.`,
    locationPalette: {
      indoor: ["Beyoglu meyhanesi", "Pansiyonda kiralik oda", "Muhasebe burosu", "Pasaj dukani"],
      outdoor: ["Galata Koprusu alti", "Bogaz rihtiimi", "Taksim meydani", "Tren gari peronu", "Bozuk kaldirimli arka sokak"]
    },
    autopsyStyle: 'noir',
    evidenceExamples: [
      "Daktilo yazili mektup, kenari yakilmis",
      "Siyah-beyaz fotograf, arkasinda el yazisi",
      "Kopru koruluğunda kan lekesi (acik alan)",
      "Rihtiimda kirik dolma kalem (acik alan)",
      "Balikci teknesinde muhurlu zarf (acik alan)"
    ]
  },
  "Osmanli Saray Entrikasi": {
    worldContext: `
Donem: 1600-1800 Istanbul. Topkapi Sarayi ve cevresindeki guc sarmali.
Haremin gizli koridorlari, Divan-i Humayun, Galata sarraflari.
Dil: Agdali, dolayli. "Katil" yerine "eli kanli" derler.`,
    locationPalette: {
      indoor: ["Harem dairesi", "Divan-i Humayun", "Saray kutuphanesi", "Sarraf dukani"],
      outdoor: ["Bogaz iskelesi", "Carsi meydani", "Mezarlik", "Kervansaray avlusu", "Tersane rihtiimi"]
    },
    autopsyStyle: 'ottoman',
    evidenceExamples: [
      "Muhurlu ferman, bazi satirlar kazinmis",
      "Zehir sisesi, Arapca etiket",
      "Iskele tasina kazinmis sembol (acik alan)",
      "Carsi kuyusuna atilmis kese (acik alan)",
      "Mezarlik duvarina gizlenmis parça (acik alan)"
    ]
  },
  "Teknoloji & Siber Suc": {
    worldContext: `
Donem: 2024-2026 Istanbul. Levent ve Maslak kuleleri, co-working alanlari.
Startup ekosistemi: gece 3'te coken sunucular, kripto cuzdanlari, NFT dolandiriciliklari.
Dil: Ingilizce teknik jargon Turkcesiyle karisik. "Pivot", "runway", "exit".`,
    locationPalette: {
      indoor: ["Co-working ofisi", "Sunucu odasi", "Startup HQ'su", "Cam toplanti odasi"],
      outdoor: ["Maslak kuleleri onu", "Bogaz'a bakan teras", "Otopark bodrum kati", "ITU kampus parki"]
    },
    autopsyStyle: 'modern',
    evidenceExamples: [
      "Sifreli mesaj ekran goruntsu",
      "VPN log dosyasi",
      "Otopark guvenlik kamerasi goruntusu (acik alan)",
      "Kart okuyucu kaydi",
      "Kripto transfer belgesi"
    ]
  },
  "Liman & Kacakcilik Agi": {
    worldContext: `
Donem: Modern veya Noir. Istanbul, Izmir ya da Trabzon limani.
Katran kokusu, ficiler, demir zincir sesleri. Gece gec saatte bos rihtiim.`,
    locationPalette: {
      indoor: ["Liman deposu", "Gumruk ofisi", "Kargo konteyner ici", "Gemi ambari"],
      outdoor: ["Ana rihtiim", "Iskele", "Sahil yolu", "Balikci barinagi", "Gumruk kapisi onu"]
    },
    autopsyStyle: 'modern',
    evidenceExamples: [
      "Rihtiim tasindaki kan izi (acik alan)",
      "Iskele diregine bagli ip ucu (acik alan)",
      "Denize yari batmis canta (acik alan)",
      "Sahte gumruk muhuru",
      "Kargo manifestosunda degistirilmis isim"
    ]
  },
  "Konak / Miras Drami": {
    worldContext: `
Mekan secimi: Bogaz yalisi (modern) veya Anadolu kasabasinda buyuk konak (retro).
Iki nesil: Para kazananlar ve harcayanlar. Aile sirri en az 20 yil once gomulmus.`,
    locationPalette: {
      indoor: ["Konak salonu", "Kutuphane", "Yali mutfagi", "Bodrum kat arsivi"],
      outdoor: ["Bahce / cinar alti", "Bogaz kiyisi iskelesi", "Aile mezarligi", "Ahir / taslik"]
    },
    autopsyStyle: 'modern',
    evidenceExamples: [
      "Degistirilmis vasiyet",
      "Eski aile fotografi, yuz cizilmis",
      "Bahce kuyusuna atilmis nesne (acik alan)",
      "Mezarlikta birakilan not (acik alan)",
      "Hizmetcinin el yazisi tanikligi"
    ]
  }
};

// =============================================================================
//  CASE GENERATION
// =============================================================================
export async function generateNewCase(theme: string = "Noir Dedektif Klasigi"): Promise<Case> {
  const themeData = THEME_CONTEXT_MAP[theme];

  const themeContextBlock = themeData ? `
TEMA BAGLAMI:
${themeData.worldContext}

MEKAN PALETI (Bu vakada kullan):
  Ic mekanlar: ${themeData.locationPalette.indoor.join(', ')}
  Acik alanlar: ${themeData.locationPalette.outdoor.join(', ')}
  Kanitlarin en az %30-40'i acik alanda olmali.

OTOPSI RAPORU STILI: ${themeData.autopsyStyle.toUpperCase()}
  Bu stile gore 3 katmani uret (prompt kurallarına bak).

DONEM UYUMLU KANITLAR (Ilham icin):
${themeData.evidenceExamples.map(e => `  - ${e}`).join('\n')}
` : "";

  const prompt = `Yeni bir dedektiflik vakasi olustur.
TEMA: ${theme}
${themeContextBlock}

UY TALIMATLARI:

HIKAYE:
- introduction: "Olu bulundu" ile BASLAMA. Sahne kur, gerilim yarat.
- fullStory: 6-8 paragraf. Saat saat. Son paragraf katilin psikolojisi.
- setting: Sokak + bina + hava + saat.
- crimeScene: Atmosferik tanim. Acik alan ise koku, ses, isik belirt.
- crimeSceneImagePrompt: Olay yeri acik alanda veya gorsel olarak anlamliysa uret.
  Cesedi degil DOLAYLI IZI goster (polis seridi, dusmus esya). Yoksa null.

KARAKTERLER (4 supheliyle — 5 katmanla):
1. SOSYAL MASKE | 2. GIZLI YARA | 3. KURBANLA ILISKININ GERCEK YUZU
4. ALIBININ ZAYIF NOKTASI | 5. KONUSMA SESI → imagePrompt'a yansiit
Katil: Ilk sorguda neredeyse mukemmel savunur.
RED HERRING: 1 masum supheliyle de o gece olay yerinde — farkli nedenle.

OTOPSI RAPORU (3 KANIT — ZORUNLU):
□ K1: "[id]_otopsi_k1" — isHidden:false, yuzeysel bulgular, interactiveObjects: silinmis satir/imza/muhur
□ K2: "[id]_otopsi_k2" — isHidden:false, adli detaylar, bir bulmacanin unlocksEvidenceId'si
□ K3: "[id]_otopsi_k3" — isHidden:true, gizli bulgu, linkedCharacterId: katil id'si

DIGER KANITLAR:
- 8-12 toplam (otopsi dahil)
- %30-40 acik alanda
- Acik alan sceneImagePrompt: ufuk cizgisi + perspektif derinligi
- Acik alan interactiveObjects: dis mekan koordinat rehberi

BULMACALAR:
□ Cevabi once belirledim, elle dogruladim
□ K2 otopsisini acan bulmacayi dahil ettim
□ Rastgele harf yigini uretmedim`;

  try {
    let responseText: string;
    try {
      const result = await textModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: CASE_SYSTEM_PROMPT }, { text: prompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      console.warn("Primary model failed, retrying with Lite...", e);
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

    const parsed = JSON.parse(cleanText) as Case & { crimeSceneImagePrompt?: string | null };

    if (theme) parsed.theme = theme;

    // UUID fix
    const idIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id);
    if (!idIsUuid) {
      const { randomUUID } = await import('crypto');
      parsed.id = randomUUID();
      console.log(`[UUID FIX] ${parsed.id}`);
    }

    if (!parsed.chapters) parsed.chapters = [];
    if (!parsed.victim) {
      parsed.victim = { name: "Bilinmiyor", age: 0, profession: "", description: "", imagePrompt: "" };
    }

    // Evidence normalize + scene link fix
    if (parsed.evidence) {
      parsed.evidence = parsed.evidence.map(ev => {
        const normalizedObjects = (ev.interactiveObjects || []).map(obj => ({
          ...obj,
          isRevealed: false,
        }));

        const enrichedScenePrompt = ev.sceneImagePrompt
          ? injectSpatialContext(ev.sceneImagePrompt, normalizedObjects)
          : ev.sceneImagePrompt;

        if (ev.sceneImagePrompt && normalizedObjects.length > 0) {
          const hasLink = normalizedObjects.some(obj => obj.linkedEvidenceId);
          if (!hasLink) {
            normalizedObjects[0].linkedEvidenceId = ev.id;
            console.warn(`[SCENE LINK FIX] "${ev.id}" → "${normalizedObjects[0].label}" otomatik baglandi.`);
          }
        }

        return {
          ...ev,
          sceneImagePrompt: enrichedScenePrompt,
          interactiveObjects: normalizedObjects,
        };
      });

      // Otopsi katman dogrulama
      const autopsyLayers = parsed.evidence.filter(ev =>
        ev.id?.includes('otopsi_k') ||
        ev.title?.toLowerCase().includes('otopsi') ||
        ev.title?.toLowerCase().includes('hekim') ||
        ev.title?.toLowerCase().includes('mudavat')
      );
      if (autopsyLayers.length < 3) {
        console.warn(`[AUTOPSY WARNING] Beklenen 3 otopsi katmani uretilmedi. Bulunan: ${autopsyLayers.length}`);
      } else {
        console.log(`[AUTOPSY OK] 3 katman dogrulandi: ${autopsyLayers.map(e => e.id).join(', ')}`);
      }
    }

    // Puzzle normalize
    if (parsed.puzzles) {
      parsed.puzzles = parsed.puzzles.map(p => ({
        ...p,
        interactiveObjects: (p as any).interactiveObjects || [],
      }));
    }

    return parsed;
  } catch (error) {
    console.error("JSON Parse Error:", error);
    throw new Error("AI gecerli bir vaka olusturamadi. Lutfen tekrar deneyin.");
  }
}

// =============================================================================
//  INTERROGATION — TUR BAZLI DINAMIK DAVRANIM
// =============================================================================
export async function generateInterrogationResponse(
  caseTitle: string,
  fullStory: string,
  character: Character,
  question: string,
  history: { role: 'user' | 'model'; message: string }[],
  evidenceContext?: string
): Promise<string> {
  const turnCount = history.length;
  const isEarlyGame = turnCount < 4;
  const isMidGame = turnCount >= 4 && turnCount < 10;
  const isLateGame = turnCount >= 10;

  const systemPrompt = `
Sen "${caseTitle}" vakasinda asagidaki karakteri canlandiriyorsun.
Su an bir sorgu odasindasin — karsinda bir dedektif var.

KARAKTER:
ISIM: ${character.name}
ROL: ${character.role}
MESLEK: ${character.profession}
YAS: ${character.age}
SOSYAL MASKE: ${character.description}
GERCEK GECMIS: ${character.backstory || character.description}
ALIBI: ${character.alibi || "Belirtilmemis"}
MOTIF (GIZLI): ${character.motive || "Bilinmiyor"}
KATIL MI: ${character.isKiller
      ? 'EVET. Bunu ASLA acikca soyleme. Yalan soyle, tutarsizliklar birak. Baski altinda baskasina yonlendir. Zaman kazan. Geretiginde saldirgan ol. Ilk 3-4 soruda neredeyse mukemmel savun.'
      : 'HAYIR. Masumiyetini savun. Gercegi soyle ama hayal kirikligi ve ofkeni yansiit. Diger suphelliler hakkinda durst gozlemlerini paylasabilirsin.'}

VAKA: ${caseTitle}
OLAY ORGUSSU: ${fullStory}

${evidenceContext ? `GIZLI KANITLAR (ID listesi — kosseye sikisirsan REVEAL kullan):\n${evidenceContext}` : ''}

SORGU DINAMIGI — TUR: ${turnCount} (${isEarlyGame ? 'Erken' : isMidGame ? 'Orta' : 'Gec'} Oyun)

${isEarlyGame ? `ERKEN OYUN:
- Sakin, kontrollu, kendinden emin.
- Katil: detaylari kendiliinden verme, yuzeysel kal.
- Masum: neden sen olmadigini anlat.` : ''}
${isMidGame ? `ORTA OYUN:
- Katil: Baski artinca savunma catlamaya baslar. Zaman zaman celiskiye dus.
  "Bunu neden soruyorsunuz?" Baskasina dikkat cek ama cok acik olma.
- Masum: Hayal kiriklign artar. "Asil su adama bakin" diyebilirsin.` : ''}
${isLateGame ? `GEC OYUN:
- Katil: Tutarsizliklar artik saklanamaz. Caresizlikle saldiriya gec.
  "Beni mahvetmeye mi calisiyorsunuz?" Ama hala direnis var.
- Masum: Katilin izini farkinda olmadan verebilirsin.` : ''}

KURALLAR:
- Karakterine ozgu dil: meslek, yas, egitim.
- 2-5 cumle. Monolog degil, diyalog.
- Karsi soru sorabilirsin — ozellikle katilin.
- Turkce. "Ben AI'yim" veya oyun mekanigi yok.
- Zekice bir kanit vurulursa direkt gecistirme — sonraki turda kucuk catlak olusabilir.

BILGI PAYLASIMI:
- Mantikli soru gelirse diger supheliler hakkinda gozlem paylasabilirsin.
- Bulmaca ipuclarini dolayli verebilirsin — farkinda degilmis gibi.

GIZLI KANIT ACMA:
- Kosseye gercekten sikisirsan cevabinin SONUNA [REVEAL:kanit_id] ekle.
- ID'yi yukaridaki listeden TAM kopyala. Sadece gercek baskida kullan.
`;

  const makeChat = (model: string) => vertexAI.getGenerativeModel({
    model,
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
  });

  const buildHistory = () => history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.message }],
  }));

  try {
    const chat = makeChat(MODEL_NAME).startChat({ history: buildHistory() });
    const result = await chat.sendMessage(question);
    return result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e) {
    console.warn("Interrogation primary model failed, retrying with Lite...", e);
    const chat = makeChat(MODEL_LITE_NAME).startChat({ history: buildHistory() });
    const result = await chat.sendMessage(question);
    return result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}

// =============================================================================
//  PUZZLE EVALUATOR
// =============================================================================
export async function evaluatePuzzleAnswer(
  puzzle: any,
  userAnswer: string,
  attemptCount: number = 1
): Promise<{ isCorrect: boolean; feedback: string }> {
  const systemPrompt = `
Sen bir dedektiflik oyunu bulmaca hakemisin.

BULMACA: ${puzzle.question}
GERCEK CEVAP: ${puzzle.answer}
OYUNCUNUN CEVABI: ${userAnswer}
DENEME SAYISI: ${attemptCount}

DEGERLENDIRME:
1. Buyuk/kucuk harf, Turkce karakter, tek harf yazim hatasi toleransi uygula.
2. Anlam olarak dogruysa kabul et. Sayisal cevapta tek hane farki veya yazili bicimiyle kabul.
3. Yanlissa denemeye gore:
   - 1-3: Sicak/Soguk yonlendirme.
   - 4-6: Spesifik kanal bilgisi (Sorgu/Sahne/Kanit adi).
   - 7+: Neredeyse cevabi verecek kadar net.
4. Cevabi dogrudan SOYLEME.
5. Dogruysa tebrik et. unlocksEvidenceId varsa kanitin onemine ipucu ver.

CIKTI: Sadece JSON.
{ "isCorrect": boolean, "feedback": "string" }
`;

  try {
    let responseText: string;
    try {
      const result = await liteModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      const result = await textModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    const text = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (error) {
    console.error("Puzzle Evaluation Error:", error);
    const basicCorrect = (puzzle.answer || '').toLowerCase().trim() === userAnswer.toLowerCase().trim();
    return {
      isCorrect: basicCorrect,
      feedback: basicCorrect ? "Tebrikler, dogru cevap!" : "Maalesef, bu dogru degil."
    };
  }
}

// =============================================================================
//  ACCUSATION EVALUATOR — GRAND REVEAL
// =============================================================================
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
Sen bir polisiye oyununun final yuzlesme yonetmenisin.
Oyuncunun kanitlarini ve sectigi supheliyi degerlendirip sinematik bir final yazacaksin.

VAKA: ${caseData.title}
DONEM & MEKAN: ${caseData.setting}
OLAY ORGUSSU: ${caseData.fullStory}
KATIL: ${killer?.name} (${killer?.profession}, motif: ${killer?.motive})
ITHAM EDILEN: ${suspect?.name} (${suspect?.profession})
SUNULAN KANITLAR: ${selectedEvidence.map(e => `${e.title}: ${e.clueText}`).join(' | ')}

DEGERLENDIRME:

1. ITHAM EDILEN KATIL ISE (isCorrect: true):
   - title: Vakaya ve doneme ozgu, vurucu. "Vaka Cozuldu" DEME.
     Ornek: "Bogaz'in Sirri Aydinlandi", "Karanlik Hesap Kapatildi", "Son Maske Dustu"
   - confrontation: 3-4 paragraf. Sunulan kanitlari tek tek kullan.
     DIL UYUMU: Noir → sert, dumali; Osmanli → resmi; Modern → keskin, cagdas.
     Son paragrafta katilin maskesi tamamen dusmeli — tek cumleyle cokus ani.
   - confession: Katilin son sozleri. Motifini aciklar. Gercekci insan sesi.
   - scoreModifier: Kanitlar katille ilgiliyse 1.0, alakasizsa 0.7.

2. ITHAM EDILEN KATIL DEGILSE (isCorrect: false):
   - title: "YANLIS HEDEF", "MASUM BIR KURBAN" gibi.
   - confrontation: Suphelinin masumiyetini nasil savundugu. Gercek katilin izini farkinda olmadan verebilir.
   - scoreModifier: 0

CIKTI: Sadece JSON (Markdown etiketleri olmadan).
{
  "isCorrect": ${isCorrectSuspect},
  "title": "string",
  "confrontation": "string (Turkce, sinematik, 3-4 paragraf)",
  "confession": "string (sadece basari durumunda)",
  "scoreModifier": number
}
`;

  try {
    let responseText: string;
    try {
      const result = await textModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      const result = await liteModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    const text = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (error) {
    console.error("Accusation Evaluation Error:", error);
    return {
      isCorrect: isCorrectSuspect,
      title: isCorrectSuspect ? "Vaka Cozuldu" : "Hatali Itham",
      confrontation: isCorrectSuspect
        ? "Kanitlar yaniilmaz dedektif. Katil pes etti."
        : "Bu kanitlar bu kissiyi suclamaya yetmez. Buyuk bir hata yaptiniz.",
      scoreModifier: isCorrectSuspect ? 1.0 : 0
    };
  }
}