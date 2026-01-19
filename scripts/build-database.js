#!/usr/bin/env node

/**
 * Build SQLite database from ARC Raiders data repository
 * Icons sourced from ARC Raiders Fandom Wiki
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import { createWriteStream } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import {
  parseItem,
  extractRecipes,
  extractBenches,
  extractRecycling,
  extractSalvaging,
  extractCategories,
} from "./data-parser.js";

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const staticDir = path.join(projectRoot, "static");
const finalDbPath = path.join(staticDir, "data", "items.db");
const finalIconsDir = path.join(staticDir, "images", "items");
const schemaPath = path.join(staticDir, "schema.sql");

let tempDir;
let tempDbPath;
let tempIconsDir;

const REPO_URL =
  "https://github.com/RaidTheory/arcraiders-data/archive/refs/heads/main.tar.gz";

const WIKI_PAGES = [
  "https://arc-raiders.fandom.com/wiki/Items",
  "https://arc-raiders.fandom.com/wiki/Trinkets",
  "https://arc-raiders.fandom.com/wiki/Weapons",
  "https://arc-raiders.fandom.com/wiki/Attachments",
  "https://arc-raiders.fandom.com/wiki/Ammunition",
  "https://arc-raiders.fandom.com/wiki/Shields",
  "https://arc-raiders.fandom.com/wiki/Grenades",
  "https://arc-raiders.fandom.com/wiki/Gadgets",
  "https://arc-raiders.fandom.com/wiki/Medical",
  "https://arc-raiders.fandom.com/wiki/Blueprints",
  "https://arc-raiders.fandom.com/wiki/Augments",
];

const SAVE_IMAGE_MAP = process.env.SAVE_IMAGE_MAP === "true";

/**
 * Normalize item name to match database ID format
 */
function normalizeItemName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Strip to bare alphanumeric for fuzzy comparison
 * Also normalizes roman numerals to arabic
 */
function stripToAlphanumeric(str) {
  return str
    .toLowerCase()
    .replace(/png$/i, "")        // Remove "png" suffix first (before alphanumeric stripping)
    .replace(/[^a-z0-9]/g, "")
    .replace(/viii$/, "8")
    .replace(/vii$/, "7")
    .replace(/vi$/, "6")
    .replace(/iv$/, "4")
    .replace(/v$/, "5")
    .replace(/iii$/, "3")
    .replace(/ii$/, "2")
    .replace(/i$/, "1");
}

/**
 * Strip tier number from end of string
 * "anvil2" -> "anvil", "arpeggio1" -> "arpeggio"
 */
function stripTier(str) {
  return str.replace(/\d+$/, "");
}

/**
 * Compute Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d = Array.from({ length: m + 1 }, (_, i) => i);

  for (let j = 1; j <= n; j++) {
    let prev = d[0];
    d[0] = j;
    for (let i = 1; i <= m; i++) {
      const temp = d[i];
      d[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, d[i], d[i - 1]);
      prev = temp;
    }
  }
  return d[m];
}

/**
 * Compute similarity score (0-1) between two strings
 */
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Find best matching wiki image for an item ID
 * Uses two-phase matching:
 * 1. Try exact tier-specific match (e.g., silencer_ii -> silencer_ii)
 * 2. Fall back to base name match only if no high-confidence tier match (e.g., anvil_ii -> anvil)
 */
function findBestMatch(itemId, wikiImageMap, threshold = 0.8) {
  const strippedItemId = stripToAlphanumeric(itemId);
  const baseName = stripTier(strippedItemId);

  let bestMatch = null;
  let bestScore = threshold;

  // PHASE 1: Try exact tier-specific match
  for (const [key, url] of wikiImageMap) {
    const strippedKey = stripToAlphanumeric(key);
    const score = similarity(strippedItemId, strippedKey);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { url, score, matchedKey: key };
    }
  }

  // PHASE 2: Base name fallback (only if no high-confidence match)
  if (bestScore < 0.95 && baseName.length > 0) {
    for (const [key, url] of wikiImageMap) {
      const strippedKey = stripToAlphanumeric(key);
      const keyBaseName = stripTier(strippedKey);

      if (baseName === keyBaseName) {
        const baseMatchScore = 0.9;

        if (baseMatchScore > bestScore) {
          bestScore = baseMatchScore;
          bestMatch = { url, score: baseMatchScore, matchedKey: key };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Fetch HTML content from URL
 */
async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

/**
 * Extract image URLs from Fandom wiki page HTML
 */
function extractImageUrls(html) {
  const imageMap = new Map();

  const allImages = [
    ...html.matchAll(
      /https:\/\/static\.wikia\.nocookie\.net\/arc-raiders\/images\/[a-f0-9]\/[a-f0-9]{2}\/([^"'\s]+\.png)/gi,
    ),
  ];

  for (const match of allImages) {
    const fullUrl = match[0].split("/revision/")[0];
    const filename = match[1];
    const itemName = filename.replace(/\.png$/i, "").replace(/_/g, " ");
    const normalizedId = normalizeItemName(itemName);

    if (!imageMap.has(normalizedId)) {
      imageMap.set(normalizedId, fullUrl);
    }
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];

    const imgMatch =
      /(?:src|data-src)="(https:\/\/static\.wikia\.nocookie\.net\/arc-raiders\/images\/[^"]+)"/i.exec(
        rowContent,
      );
    if (!imgMatch) continue;

    let imageUrl = imgMatch[1].split("/revision/")[0];

    const linkPatterns = [
      /<a[^>]+title="([^"]+)"[^>]*href="\/wiki\//i,
      /<a[^>]+href="\/wiki\/([^"]+)"[^>]*>/i,
    ];

    let itemName = null;
    for (const pattern of linkPatterns) {
      const nameMatch = pattern.exec(rowContent);
      if (nameMatch) {
        itemName = nameMatch[1].replace(/_/g, " ");
        break;
      }
    }

    if (itemName) {
      const normalizedId = normalizeItemName(itemName);
      imageMap.set(normalizedId, imageUrl);
    }
  }

  return imageMap;
}

/**
 * Scrape all wiki pages and build complete image URL map
 */
async function scrapeWikiImageUrls() {
  console.log("Scraping Fandom wiki for icon URLs...");

  const allImages = new Map();

  for (const pageUrl of WIKI_PAGES) {
    try {
      const pageName = pageUrl.split("/wiki/")[1];
      console.log(`  Fetching ${pageName}...`);
      const html = await fetchPage(pageUrl);
      const pageImages = extractImageUrls(html);

      console.log(`    Found ${pageImages.size} images`);

      for (const [id, url] of pageImages) {
        allImages.set(id, url);
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.warn(`  Failed to fetch ${pageUrl}: ${err.message}`);
    }
  }

  console.log(`  Total: ${allImages.size} unique icon URLs from wiki`);

  if (SAVE_IMAGE_MAP) {
    const mapPath = path.join(staticDir, "data", "wiki-images.json");
    await fs.mkdir(path.dirname(mapPath), { recursive: true });
    await fs.writeFile(
      mapPath,
      JSON.stringify(Object.fromEntries(allImages), null, 2),
    );
    console.log(`  Saved image map to ${mapPath}`);
  }

  return allImages;
}

/**
 * Download and extract the GitHub repository
 */
async function downloadAndExtract() {
  console.log("Downloading ARC Raiders data...");

  tempDir = await fs.mkdtemp(path.join(tmpdir(), "arcraiders-"));
  tempDbPath = path.join(tempDir, "items.db");
  tempIconsDir = path.join(tempDir, "icons");

  const tarPath = path.join(tempDir, "repo.tar.gz");

  await new Promise((resolve, reject) => {
    https
      .get(REPO_URL, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          https.get(response.headers.location, (redirectResponse) => {
            const fileStream = createWriteStream(tarPath);
            redirectResponse.pipe(fileStream);
            fileStream.on("finish", () => {
              fileStream.close();
              resolve();
            });
            fileStream.on("error", reject);
          });
        } else {
          const fileStream = createWriteStream(tarPath);
          response.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });
          fileStream.on("error", reject);
        }
      })
      .on("error", reject);
  });

  console.log("Extracting archive...");
  await execAsync(`tar -xzf ${tarPath} -C ${tempDir}`);

  return path.join(tempDir, "arcraiders-data-main");
}

/**
 * Create database and schema in temp directory
 */
async function createDatabase() {
  console.log("Creating database schema...");
  const db = new Database(tempDbPath);
  const schema = await fs.readFile(schemaPath, "utf-8");
  db.exec(schema);
  return db;
}

/**
 * Parse all item JSON files
 */
async function parseItems(dataDir) {
  const itemsDir = path.join(dataDir, "items");
  const files = await fs.readdir(itemsDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  console.log(`Parsing ${jsonFiles.length} items...`);

  const items = [];
  let skipped = 0;

  for (const file of jsonFiles) {
    try {
      const filePath = path.join(itemsDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const jsonData = JSON.parse(content);
      const itemData = parseItem(jsonData);
      itemData.categories = extractCategories(itemData);
      items.push(itemData);
    } catch (err) {
      console.warn(`Skipping ${file}: ${err.message}`);
      skipped++;
    }
  }

  if (skipped > 0) {
    console.log(`Skipped ${skipped} malformed files`);
  }

  return items;
}

/**
 * Extract unique categories from all items
 */
function collectUniqueCategories(items) {
  const categories = new Set();
  for (const item of items) {
    for (const category of item.categories) {
      categories.add(category);
    }
  }
  return categories;
}

/**
 * Insert items into database
 */
function insertItems(db, items) {
  console.log("Inserting data into database...");

  const insertItem = db.prepare(`
		INSERT INTO items (
			id, name, description, type, rarity, value, weight_kg,
			stack_size, found_in, is_weapon, blueprint_locked, is_craftable, effects, image_name, updated_at
		) VALUES (
			@id, @name, @description, @type, @rarity, @value, @weight_kg,
			@stack_size, @found_in, @is_weapon, @blueprint_locked, @is_craftable, @effects, @image_name, @updated_at
		)
	`);

  const insertRecipe = db.prepare(`
		INSERT INTO crafting_recipes (item_id, ingredient_id, quantity)
		VALUES (@item_id, @ingredient_id, @quantity)
	`);

  const insertBench = db.prepare(`
		INSERT INTO crafting_benches (item_id, bench_type, station_level)
		VALUES (@item_id, @bench_type, @station_level)
	`);

  const insertRecycling = db.prepare(`
		INSERT INTO recycling_outputs (item_id, output_id, quantity)
		VALUES (@item_id, @output_id, @quantity)
	`);

  const insertSalvaging = db.prepare(`
		INSERT INTO salvaging_outputs (item_id, output_id, quantity)
		VALUES (@item_id, @output_id, @quantity)
	`);

  const insertCategory = db.prepare(`
		INSERT OR IGNORE INTO item_categories (id, display_name)
		VALUES (@id, @display_name)
	`);

  const insertCategoryLink = db.prepare(`
		INSERT INTO item_category_links (item_id, category_id)
		VALUES (@item_id, @category_id)
	`);

  let recipeCount = 0,
    benchCount = 0,
    recyclingCount = 0,
    salvagingCount = 0,
    categoryLinkCount = 0;

  const insertAll = db.transaction((items, categories) => {
    for (const category of categories) {
      insertCategory.run({ id: category, display_name: category });
    }

    for (const item of items) {
      insertItem.run({
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type,
        rarity: item.rarity,
        value: item.value,
        weight_kg: item.weight_kg,
        stack_size: item.stack_size,
        found_in: item.found_in,
        is_weapon: item.is_weapon,
        blueprint_locked: item.blueprint_locked,
        is_craftable: Object.keys(item.recipe).length > 0 ? 1 : 0,
        effects: item.effects,
        image_name: `${item.id}.png`,
        updated_at: item.updated_at,
      });
    }

    for (const item of items) {
      for (const recipe of extractRecipes(item)) {
        insertRecipe.run(recipe);
        recipeCount++;
      }
      for (const bench of extractBenches(item)) {
        insertBench.run(bench);
        benchCount++;
      }
      for (const output of extractRecycling(item)) {
        insertRecycling.run(output);
        recyclingCount++;
      }
      for (const output of extractSalvaging(item)) {
        insertSalvaging.run(output);
        salvagingCount++;
      }
      for (const category of item.categories) {
        insertCategoryLink.run({ item_id: item.id, category_id: category });
        categoryLinkCount++;
      }
    }
  });

  const categories = collectUniqueCategories(items);
  insertAll(items, categories);

  return {
    items: items.length,
    recipes: recipeCount,
    benches: benchCount,
    recycling: recyclingCount,
    salvaging: salvagingCount,
    categories: categories.size,
    categoryLinks: categoryLinkCount,
  };
}

/**
 * Download icon from Fandom wiki
 */
async function downloadWikiIcon(imageUrl, targetPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const cleanUrl = imageUrl.split("/revision/")[0];

      const res = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "ArcRaidersDataBuilder/1.0 (community tool)",
          Accept: "image/png,image/webp,image/*",
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 404) return false;
        if (attempt < maxRetries) {
          await new Promise((r) =>
            setTimeout(r, 1000 * Math.pow(2, attempt - 1)),
          );
          continue;
        }
        return false;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 100) return false;

      await fs.writeFile(targetPath, buffer);
      return true;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) =>
          setTimeout(r, 1000 * Math.pow(2, attempt - 1)),
        );
        continue;
      }
      return false;
    }
  }
  return false;
}

/**
 * Fallback: fetch icon from arctracker CDN
 */
async function fetchIconFromCDN(itemId, targetPath, maxRetries = 3) {
  const cdnUrl = `https://cdn.arctracker.io/items/${itemId}.png`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(cdnUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 404) return false;
      if (!res.ok) {
        if (attempt < maxRetries) {
          await new Promise((r) =>
            setTimeout(r, 1000 * Math.pow(2, attempt - 1)),
          );
          continue;
        }
        return false;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(targetPath, buffer);
      return true;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) =>
          setTimeout(r, 1000 * Math.pow(2, attempt - 1)),
        );
        continue;
      }
      return false;
    }
  }
  return false;
}

/**
 * Download icons from wiki with fallbacks
 */
async function downloadIcons(items, wikiImageMap) {
  console.log("Downloading icons...");

  await fs.mkdir(tempIconsDir, { recursive: true });

  let fromWiki = 0,
    fromWikiFuzzy = 0,
    fromCDN = 0,
    missing = 0;
  const missingItems = [];
  const fuzzyMatches = [];
  const tierMatches = [];

  const batchSize = 10;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (item) => {
        const targetPath = path.join(tempIconsDir, `${item.id}.png`);

        const match = findBestMatch(item.id, wikiImageMap);

        if (match) {
          const success = await downloadWikiIcon(match.url, targetPath);
          if (success) {
            if (match.score === 1) {
              fromWiki++;
              // Track tier-specific exact matches
              if (/[_-](i{1,3}|iv|v|vi{0,2}|1|2|3|4|5|6|7|8)$/i.test(item.id)) {
                tierMatches.push({
                  item: item.id,
                  matched: match.matchedKey,
                  score: match.score.toFixed(2),
                });
              }
            } else {
              fromWikiFuzzy++;
              if (match.score < 0.95) {
                fuzzyMatches.push({
                  item: item.id,
                  matched: match.matchedKey,
                  score: match.score.toFixed(2),
                });
              }
            }
            return;
          }
        }

        const cdnSuccess = await fetchIconFromCDN(item.id, targetPath);
        if (cdnSuccess) {
          fromCDN++;
          return;
        }

        missing++;
        missingItems.push(item.id);
      }),
    );

    const progress = Math.min(i + batchSize, items.length);
    process.stdout.write(`\r  Progress: ${progress}/${items.length}`);

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log("");

  if (tierMatches.length > 0 && tierMatches.length <= 20) {
    console.log(`  Tier-specific matches:`);
    for (const m of tierMatches) {
      console.log(`    ${m.item} -> ${m.matched}`);
    }
  }

  if (fuzzyMatches.length > 0) {
    console.log(`  Fuzzy matches (review for accuracy):`);
    for (const m of fuzzyMatches) {
      console.log(`    ${m.item} -> ${m.matched} (${m.score})`);
    }
  }

  if (missing > 0) {
    console.log(`  Missing icons:`);
    for (const item of missingItems) {
      console.log(`    ${item}`);
    }
  }

  return { fromWiki, fromWikiFuzzy, fromCDN, missing };
}

/**
 * Move database and icons from temp to final location
 */
async function moveToFinalLocation() {
  await fs.mkdir(path.dirname(finalDbPath), { recursive: true });

  try {
    await fs.rm(finalIconsDir, { recursive: true, force: true });
  } catch (err) {}

  await fs.copyFile(tempDbPath, finalDbPath);
  await fs.cp(tempIconsDir, finalIconsDir, { recursive: true });
}

/**
 * Clean up temporary directory
 */
async function cleanup() {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`Failed to clean up temp directory: ${err.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const wikiImageMap = await scrapeWikiImageUrls();
    const dataDir = await downloadAndExtract();
    const db = await createDatabase();
    const items = await parseItems(dataDir);
    const stats = insertItems(db, items);
    const iconStats = await downloadIcons(items, wikiImageMap);

    db.close();

    await moveToFinalLocation();
    await cleanup();

    console.log("\nDatabase built successfully!");
    console.log(`Items: ${stats.items} | Recipes: ${stats.recipes}`);
    console.log(
      `Categories: ${stats.categories} | Links: ${stats.categoryLinks}`,
    );
    console.log(
      `Icons - exact: ${iconStats.fromWiki} | fuzzy: ${iconStats.fromWikiFuzzy} | CDN fallback: ${iconStats.fromCDN} | missing: ${iconStats.missing}`,
    );
  } catch (err) {
    console.error("Error building database:", err);
    await cleanup();
    process.exit(1);
  }
}

main();
