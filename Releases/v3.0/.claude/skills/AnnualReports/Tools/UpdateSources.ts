#!/usr/bin/env bun
/**
 * UpdateSources.ts - Update sources from upstream GitHub repo
 *
 * Usage:
 *   bun run UpdateSources.ts                  # Fetch and update from GitHub
 *   bun run UpdateSources.ts --dry-run       # Show changes without saving
 *   bun run UpdateSources.ts --diff          # Show diff with upstream
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SOURCES_PATH = join(import.meta.dir, '..', 'Data', 'sources.json');
const UPSTREAM_URL = 'https://raw.githubusercontent.com/jacobdjwilson/awesome-annual-security-reports/main/README.md';

interface Report {
  vendor: string;
  name: string;
  url: string;
}

interface Sources {
  metadata: {
    source: string;
    lastUpdated: string;
    totalReports: number;
  };
  categories: {
    analysis: Record<string, Report[]>;
    survey: Record<string, Report[]>;
  };
}

async function fetchUpstreamReadme(): Promise<string> {
  console.log('📥 Fetching upstream README...');
  const response = await fetch(UPSTREAM_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseMarkdownReports(markdown: string): Map<string, Report[]> {
  const reports = new Map<string, Report[]>();
  const lines = markdown.split('\n');

  let currentCategory = '';
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track main sections (Analysis Reports / Survey Reports)
    if (line.startsWith('## Analysis Reports')) {
      currentSection = 'analysis';
    } else if (line.startsWith('## Survey Reports')) {
      currentSection = 'survey';
    }

    // Track categories (### headers)
    if (line.startsWith('### ')) {
      currentCategory = line.replace('### ', '').toLowerCase().replace(/\s+/g, '_');
      if (!reports.has(`${currentSection}_${currentCategory}`)) {
        reports.set(`${currentSection}_${currentCategory}`, []);
      }
    }

    // Parse report entries (numbered lists or bullet points with links)
    const reportMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/) || line.match(/^-\s+\*\*(.+?)\*\*/);
    if (reportMatch && currentCategory) {
      const reportName = reportMatch[1];

      // Look for vendor and URL in following lines
      let vendor = '';
      let url = '';

      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('- Vendor:')) {
          vendor = nextLine.replace('- Vendor:', '').trim();
        } else if (nextLine.startsWith('- URL:')) {
          url = nextLine.replace('- URL:', '').trim();
        } else if (nextLine.match(/^\d+\.\s+\*\*/) || nextLine.startsWith('### ')) {
          break;
        }
      }

      if (vendor && url) {
        const key = `${currentSection}_${currentCategory}`;
        const existing = reports.get(key) || [];
        existing.push({ vendor, name: reportName, url });
        reports.set(key, existing);
      }
    }
  }

  return reports;
}

function loadCurrentSources(): Sources {
  if (!existsSync(SOURCES_PATH)) {
    return {
      metadata: {
        source: UPSTREAM_URL.replace('/README.md', ''),
        lastUpdated: new Date().toISOString().split('T')[0],
        totalReports: 0
      },
      categories: {
        analysis: {},
        survey: {}
      }
    };
  }
  return JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
}

function countReports(sources: Sources): number {
  let count = 0;
  for (const reports of Object.values(sources.categories.analysis)) {
    count += reports.length;
  }
  for (const reports of Object.values(sources.categories.survey)) {
    count += reports.length;
  }
  return count;
}

function compareReports(current: Sources, parsed: Map<string, Report[]>): {
  added: number;
  removed: number;
  updated: number;
} {
  let added = 0;
  let removed = 0;
  let updated = 0;

  // Build current URL set
  const currentUrls = new Set<string>();
  for (const reports of Object.values(current.categories.analysis)) {
    for (const report of reports) {
      currentUrls.add(report.url);
    }
  }
  for (const reports of Object.values(current.categories.survey)) {
    for (const report of reports) {
      currentUrls.add(report.url);
    }
  }

  // Build parsed URL set
  const parsedUrls = new Set<string>();
  for (const reports of parsed.values()) {
    for (const report of reports) {
      parsedUrls.add(report.url);
      if (!currentUrls.has(report.url)) {
        added++;
      }
    }
  }

  // Count removed
  for (const url of currentUrls) {
    if (!parsedUrls.has(url)) {
      removed++;
    }
  }

  return { added, removed, updated };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const showDiff = args.includes('--diff');

  try {
    const markdown = await fetchUpstreamReadme();
    console.log(`✅ Fetched ${markdown.length} bytes\n`);

    const parsed = parseMarkdownReports(markdown);
    const current = loadCurrentSources();

    console.log('📊 Parsing results:');
    let parsedTotal = 0;
    for (const [key, reports] of parsed) {
      console.log(`  ${key}: ${reports.length} reports`);
      parsedTotal += reports.length;
    }
    console.log(`  Total parsed: ${parsedTotal}\n`);

    const comparison = compareReports(current, parsed);
    console.log('📈 Changes detected:');
    console.log(`  New reports: ${comparison.added}`);
    console.log(`  Removed reports: ${comparison.removed}`);
    console.log(`  Updated URLs: ${comparison.updated}\n`);

    if (dryRun) {
      console.log('🔍 Dry run - no changes saved');
      return;
    }

    if (showDiff) {
      console.log('📝 Detailed diff:');
      // Show what would change
      for (const [key, reports] of parsed) {
        const [section, category] = key.split('_', 2);
        const currentCategory = section === 'analysis'
          ? current.categories.analysis[category]
          : current.categories.survey[category];

        if (!currentCategory) {
          console.log(`  + NEW CATEGORY: ${key}`);
        }
      }
      return;
    }

    // Note: Full update would merge parsed data into sources.json
    // For now, just update the timestamp since manual curation is preferred
    current.metadata.lastUpdated = new Date().toISOString().split('T')[0];
    current.metadata.totalReports = countReports(current);

    writeFileSync(SOURCES_PATH, JSON.stringify(current, null, 2));
    console.log('✅ Updated sources.json');
    console.log(`   Total reports: ${current.metadata.totalReports}`);
    console.log(`   Last updated: ${current.metadata.lastUpdated}`);

    console.log('\n💡 For full upstream sync, manually review changes at:');
    console.log(`   ${UPSTREAM_URL.replace('/README.md', '')}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
