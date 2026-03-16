import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Resolve directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public', 'images');
const GAMES_JSON = path.join(PROJECT_ROOT, 'public', 'data', 'games.json');

async function convertImages() {
  console.log('🚀 Starting image conversion to WebP...');
  
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`❌ Error: Directory not found: ${IMAGES_DIR}`);
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR);
  const imageFiles = files.filter(file => /\.(jpe?g|png)$/i.test(file));

  if (imageFiles.length === 0) {
    console.log('ℹ️ No images to convert.');
    return;
  }

  console.log(`🔍 Found ${imageFiles.length} images. Processing...`);

  let successCount = 0;
  let skippedCount = 0;

  for (const file of imageFiles) {
    const filePath = path.join(IMAGES_DIR, file);
    const fileName = path.parse(file).name;
    const outputFileName = `${fileName}.webp`;
    const outputPath = path.join(IMAGES_DIR, outputFileName);

    try {
      // Skip if WebP already exists and is newer than source (optional optimization)
      if (fs.existsSync(outputPath)) {
        const sourceStat = fs.statSync(filePath);
        const outputStat = fs.statSync(outputPath);
        if (outputStat.mtime > sourceStat.mtime) {
          skippedCount++;
          continue;
        }
      }

      await sharp(filePath)
        .webp({ quality: 80 }) // 80 is a good balance between size and quality
        .resize({ width: 1200, withoutEnlargement: true }) // Fix "larger than needed" issue
        .toFile(outputPath);
      
      console.log(`✅ Converted: ${file} -> ${outputFileName}`);
      
      // Delete original after successful conversion
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted original: ${file}`);
      
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to convert ${file}:`, error.message);
    }
  }

  console.log(`\n🎉 Conversion complete!`);
  console.log(`- Success: ${successCount}`);
  console.log(`- Skipped: ${skippedCount}`);

  // Optional: Update games.json to use .webp extensions
  await updateGamesJson();
}

async function updateGamesJson() {
  try {
    if (!fs.existsSync(GAMES_JSON)) {
      console.log('ℹ️ games.json not found, skipping update.');
      return;
    }

    const data = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf-8'));
    let updatedCount = 0;

    data.forEach(game => {
      if (game.coverImage && /\.(jpe?g|png)$/i.test(game.coverImage)) {
        // Only update if it points to a file in /images/
        if (game.coverImage.startsWith('/images/')) {
          const webpPath = game.coverImage.replace(/\.(jpe?g|png)$/i, '.webp');
          // Check if the webp actually exists
          const fullWebpPath = path.join(PROJECT_ROOT, 'public', webpPath);
          if (fs.existsSync(fullWebpPath)) {
            game.coverImage = webpPath;
            updatedCount++;
          }
        }
      }
    });

    if (updatedCount > 0) {
      fs.writeFileSync(GAMES_JSON, JSON.stringify(data, null, 2));
      console.log(`📝 Updated ${updatedCount} entries in games.json to use WebP.`);
    }
  } catch (error) {
    console.error('❌ Failed to update games.json:', error.message);
  }
}

convertImages().catch(console.error);
