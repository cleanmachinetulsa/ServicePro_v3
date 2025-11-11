import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateIcons() {
  const sourceImage = join(__dirname, '../attached_assets/generated_images/Clean_Machine_badge_circular_ff904963.png');
  const publicDir = join(__dirname, '../public');

  console.log('Generating PWA icons from:', sourceImage);

  try {
    // Generate 192x192 icon
    await sharp(sourceImage)
      .resize(192, 192, { 
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-192.png'));
    console.log('✓ Created icon-192.png');

    // Generate 512x512 icon
    await sharp(sourceImage)
      .resize(512, 512, { 
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-512.png'));
    console.log('✓ Created icon-512.png');

    console.log('\n✅ PWA icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
