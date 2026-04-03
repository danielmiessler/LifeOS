#!/usr/bin/env bun
/**
 * ListSources.ts - List annual security report sources
 *
 * Usage:
 *   bun run ListSources.ts                    # List all categories with counts
 *   bun run ListSources.ts <category>         # List reports in category
 *   bun run ListSources.ts --search <term>    # Search by vendor or report name
 *   bun run ListSources.ts --vendor <name>    # List all reports from vendor
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCES_PATH = join(import.meta.dir, '..', 'Data', 'sources.json');

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
  const content = readFileSync(SOURCES_PATH, 'utf-8');
  return JSON.parse(content);
}

function formatCategoryName(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function listCategories(sources: Sources): void {
  console.log('📊 Annual Security Reports\n');
  console.log(`Source: ${sources.metadata.source}`);
  console.log(`Last Updated: ${sources.metadata.lastUpdated}`);
  console.log(`Total Reports: ${sources.metadata.totalReports}\n`);

  console.log('📋 ANALYSIS REPORTS:');
  for (const [key, reports] of Object.entries(sources.categories.analysis)) {
    console.log(`  ${formatCategoryName(key)}: ${reports.length} reports`);
  }

  console.log('\n📋 SURVEY REPORTS:');
  for (const [key, reports] of Object.entries(sources.categories.survey)) {
    console.log(`  ${formatCategoryName(key)}: ${reports.length} reports`);
  }

  console.log('\nUsage: bun run ListSources.ts <category_name>');
}

function listCategory(sources: Sources, categoryName: string): void {
  const normalizedName = categoryName.toLowerCase().replace(/\s+/g, '_');

  // Search in both analysis and survey
  let reports: Report[] | undefined;
  let foundIn = '';

  if (sources.categories.analysis[normalizedName]) {
    reports = sources.categories.analysis[normalizedName];
    foundIn = 'Analysis';
  } else if (sources.categories.survey[normalizedName]) {
    reports = sources.categories.survey[normalizedName];
    foundIn = 'Survey';
  }

  if (!reports) {
    console.log(`❌ Category not found: ${categoryName}`);
    console.log('\nAvailable categories:');
    console.log('Analysis:', Object.keys(sources.categories.analysis).join(', '));
    console.log('Survey:', Object.keys(sources.categories.survey).join(', '));
    return;
  }

  console.log(`📊 ${formatCategoryName(normalizedName)} (${foundIn})\n`);
  console.log(`${reports.length} reports:\n`);

  for (const report of reports) {
    console.log(`• ${report.vendor}: ${report.name}`);
    console.log(`  ${report.url}\n`);
  }
}

function searchReports(sources: Sources, term: string): void {
  const normalizedTerm = term.toLowerCase();
  const results: { category: string; type: string; report: Report }[] = [];

  // Search analysis reports
  for (const [category, reports] of Object.entries(sources.categories.analysis)) {
    for (const report of reports) {
      if (
        report.vendor.toLowerCase().includes(normalizedTerm) ||
        report.name.toLowerCase().includes(normalizedTerm)
      ) {
        results.push({ category, type: 'Analysis', report });
      }
    }
  }

  // Search survey reports
  for (const [category, reports] of Object.entries(sources.categories.survey)) {
    for (const report of reports) {
      if (
        report.vendor.toLowerCase().includes(normalizedTerm) ||
        report.name.toLowerCase().includes(normalizedTerm)
      ) {
        results.push({ category, type: 'Survey', report });
      }
    }
  }

  if (results.length === 0) {
    console.log(`❌ No reports found matching: ${term}`);
    return;
  }

  console.log(`🔍 Search results for "${term}": ${results.length} reports\n`);

  for (const { category, type, report } of results) {
    console.log(`• ${report.vendor}: ${report.name}`);
    console.log(`  Category: ${formatCategoryName(category)} (${type})`);
    console.log(`  ${report.url}\n`);
  }
}

function listVendor(sources: Sources, vendorName: string): void {
  const normalizedVendor = vendorName.toLowerCase();
  const results: { category: string; type: string; report: Report }[] = [];

  // Search analysis reports
  for (const [category, reports] of Object.entries(sources.categories.analysis)) {
    for (const report of reports) {
      if (report.vendor.toLowerCase().includes(normalizedVendor)) {
        results.push({ category, type: 'Analysis', report });
      }
    }
  }

  // Search survey reports
  for (const [category, reports] of Object.entries(sources.categories.survey)) {
    for (const report of reports) {
      if (report.vendor.toLowerCase().includes(normalizedVendor)) {
        results.push({ category, type: 'Survey', report });
      }
    }
  }

  if (results.length === 0) {
    console.log(`❌ No reports found from vendor: ${vendorName}`);
    return;
  }

  console.log(`🏢 Reports from "${vendorName}": ${results.length} reports\n`);

  for (const { category, type, report } of results) {
    console.log(`• ${report.name}`);
    console.log(`  Category: ${formatCategoryName(category)} (${type})`);
    console.log(`  ${report.url}\n`);
  }
}

// Main
const args = process.argv.slice(2);
const sources = loadSources();

if (args.length === 0) {
  listCategories(sources);
} else if (args[0] === '--search' && args[1]) {
  searchReports(sources, args.slice(1).join(' '));
} else if (args[0] === '--vendor' && args[1]) {
  listVendor(sources, args.slice(1).join(' '));
} else {
  listCategory(sources, args.join(' '));
}
