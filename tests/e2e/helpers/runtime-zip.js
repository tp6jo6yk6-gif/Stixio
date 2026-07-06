export async function installRuntimeZip(page) {
  await page.addInitScript(() => {
    const decodeBase64 = async value => {
      const response = await fetch(`data:application/octet-stream;base64,${value}`);
      return new Uint8Array(await response.arrayBuffer());
    };

    class RuntimeZipFile {
      constructor(entry) {
        this.entry = entry;
        this.dir = false;
      }

      async async(type) {
        if (this.entry.kind === 'text') {
          if (type === 'uint8array') return new TextEncoder().encode(this.entry.value);
          if (type === 'base64') return this.entry.value;
          return this.entry.value;
        }

        if (type === 'base64') return this.entry.value;
        const bytes = await decodeBase64(this.entry.value);
        if (type === 'uint8array') return bytes;
        if (type === 'string') return new TextDecoder().decode(bytes);
        return bytes.buffer;
      }
    }

    class RuntimeZip {
      constructor() {
        this.entries = {};
        this.files = {};
      }

      file(path, value, options = {}) {
        if (arguments.length === 1) return this.files[path] || null;
        const entry = options.base64
          ? { kind: 'base64', value: String(value) }
          : { kind: 'text', value: String(value) };
        this.entries[path] = entry;
        this.files[path] = new RuntimeZipFile(entry);
        return this;
      }

      async generateAsync(_options, onUpdate) {
        const paths = Object.keys(this.entries);
        onUpdate?.({ percent: 25, currentFile: paths[0] || null });
        onUpdate?.({ percent: 100, currentFile: paths.at(-1) || null });
        return new Blob([JSON.stringify(this.entries)], { type: 'application/zip' });
      }

      async loadAsync(blob) {
        const entries = JSON.parse(await blob.text());
        const archive = new RuntimeZip();
        archive.entries = entries;
        archive.files = Object.fromEntries(Object.entries(entries).map(([path, entry]) => [path, new RuntimeZipFile(entry)]));
        return archive;
      }
    }

    window.JSZip = RuntimeZip;
    window.lucide = { createIcons() {} };
  });

  await page.route(/cdn\.tailwindcss\.com/, route => route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind={};' }));
  await page.route(/unpkg\.com\/lucide/, route => route.fulfill({ contentType: 'application/javascript', body: 'window.lucide={createIcons(){}};' }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip/, route => route.fulfill({ contentType: 'application/javascript', body: '' }));
}
