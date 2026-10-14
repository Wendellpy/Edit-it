const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Vector SVG definition for BolSub Studio Favicon
// Features:
// - Neo-brutalist tactile offset shadow in #142218
// - Signature BolSub electric lime background #A3E635
// - Bold, crisp 28px border in #142218
// - Signature Fraunces-style 'B' with subtitle bars [==]
function getSvg(size = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <!-- Soft Neobrutal drop shadow -->
  <rect x="56" y="56" width="424" height="424" rx="108" fill="#142218" />
  
  <!-- Main Badge Container -->
  <rect x="32" y="32" width="424" height="424" rx="108" fill="#A3E635" stroke="#142218" stroke-width="28" stroke-linejoin="round" />
  
  <!-- Subtle inner video caption frame notch -->
  <path d="M120 84 h248 c20 0 36 16 36 36 v16 c0-11-9-20-20-20 H140 c-11 0-20 9-20 20 v-16 c0-20 16-36 36-36 z" fill="#142218" opacity="0.12" />

  <!-- Iconic 'B' (Crafted with display serif elegance and high-retention impact) -->
  <g fill="#142218">
    <!-- Main stem with top and bottom base serifs -->
    <path d="M142 128 h136 c48 0 82 22 82 62 0 30 -18 52 -46 60 36 10 56 36 56 68 0 46 -38 72 -92 72 H142 c-6 0 -10 -4 -10 -10 V138 c0 -6 4 -10 10 -10 z" />
    
    <!-- Top inner bowl cut out -->
    <path d="M214 182 h54 c20 0 32 9 32 24 0 16 -12 25 -32 25 h-54 v-49 z" fill="#A3E635" />
    
    <!-- Bottom inner bowl cut out -->
    <path d="M214 263 h58 c22 0 36 10 36 27 0 17 -14 28 -36 28 h-58 v-55 z" fill="#A3E635" />
  </g>

  <!-- Video Subtitle / Closed Caption accent pills (Representing BolSub speech captions) -->
  <rect x="316" y="334" width="76" height="22" rx="11" fill="#142218" />
  <rect x="328" y="341" width="52" height="8" rx="4" fill="#A3E635" />
</svg>`;
}

async function main() {
  const svg512 = getSvg(512);

  // 1. Write SVG to src/app/icon.svg and public/favicon.svg
  fs.writeFileSync(path.join(__dirname, '../src/app/icon.svg'), svg512);
  fs.writeFileSync(path.join(__dirname, '../public/favicon.svg'), svg512);
  console.log('✓ Created src/app/icon.svg and public/favicon.svg');

  // 2. Generate PNGs at various resolutions
  const sizes = [16, 32, 48, 64, 180, 192, 512];
  const pngBuffers = {};

  for (const size of sizes) {
    const buf = await sharp(Buffer.from(getSvg(size)))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers[size] = buf;
  }

  // Write Apple Touch Icon
  fs.writeFileSync(path.join(__dirname, '../public/apple-icon.png'), pngBuffers[180]);
  fs.writeFileSync(path.join(__dirname, '../src/app/apple-icon.png'), pngBuffers[180]);
  console.log('✓ Created apple-icon.png (180x180)');

  // Write PWA Icons
  fs.writeFileSync(path.join(__dirname, '../public/icon-192.png'), pngBuffers[192]);
  fs.writeFileSync(path.join(__dirname, '../public/icon-512.png'), pngBuffers[512]);
  console.log('✓ Updated public/icon-192.png and public/icon-512.png');

  // 3. Assemble multi-resolution ICO file (16x16, 32x32, 48x48)
  const icoSizes = [16, 32, 48];
  const icoBuffers = icoSizes.map((s) => pngBuffers[s]);

  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(icoSizes.length, 4); // Number of images

  // Directory entries: 16 bytes each
  const dirSize = 16 * icoSizes.length;
  let offset = 6 + dirSize;

  const dirBuffers = [];
  for (let i = 0; i < icoSizes.length; i++) {
    const s = icoSizes[i];
    const imgBuf = icoBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s === 256 ? 0 : s, 0); // Width
    entry.writeUInt8(s === 256 ? 0 : s, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(imgBuf.length, 8); // Image size in bytes
    entry.writeUInt32LE(offset, 12); // Offset
    offset += imgBuf.length;
    dirBuffers.push(entry);
  }

  const icoFile = Buffer.concat([header, ...dirBuffers, ...icoBuffers]);

  fs.writeFileSync(path.join(__dirname, '../src/app/favicon.ico'), icoFile);
  fs.writeFileSync(path.join(__dirname, '../public/favicon.ico'), icoFile);
  console.log(`✓ Created favicon.ico with 16x16, 32x32, 48x48 (${icoFile.length} bytes)`);
}

main().catch(console.error);
