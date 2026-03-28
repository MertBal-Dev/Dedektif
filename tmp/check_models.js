async function listAllModels() {
  // DİKKAT: Buraya yeni oluşturduğun, güvenli API anahtarını yazmalısın.
  const apiKey = "AIzaSyCS4ToYg7vergc6KWlnWgpS2JirezoaHXA";
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    console.log("--- API Anahtarına Tanımlı Tüm Modeller Çekiliyor ---\n");

    // REST API'ye GET isteği atıyoruz
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Hatası: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.models && data.models.length > 0) {
      data.models.forEach(model => {
        console.log(`✅ Model ID: ${model.name}`);
        console.log(`   Görünen Ad: ${model.displayName}`);
        console.log(`   Durum: ${model.version}`);
        // Modelin hangi işlemleri desteklediğini gösterir (generateContent, countTokens vb.)
        console.log(`   Desteklenen İşlemler: ${model.supportedGenerationMethods.join(", ")}`);
        console.log("------------------------------------------");
      });
      console.log(`\n🎉 Toplam ${data.models.length} adet model başarıyla listelendi.`);
    } else {
      console.log("Bu API anahtarına tanımlı herhangi bir model bulunamadı.");
    }

  } catch (error) {
    console.error("❌ Kritik Hata:", error.message);
  }
}

listAllModels();