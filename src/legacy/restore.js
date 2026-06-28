import part1 from './payload-1.js';
import part2 from './payload-2.js';
import part3 from './payload-3.js';
import part4 from './payload-4.js';
import part5 from './payload-5.js';

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function restoreLegacyApp() {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support the decompression required to load Stixio. Please use an up-to-date Chrome, Edge, Safari, or Firefox browser.');
  }

  const compressed = decodeBase64(part1 + part2 + part3 + part4 + part5);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const html = await new Response(stream).text();

  document.open();
  document.write(html);
  document.close();
}

restoreLegacyApp().catch(error => {
  console.error(error);
  document.body.innerHTML = `
    <main style="font-family:system-ui,sans-serif;max-width:720px;margin:80px auto;padding:24px;line-height:1.6">
      <h1>Stixio 載入失敗</h1>
      <p>${error.message}</p>
      <p><a href="./next.html">開啟新版實驗介面</a></p>
    </main>
  `;
});
