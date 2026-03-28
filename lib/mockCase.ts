import { Case } from "@/types/game";

export const MOCK_CASE: Case = {
  id: "demo-vaka-101",
  title: "Büyükada Palas Cinayeti",
  theme: "Noir / 1950'ler",
  setting: "Büyükada, Tarihi Palas Oteli - Suit 302",
  introduction: "1954 yılının sisli bir Kasım akşamı. Büyükada'nın en görkemli oteli Palas'ta, otel sahibi Selim Bey odasında ölü bulundu. Kapı içeriden kilitliydi.",
  fullStory: "Selim Bey, oteli satmayı planlıyordu. Bu durum otel çalışanlarını ve mirasçılarını huzursuz etmişti. Yeğeni Can'ın kumar borçları vardı. Hizmetçi Emine ise Selim Bey'in gizli bir davasına tanıktı. Rakip otel sahibi Vedat, Selim Bey'i piyasadan silmek istiyordu. Katil, havalandırma boşluğunu kullanarak odaya girmiş ve Selim Bey'i zehirli bir iğneyle öldürmüştü.",
  timeOfDeath: "22:30 - 23:00 arası",
  causeOfDeath: "Zehirli iğne (Siyanür türevi)",
  crimeScene: "Suit 302, Master Yatak Odası",
  difficultyRating: 3,
  imagePrompt: "1950s noir detective scene, a grand hotel suite with velvet curtains and a body on the floor, cinematic lighting",
  generatedImageUrl: "https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=1000&auto=format&fit=crop",
  
  victim: {
    name: "Selim Aksoy",
    age: 62,
    profession: "Otel Sahibi",
    description: "Zengin, otoriter ve titiz bir iş adamı.",
    imagePrompt: "Portrait of an elderly dignified businessman in a 1950s suit, black and white noir style",
  },
  
  characters: [
    {
      id: "char-1",
      name: "Emine Hanım",
      role: "Hizmetçi",
      description: "20 yıldır otelde çalışıyor. Selim Bey'in her sırrını biliyor.",
      backstory: "Selim Bey'in vefat eden eşinin en yakın sırdaşıydı.",
      alibi: "O saatlerde mutfakta gümüşleri parlatıyordum.",
      motive: "Selim Bey oteli satarsa işsiz kalacaktı.",
      age: 55,
      profession: "Baş Hizmetçi",
      address: "Büyükada, Palas Müştemilatı",
      relationToVictim: "Çalışan",
      isKiller: false,
      imagePrompt: "1950s maid uniform, anxious expression, noir lighting",
      generatedImageUrl: "https://images.unsplash.com/photo-1581403341630-a6e0b9d2d257?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: "char-2",
      name: "Can Aksoy",
      role: "Yeğen / Mirasçı",
      description: "Lüks düşkünü, sorumsuz bir genç.",
      backstory: "Kumar borçları yüzünden tefecilerle başı belada.",
      alibi: "Bahçede hava alıyordum, kimse beni görmedi.",
      motive: "Amcasının mirası borçlarını kapatmaya yetecekti.",
      age: 28,
      profession: "İşsiz / Mirasçı",
      address: "Nişantaşı, İstanbul",
      relationToVictim: "Yeğen",
      isKiller: true,
      imagePrompt: "Handsome but shady young man in 1950s tuxedo, holding a glass, noir style",
      generatedImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop"
    }
  ],
  
  evidence: [
    {
      id: "ev-1",
      title: "Antika Gümüş Bıçak",
      description: "Üzerinde Selim Bey'in baş harfleri kazınmış, hafifçe bükülmüş bir bıçak.",
      imagePrompt: "Antique silver knife on a wooden floor, cinematic lighting, macro",
      generatedImageUrl: "https://images.unsplash.com/photo-1579349429415-fae260955681?q=80&w=1000&auto=format&fit=crop",
      isFound: false,
      location: "Yatak Altı",
      locationDescription: "Karyolanın hemen altında, tozların arasında parlıyor.",
      clueText: "Bıçak kesmek için değil, bir şeyi zorlayarak açmak için kullanılmış gibi görünüyor.",
      interactiveObjects: [
        {
          id: "obj-1",
          label: "Bıçak Kabzası",
          x: 45,
          y: 60,
          icon: "🔪",
          revealText: "Kabzada garip bir yapışkanlık var. Kan değil, sanki bir tür reçine.",
          isRevealed: false,
          linkedEvidenceId: "ev-1"
        }
      ],
      sceneImageUrl: "https://images.unsplash.com/photo-1550433161-554477841f3e?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: "ev-2",
      title: "Yırtılmış Makbuz",
      description: "Büyük miktarda bir para transferine ait banka makbuzu.",
      imagePrompt: "Torn paper receipt with handwriting, old paper texture",
      generatedImageUrl: "https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?q=80&w=1000&auto=format&fit=crop",
      isFound: false,
      location: "Çalışma Masası",
      locationDescription: "Evrak çantasının arkasına gizlenmiş.",
      clueText: "Makbuz Can Aksoy adına düzenlenmiş. Tarih cinayet gününden bir gün öncesi.",
      isHidden: true // Sadece sorguyla açılır demo için
    },
    {
      id: "ev-3",
      title: "Hizmetçi Şerife'nin Günlüğü",
      description: "Yıpranmış, deri kaplı bir defter. Bazı sayfaları koparılmış.",
      imagePrompt: "An old worn leather notebook on a small table, noir lighting, highly detailed",
      generatedImageUrl: "https://images.unsplash.com/photo-1516414447565-b14be0afa13e?q=80&w=1000&auto=format&fit=crop",
      isFound: false,
      location: "Mutfak Hattı",
      locationDescription: "Eski bir mutfak dolabının en alt rafında, örtülerin altına gizlenmiş.",
      clueText: "Günlükte Selim Bey'in yeğeni Can ile yaptığı şiddetli bir tartışmadan bahsediliyor.",
      interactiveObjects: [
        {
          id: "obj-3",
          label: "Gizli Bölme",
          x: 20,
          y: 80,
          icon: "📚",
          revealText: "Dolabın köşesinde sahte bir tahta fark ediyorsun. Arkasında bu günlüğü saklamışlar.",
          isRevealed: false,
          linkedEvidenceId: "ev-3"
        }
      ],
      sceneImageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=1000&auto=format&fit=crop"
    }
  ],
  
  puzzles: [
    {
      id: "puzzle-1",
      type: "code",
      title: "Çelik Kasa Şifresi",
      question: "Selim Bey'in kasasının şifresi, en sevdiği yılın tersidir. Selim Bey 1954 yılında bu oteli açtığına göre şifre ne olabilir?",
      answer: "4591",
      hint: "Yılı tersinden okumayı dene.",
      rewardDescription: "Kasa açıldı! İçerisinde Can Aksoy adına düzenlenmiş gizli bir banka makbuzu bulundu. Bu makbuz, cinayetten hemen önce yapılan büyük bir para transferini kanıtlıyor.",
      isSolved: false,
      difficulty: "easy",
      points: 200,
      unlocksEvidenceId: "ev-2",
      generatedImageUrl: "https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=1000&auto=format&fit=crop"
    }
  ],
  
  chapters: [
    {
      id: "chap-1",
      title: "Giriş: Kanlı Gece",
      content: "Büyükada'nın huzuru, bir çığlıkla bölündü. Suit 302'den yükselen feryat, bir devrin kapandığının habercisiydi.",
      imagePrompt: "Grand hotel corridor at night, long shadows, noir style",
      isUnlocked: true,
      unlocksAfterEvidenceCount: 0
    }
  ]
};
