const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testImage() {
  const prompt = "A mysterious detective in a dark alley, movie still, highly detailed";
  const apiKey = process.env.POLLINATIONS_API_KEY;
  const model = "zimage";
  const seed = 42;
  const encodedPrompt = encodeURIComponent(prompt + ", movie still, highly detailed, dramatic lighting, detective noir atmosphere");
  
  const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?key=${apiKey}&model=${model}&width=800&height=800&seed=${seed}`;
  
  console.log('Testing URL:', imageUrl);
  
  try {
    const response = await fetch(imageUrl);
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    
    if (response.ok) {
      console.log('✅ Success! Image generated.');
    } else {
      const text = await response.text();
      console.error('❌ Failed:', text);
    }
  } catch (err) {
    console.error('❌ Error during fetch:', err);
  }
}

testImage();
