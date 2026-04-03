#!/usr/bin/env bun
/**
 * FetchReport.ts - Fetch and summarize a specific report
 *
 * Usage:
 *   bun run FetchReport.ts <vendor> <report-name>    # Fetch specific report
 *   bun run FetchReport.ts --url <url>               # Fetch by direct URL
 *   bun run FetchReport.ts --list-cached             # List downloaded reports
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const SOURCES_PATH = join(import.meta.dir, '..', 'Data', 'sources.json');
const REPORTS_DIR = join(import.meta.dir, '..', 'Reports');

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

function loadSources(): Sources {
  return JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
}

function findReport(sources: Sources, vendor: string, reportName: string): Report | null {
  const normalizedVendor = vendor.toLowerCase();
  const normalizedName = reportName.toLowerCase();

  // Search analysis reports
  for (const reports of Object.values(sources.categories.analysis)) {
    for (const report of reports) {
      if (
        report.vendor.toLowerCase().includes(normalizedVendor) &&
        report.name.toLowerCase().includes(normalizedName)
      ) {
        return report;
      }
    }
  }

  // Search survey reports
  for (const reports of Object.values(sources.categories.survey)) {
    for (const report of reports) {
      if (
        report.vendor.toLowerCase().includes(normalizedVendor) &&
        report.name.toLowerCase().includes(normalizedName)
      ) {
        return report;
      }
    }
  }

  return null;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function fetchReportPage(url: string): Promise<string> {
  console.log(`📥 Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/pdf')) {
      return '[PDF file - download manually from URL]';
    }

    return response.text();
  } catch (error) {
    console.error(`⚠️ Fetch failed: ${error}`);
    return `[Fetch failed: ${error}]`;
  }
}

function extractTextFromHtml(html: string): string {
  // Simple HTML to text conversion
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function createSummaryFile(report: Report, content: string): string {
  const vendorDir = join(REPORTS_DIR, sanitizeFilename(report.vendor));
  if (!existsSync(vendorDir)) {
    mkdirSync(vendorDir, { recursive: true });
  }

  const filename = `${sanitizeFilename(report.name)}-summary.md`;
  const filepath = join(vendorDir, filename);

  const text = extractTextFromHtml(content);
  const preview = text.slice(0, 2000);

  const summary = `# ${report.name}

**Vendor:** ${report.vendor}
**URL:** ${report.url}
**Fetched:** ${new Date().toISOString().split('T')[0]}

## Landing Page Preview

${preview}${text.length > 2000 ? '\n\n[Truncated - see full page at URL above]' : ''}

## Notes

- Full report may require registration
- Check URL for download options
- PDF versions may be available
`;

  writeFileSync(filepath, summary);
  return filepath;
}

function listCachedReports(): void {
  if (!existsSync(REPORTS_DIR)) {
    console.log('📁 No cached reports yet');
    return;
  }

  console.log('📁 Cached Reports:\n');

  const vendors = readdirSync(REPORTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const vendor of vendors) {
    const vendorDir = join(REPORTS_DIR, vendor);
    const files = readdirSync(vendorDir);

    if (files.length > 0) {
      console.log(`📂 ${vendor}/`);
      for (const file of files) {
        console.log(`   └─ ${file}`);
      }
      console.log('');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  bun run FetchReport.ts <vendor> <report-name>');
    console.log('  bun run FetchReport.ts --url <url>');
    console.log('  bun run FetchReport.ts --list-cached');
    console.log('');
    console.log('Examples:');
    console.log('  bun run FetchReport.ts crowdstrike "global threat"');
    console.log('  bun run FetchReport.ts verizon dbir');
    console.log('  bun run FetchReport.ts --url https://example.com/report');
    return;
  }

  if (args[0] === '--list-cached') {
    listCachedReports();
    return;
  }

  if (args[0] === '--url' && args[1]) {
    const url = args[1];
    const content = await fetchReportPage(url);

    const report: Report = {
      vendor: 'custom',
      name: basename(new URL(url).pathname) || 'report',
      url
    };

    const filepath = createSummaryFile(report, content);
    console.log(`✅ Summary saved: ${filepath}`);
    return;
  }

  // Find report by vendor and name
  if (args.length >= 2) {
    const vendor = args[0];
    const reportName = args.slice(1).join(' ');

    const sources = loadSources();
    const report = findReport(sources, vendor, reportName);

    if (!report) {
      console.log(`❌ Report not found: ${vendor} "${reportName}"`);
      console.log('');
      console.log('Try searching:');
      console.log(`  bun run ListSources.ts --search ${vendor}`);
      return;
    }

    console.log(`📄 Found: ${report.vendor} - ${report.name}`);
    console.log(`   URL: ${report.url}\n`);

    const content = await fetchReportPage(report.url);
    const filepath = createSummaryFile(report, content);

    console.log(`\n✅ Summary saved: ${filepath}`);
    console.log('');
    console.log('📝 Note: Most reports require registration for full PDF.');
    console.log('   Visit the URL above to download the complete report.');
    return;
  }

  console.log('❌ Invalid arguments. Run without args for usage.');
}

main();
