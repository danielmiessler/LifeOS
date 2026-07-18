#!/usr/bin/env bun

/**
 * Check Anthropic Changes - Comprehensive Update Monitoring
 *
 * Monitors 30+ official Anthropic sources for updates and provides
 * AI-powered recommendations for improving LifeOS infrastructure.
 *
 * Usage:
 *   /check-anthropic-changes              # Check last 7 days
 *   /check-anthropic-changes 14           # Check last 14 days
 *   /check-anthropic-changes --force      # Force check all (ignore state)
 *
 * Sources Monitored:
 *   - 4 blogs/news sites
 *   - 9 GitHub repositories (commits + releases)
 *   - 4 changelog pages
 *   - 6 documentation sites
 *   - 1 community channel (manual reference)
 *
 * Output:
 *   - Prioritized report (HIGH/MEDIUM/LOW)
 *   - Actionable recommendations
 *   - Links to all changes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { claudeDir } from "../../../LIFEOS/TOOLS/lifeos-root";

// Types
interface Source {
  name: string;
  url?: string;
  owner?: string;
  repo?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  check_commits?: boolean;
  check_releases?: boolean;
  check_issues?: boolean;
  note?: string;
  site?: string;          // human-facing page (feeds): shown instead of raw feed url
  link_pattern?: string;  // indexes: regex matching post URLs on the index page
}

interface Sources {
  blogs: Source[];
  github_repos: Source[];
  changelogs: Source[];
  documentation: Source[];
  community: Source[];
  feeds?: Source[];       // RSS/Atom — structured per-post extraction
  indexes?: Source[];     // feedless HTML — index link-diff
}

interface Update {
  source: string;
  category: string;
  type: 'commit' | 'release' | 'blog' | 'changelog' | 'docs' | 'community' | 'feed' | 'index';
  title: string;
  url: string;
  date: string;
  summary?: string;
  hash?: string;
  sha?: string;
  version?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation?: string;
}

interface State {
  last_check_timestamp: string;
  sources: Record<string, {
    last_hash?: string;
    last_title?: string;
    last_sha?: string;
    last_version?: string;
    last_link?: string;
    seen_links?: string[];
    last_checked: string;
  }>;
}

// Config
const HOME = homedir();
const SKILL_DIR = join(claudeDir(), 'skills', 'Upgrade');
const STATE_DIR = join(SKILL_DIR, 'State');
const STATE_FILE = join(STATE_DIR, 'last-check.json');
const SOURCES_FILE = join(SKILL_DIR, 'sources.json');

// Parse args
const args = process.argv.slice(2);
const daysArg = args.find(a => !a.startsWith('--'));
const DAYS = daysArg ? parseInt(daysArg) : 30; // Default to 30 days for comprehensive review
const FORCE = args.includes('--force');
const LOG_DIR = join(SKILL_DIR, 'Logs');
const LOG_FILE = join(LOG_DIR, 'run-history.jsonl');

// Utilities
function hash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

function loadSources(): Sources {
  try {
    return JSON.parse(readFileSync(SOURCES_FILE, 'utf-8'));
  } catch (error) {
    console.error('❌ Failed to load sources.json:', error);
    process.exit(1);
  }
}

function loadState(): State {
  if (!existsSync(STATE_FILE)) {
    return {
      last_check_timestamp: new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString(),
      sources: {}
    };
  }

  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch (error) {
    console.warn('⚠️ Failed to load state, starting fresh:', error);
    return {
      last_check_timestamp: new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString(),
      sources: {}
    };
  }
}

function saveState(state: State): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function logRun(updatesFound: number, high: number, medium: number, low: number): void {
  try {
    const { mkdirSync, appendFileSync, existsSync } = require('fs');

    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      days_checked: DAYS,
      forced: FORCE,
      updates_found: updatesFound,
      high_priority: high,
      medium_priority: medium,
      low_priority: low
    };

    appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (error) {
    console.warn('⚠️ Failed to log run:', error);
  }
}

function getLastRunInfo(): { days_ago: number, last_timestamp: string } | null {
  try {
    if (!existsSync(LOG_FILE)) return null;

    const logs = readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
    if (logs.length === 0) return null;

    const lastLog = JSON.parse(logs[logs.length - 1]);
    const lastTime = new Date(lastLog.timestamp);
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - lastTime.getTime()) / (1000 * 60 * 60 * 24));

    return {
      days_ago: daysAgo,
      last_timestamp: lastLog.timestamp
    };
  } catch (error) {
    return null;
  }
}

// Fetching functions
async function fetchBlog(source: Source, state: State): Promise<Update[]> {
  try {
    const response = await fetch(source.url!);
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch ${source.name}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const contentHash = hash(html.substring(0, 5000)); // Hash first 5KB

    const stateKey = `blog_${source.name.toLowerCase().replace(/\s+/g, '_')}`;
    const lastHash = state.sources[stateKey]?.last_hash;

    if (!FORCE && lastHash === contentHash) {
      return []; // No changes
    }

    // Extract title from HTML (basic parsing)
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Latest update';

    return [{
      source: source.name,
      category: 'blog',
      type: 'blog',
      title: `${source.name}: ${title}`,
      url: source.url!,
      date: new Date().toISOString().split('T')[0],
      hash: contentHash,
      priority: source.priority,
      summary: `New content detected on ${source.name}`
    }];

  } catch (error) {
    console.warn(`⚠️ Error fetching blog ${source.name}:`, error);
    return [];
  }
}

async function fetchGitHubRepo(source: Source, state: State): Promise<Update[]> {
  const updates: Update[] = [];
  const token = process.env.GITHUB_TOKEN || '';
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'LifeOS-Anthropic-Monitor'
  };
  if (token) headers['Authorization'] = `token ${token}`;

  try {
    // Check commits
    if (source.check_commits) {
      const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
      const url = `https://api.github.com/repos/${source.owner}/${source.repo}/commits?since=${since}&per_page=10`;

      const response = await fetch(url, { headers });
      if (response.ok) {
        const commits = await response.json() as any[];

        const stateKey = `github_${source.repo}_commits`;
        const lastSha = state.sources[stateKey]?.last_sha;

        for (const commit of commits) {
          if (FORCE || commit.sha !== lastSha) {
            updates.push({
              source: source.name,
              category: 'github',
              type: 'commit',
              title: commit.commit.message.split('\n')[0],
              url: commit.html_url,
              date: commit.commit.author.date.split('T')[0],
              sha: commit.sha,
              priority: source.priority,
              summary: `Commit by ${commit.commit.author.name}`
            });
          }
          if (commit.sha === lastSha) break;
        }
        if (commits.length > 0) {
          state.sources[stateKey] = {
            last_sha: commits[0].sha,
            last_title: commits[0].commit.message.split('\n')[0],
            last_checked: new Date().toISOString()
          };
        }
      }
    }

    // Check releases
    if (source.check_releases) {
      const url = `https://api.github.com/repos/${source.owner}/${source.repo}/releases?per_page=5`;

      const response = await fetch(url, { headers });
      if (response.ok) {
        const releases = await response.json() as any[];

        const stateKey = `github_${source.repo}_releases`;
        const lastVersion = state.sources[stateKey]?.last_version;

        for (const release of releases) {
          if (FORCE || release.tag_name !== lastVersion) {
            updates.push({
              source: source.name,
              category: 'github',
              type: 'release',
              title: `${release.tag_name}: ${release.name || 'New Release'}`,
              url: release.html_url,
              date: release.published_at.split('T')[0],
              version: release.tag_name,
              priority: source.priority,
              summary: release.body ? release.body.substring(0, 200) + '...' : 'See release notes'
            });
          }
          if (release.tag_name === lastVersion) break;
        }
        if (releases.length > 0) {
          state.sources[stateKey] = {
            last_version: releases[0].tag_name,
            last_title: `${releases[0].tag_name}: ${releases[0].name || 'New Release'}`,
            last_checked: new Date().toISOString()
          };
        }
      }
    }

  } catch (error) {
    console.warn(`⚠️ Error fetching GitHub repo ${source.name}:`, error);
  }

  return updates;
}

async function fetchChangelog(source: Source, state: State): Promise<Update[]> {
  try {
    const response = await fetch(source.url!);
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch ${source.name}: ${response.status}`);
      return [];
    }

    const content = await response.text();
    const contentHash = hash(content.substring(0, 3000)); // Hash first 3KB

    const stateKey = `changelog_${source.name.toLowerCase().replace(/\s+/g, '_')}`;
    const lastHash = state.sources[stateKey]?.last_hash;

    if (!FORCE && lastHash === contentHash) {
      return []; // No changes
    }

    // Extract first version/section
    const versionMatch = content.match(/##?\s*(v?[\d.]+|[\w\s]+)\s*\n/i);
    const title = versionMatch ? versionMatch[1] : 'Latest update';

    return [{
      source: source.name,
      category: 'changelog',
      type: 'changelog',
      title: `${source.name}: ${title}`,
      url: source.url!,
      date: new Date().toISOString().split('T')[0],
      hash: contentHash,
      priority: source.priority,
      summary: 'Changelog updated with new entries'
    }];

  } catch (error) {
    console.warn(`⚠️ Error fetching changelog ${source.name}:`, error);
    return [];
  }
}

async function fetchDocs(source: Source, state: State): Promise<Update[]> {
  try {
    const response = await fetch(source.url!);
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch ${source.name}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const contentHash = hash(html.substring(0, 3000)); // Hash first 3KB

    const stateKey = `docs_${source.name.toLowerCase().replace(/\s+/g, '_')}`;
    const lastHash = state.sources[stateKey]?.last_hash;

    if (!FORCE && lastHash === contentHash) {
      return []; // No changes
    }

    return [{
      source: source.name,
      category: 'documentation',
      type: 'docs',
      title: `${source.name}: Documentation updated`,
      url: source.url!,
      date: new Date().toISOString().split('T')[0],
      hash: contentHash,
      priority: source.priority,
      summary: 'Documentation page has been updated'
    }];

  } catch (error) {
    console.warn(`⚠️ Error fetching docs ${source.name}:`, error);
    return [];
  }
}

// RSS/Atom + HTML-index parsing — structured per-post extraction (replaces homepage hashing)
function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseFeed(xml: string, max = 10): { title: string; link: string; date: string }[] {
  const items: { title: string; link: string; date: string }[] = [];
  const isAtom = /<entry[\s>]/.test(xml) && !/<item[\s>]/.test(xml);
  const blocks = isAtom
    ? xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || []
    : xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const b of blocks.slice(0, max)) {
    const title = decodeXml((b.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [, ''])[1]);
    let link = '';
    if (isAtom) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/)
               || b.match(/<link[^>]*href=["']([^"']+)["']/);
      link = alt ? alt[1] : '';
    } else {
      link = decodeXml((b.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [, ''])[1]);
    }
    const rawDate = ((b.match(/<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/) || [, ''])[1]).trim();
    let date = '';
    if (rawDate) { const d = new Date(rawDate); if (!isNaN(d.getTime())) date = d.toISOString().split('T')[0]; }
    if (title && link) items.push({ title, link, date });
  }
  return items;
}

async function fetchFeed(source: Source, state: State): Promise<Update[]> {
  try {
    const response = await fetch(source.url!, { headers: { 'User-Agent': 'LifeOS-Upgrade-Monitor' } });
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch feed ${source.name}: ${response.status}`);
      return [];
    }
    const items = parseFeed(await response.text(), 10);
    if (items.length === 0) return [];

    const stateKey = `feed_${source.name.toLowerCase().replace(/\s+/g, '_')}`;
    const lastLink = state.sources[stateKey]?.last_link;
    const isFirstRun = !lastLink;
    const updates: Update[] = [];

    for (const it of items) {
      if (!FORCE && !isFirstRun && it.link === lastLink) break;
      updates.push({
        source: source.name,
        category: 'feed',
        type: 'feed',
        title: `${source.name}: ${it.title}`,
        url: it.link,
        date: it.date || new Date().toISOString().split('T')[0],
        priority: source.priority,
        summary: it.title
      });
      if (isFirstRun && updates.length >= 5) break; // seed: surface recent backlog, not the whole feed
    }

    // Self-persist: advance the cursor to the newest item (save loop preserves feed_* keys via spread)
    state.sources[stateKey] = {
      last_link: items[0].link,
      last_title: items[0].title,
      last_checked: new Date().toISOString()
    };
    return updates;
  } catch (error) {
    console.warn(`⚠️ Error fetching feed ${source.name}:`, error);
    return [];
  }
}

async function fetchIndex(source: Source, state: State): Promise<Update[]> {
  try {
    const response = await fetch(source.url!, { headers: { 'User-Agent': 'LifeOS-Upgrade-Monitor' } });
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch index ${source.name}: ${response.status}`);
      return [];
    }
    const html = await response.text();
    const pattern = new RegExp(source.link_pattern || '$^', 'i');
    const found = new Map<string, string>(); // canonical url -> anchor text
    const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let href = m[1];
      if (href.startsWith('/')) { try { href = new URL(href, source.url!).toString(); } catch { continue; } }
      href = href.split('#')[0].split('?')[0].replace(/\/$/, '');
      if (!pattern.test(href)) continue;
      if (href === source.url!.replace(/\/$/, '')) continue; // skip the index page itself
      if (!found.has(href)) found.set(href, m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (found.size >= 25) break;
    }
    if (found.size === 0) return [];

    const stateKey = `index_${source.name.toLowerCase().replace(/\s+/g, '_')}`;
    const seen = new Set(state.sources[stateKey]?.seen_links || []);
    const isFirstRun = seen.size === 0;
    const updates: Update[] = [];

    for (const [url, text] of found) {
      if (!FORCE && seen.has(url)) continue;
      updates.push({
        source: source.name,
        category: 'index',
        type: 'index',
        title: `${source.name}: ${text || url.split('/').pop()}`,
        url,
        date: new Date().toISOString().split('T')[0],
        priority: source.priority,
        summary: text || 'New post'
      });
      if (isFirstRun && updates.length >= 8) break; // seed: surface recent backlog, not everything
    }

    // Self-persist the full seen-set (every link found this run + prior), capped
    const newSeen = [...new Set([...found.keys(), ...seen])].slice(0, 80);
    state.sources[stateKey] = { seen_links: newSeen, last_checked: new Date().toISOString() };
    return updates;
  } catch (error) {
    console.warn(`⚠️ Error fetching index ${source.name}:`, error);
    return [];
  }
}

// Recommendation engine - LifeOS LifeOS ecosystem focused
function generateRecommendation(update: Update): string {
  const { source, type, title, category } = update;
  const titleLower = title.toLowerCase();

  // SKILLS - Critical for LifeOS's skill system
  if (titleLower.includes('skill') || titleLower.includes('skills')) {
    return `**LifeOS Impact:** CRITICAL for skills ecosystem\n` +
      `**Why:** LifeOS's entire infrastructure is built on skills - any changes to skill patterns, specifications, or examples directly affect how we build and organize LifeOS's capabilities.\n` +
      `**Action:** Review immediately and update LifeOS's skill templates/patterns if new conventions emerge. Check if new skill categories or capabilities can be adopted.`;
  }

  // MCP - Core infrastructure
  if (titleLower.includes('mcp') || source.toLowerCase().includes('mcp')) {
    return `**LifeOS Impact:** HIGH - MCP infrastructure enhancement\n` +
      `**Why:** LifeOS uses MCP servers for brightdata, Ref docs, content access, and Stripe. Changes to MCP spec/docs affect our integrations.\n` +
      `**Action:** Assess compatibility with existing MCP servers in .mcp.json. Look for new MCP capabilities to expand LifeOS's tooling.`;
  }

  // Commands/Slash Commands
  if (titleLower.includes('command') || titleLower.includes('slash command')) {
    return `**LifeOS Impact:** HIGH - Command system update\n` +
      `**Why:** LifeOS uses slash commands extensively (~/.claude/Commands/). Changes affect our command architecture and user workflows.\n` +
      `**Action:** Review for new command patterns or capabilities. Update LifeOS's command templates if conventions change.`;
  }

  // Agents/Hooks
  if (titleLower.includes('agent') || titleLower.includes('hook')) {
    return `**LifeOS Impact:** HIGH - Agent/Hook system change\n` +
      `**Why:** LifeOS uses agents (researcher, engineer, architect, etc.) and hooks (load-context, stop-hook) as core infrastructure components.\n` +
      `**Action:** Check if this affects LifeOS's agent definitions or hook configurations. Test existing agent workflows.`;
  }

  // Claude Code releases
  if (type === 'release' && source.includes('claude-code')) {
    return `**LifeOS Impact:** CRITICAL - Core platform update\n` +
      `**Why:** LifeOS runs on Claude Code - releases may include new features, breaking changes, or performance improvements.\n` +
      `**Action:** Review changelog carefully. Test LifeOS's critical workflows. Update skills/commands if APIs changed.`;
  }

  // MCP releases
  if (type === 'release' && source.includes('MCP')) {
    return `**LifeOS Impact:** HIGH - MCP protocol update\n` +
      `**Why:** MCP protocol changes may require updates to server implementations or client integrations.\n` +
      `**Action:** Check MCP server compatibility. Look for new transports, authentication methods, or capabilities to adopt.`;
  }

  // Plugin/Marketplace
  if (titleLower.includes('plugin') || titleLower.includes('marketplace')) {
    return `**LifeOS Impact:** MEDIUM - Ecosystem expansion\n` +
      `**Why:** Plugin/marketplace features could provide new capabilities to integrate into LifeOS's toolkit.\n` +
      `**Action:** Explore available plugins. Assess if any solve current LifeOS limitations or add valuable features.`;
  }

  // Cookbooks/Quickstarts/Courses - Implementation patterns
  if (source.includes('cookbook') || source.includes('quickstart') || source.includes('courses')) {
    return `**LifeOS Impact:** MEDIUM - Implementation patterns\n` +
      `**Why:** Cookbooks/examples show best practices and patterns we can adopt in LifeOS's codebase.\n` +
      `**Action:** Review for reusable patterns, especially around skills, agents, or Claude Code features. Extract learnings for LifeOS.`;
  }

  // GitHub commits
  if (category === 'github' && type === 'commit') {
    return `**LifeOS Impact:** LOW-MEDIUM - Code pattern review\n` +
      `**Why:** Commits may reveal implementation details, bug fixes, or patterns useful for LifeOS development.\n` +
      `**Action:** Skim commit for code patterns. Low priority unless it touches skills/MCP/commands directly.`;
  }

  // Documentation
  if (titleLower.includes('doc') || type === 'docs') {
    return `**LifeOS Impact:** MEDIUM - Capability discovery\n` +
      `**Why:** Doc updates often reveal new features or best practices not yet in LifeOS.\n` +
      `**Action:** Review for new Claude Code features, API capabilities, or configuration options to leverage.`;
  }

  // SDK releases
  if (source.includes('sdk')) {
    return `**LifeOS Impact:** LOW - SDK update\n` +
      `**Why:** SDK updates are less relevant since LifeOS uses Claude Code CLI, not raw API SDKs.\n` +
      `**Action:** Note for reference. Only investigate if mentions features relevant to LifeOS's agent implementations.`;
  }

  // Blog posts
  if (type === 'blog') {
    return `**LifeOS Impact:** LOW-MEDIUM - Awareness\n` +
      `**Why:** Blogs announce new features and directions that may eventually affect LifeOS.\n` +
      `**Action:** Skim for strategic announcements about Claude Code, Skills, or MCP. Track for future planning.`;
  }

  // Generic
  return `**LifeOS Impact:** LOW - General awareness\n` +
    `**Why:** May have indirect relevance to LifeOS ecosystem.\n` +
    `**Action:** Review if time permits. Low impact on LifeOS's core functionality.`;
}

function assessRelevance(update: Update): 'HIGH' | 'MEDIUM' | 'LOW' {
  const titleLower = update.title.toLowerCase();

  // HIGH relevance keywords
  const highKeywords = ['skill', 'mcp', 'command', 'agent', 'hook', 'breaking', 'claude code'];
  if (highKeywords.some(k => titleLower.includes(k))) {
    return 'HIGH';
  }

  // Upgrade priority for key repos
  if (update.source.includes('claude-code') || update.source.includes('MCP')) {
    if (update.type === 'release') return 'HIGH';
    if (update.priority === 'HIGH') return 'HIGH';
    return 'MEDIUM';
  }

  // LOW relevance keywords
  const lowKeywords = ['typo', 'fix typo', 'readme', 'test', 'minor'];
  if (lowKeywords.some(k => titleLower.includes(k))) {
    return 'LOW';
  }

  // Default to source priority
  return update.priority;
}

// Generate narrative analysis focused on LifeOS ecosystem
function generateNarrative(updates: Update[]): string {
  const high = updates.filter(u => u.priority === 'HIGH');
  const medium = updates.filter(u => u.priority === 'MEDIUM');
  const low = updates.filter(u => u.priority === 'LOW');

  // Categorize by theme
  const skillUpdates = updates.filter(u => u.title.toLowerCase().includes('skill') || u.source.toLowerCase().includes('skill'));
  const mcpUpdates = updates.filter(u => u.title.toLowerCase().includes('mcp') || u.source.toLowerCase().includes('mcp'));
  const codeUpdates = updates.filter(u => u.source.includes('claude-code'));
  const cookbookUpdates = updates.filter(u => u.source.includes('cookbook'));
  const docUpdates = updates.filter(u => u.type === 'docs');
  const releases = updates.filter(u => u.type === 'release');

  let narrative = `## 📖 Executive Summary: What This Means for LifeOS\n\n`;

  // Overall activity
  narrative += `Found **${updates.length} updates** across the Anthropic ecosystem in the monitored period. `;

  if (high.length > 0) {
    narrative += `**${high.length} are HIGH priority** for LifeOS's infrastructure, `;
  }
  if (medium.length > 0) {
    narrative += `${medium.length} are MEDIUM priority, `;
  }
  if (low.length > 0) {
    narrative += `and ${low.length} are LOW priority.\n\n`;
  }

  // Key themes
  const themes: string[] = [];

  if (skillUpdates.length > 0) {
    themes.push(`**Skills Ecosystem** (${skillUpdates.length} updates)`);
  }
  if (mcpUpdates.length > 0) {
    themes.push(`**MCP Infrastructure** (${mcpUpdates.length} updates)`);
  }
  if (codeUpdates.length > 0) {
    themes.push(`**Claude Code Platform** (${codeUpdates.length} updates)`);
  }
  if (cookbookUpdates.length > 0) {
    themes.push(`**Implementation Examples** (${cookbookUpdates.length} updates)`);
  }
  if (docUpdates.length > 0) {
    themes.push(`**Documentation** (${docUpdates.length} updates)`);
  }

  if (themes.length > 0) {
    narrative += `### 🎯 Key Activity Areas\n\n`;
    themes.forEach(theme => narrative += `- ${theme}\n`);
    narrative += `\n`;
  }

  // Detailed analysis
  narrative += `### 💡 What's Happening\n\n`;

  // Skills analysis (most critical)
  if (skillUpdates.length > 0) {
    const highSkills = skillUpdates.filter(u => u.priority === 'HIGH').length;
    if (highSkills > 0) {
      narrative += `**🔥 CRITICAL: Skills System Activity**\n`;
      narrative += `There are **${highSkills} HIGH-priority skill updates** - this is BIG because LifeOS's entire architecture is built on the skills system. `;
      narrative += `Any changes to skill patterns, specifications, or conventions could require updates to LifeOS's ${countSkills()} existing skills. `;

      const skillsRepo = skillUpdates.some(u => u.source === 'skills');
      if (skillsRepo) {
        narrative += `The official skills repository has new activity, suggesting Anthropic is actively developing the skills ecosystem. `;
      }

      const skillDocs = skillUpdates.some(u => u.type === 'docs');
      if (skillDocs) {
        narrative += `Skills documentation has also been updated - check for new patterns or best practices. `;
      }

      narrative += `\n\n**→ Priority Action:** Review all skill updates immediately. Update LifeOS's skill templates if conventions changed.\n\n`;
    } else {
      narrative += `Skills system has **${skillUpdates.length} updates** but lower priority - likely documentation or minor improvements.\n\n`;
    }
  }

  // MCP analysis (infrastructure)
  if (mcpUpdates.length > 0) {
    const highMcp = mcpUpdates.filter(u => u.priority === 'HIGH').length;
    if (highMcp > 0) {
      narrative += `**🔧 IMPORTANT: MCP Infrastructure Changes**\n`;
      narrative += `**${highMcp} HIGH-priority MCP updates** detected. Since LifeOS uses MCP servers for brightdata, Ref, content, and Stripe, `;
      narrative += `protocol changes could affect our integrations. `;

      const mcpRelease = mcpUpdates.find(u => u.type === 'release');
      if (mcpRelease) {
        narrative += `There's a new MCP release (${mcpRelease.title}) - check for new capabilities or breaking changes. `;
      }

      narrative += `\n\n**→ Priority Action:** Test existing MCP servers. Look for new MCP features to expand LifeOS's toolkit.\n\n`;
    } else {
      narrative += `MCP has **${mcpUpdates.length} updates** - mostly documentation or minor improvements. Still worth monitoring.\n\n`;
    }
  }

  // Claude Code analysis (platform)
  if (codeUpdates.length > 0) {
    const highCode = codeUpdates.filter(u => u.priority === 'HIGH').length;
    if (highCode > 0) {
      narrative += `**⚡ PLATFORM UPDATE: Claude Code Changes**\n`;
      narrative += `**${highCode} HIGH-priority** Claude Code updates found. Since LifeOS runs on Claude Code, platform changes can affect everything. `;

      const codeRelease = codeUpdates.find(u => u.type === 'release');
      if (codeRelease) {
        narrative += `New release detected: ${codeRelease.title}. This could include new features, bug fixes, or breaking changes. `;
      }

      narrative += `\n\n**→ Priority Action:** Review changelog. Test LifeOS's core workflows after updating.\n\n`;
    } else {
      narrative += `Claude Code has **${codeUpdates.length} updates** but lower priority. Likely maintenance commits.\n\n`;
    }
  }

  // Cookbooks/patterns
  if (cookbookUpdates.length > 0) {
    narrative += `**📚 Implementation Patterns**\n`;
    narrative += `**${cookbookUpdates.length} cookbook updates** - these often contain useful patterns and examples. `;
    const skillCookbooks = cookbookUpdates.filter(u => u.title.toLowerCase().includes('skill'));
    if (skillCookbooks.length > 0) {
      narrative += `${skillCookbooks.length} specifically about skills - definitely review these for patterns to adopt in LifeOS. `;
    }
    narrative += `\n\n`;
  }

  // Documentation
  if (docUpdates.length > 5) {
    narrative += `**📖 Documentation Updates**\n`;
    narrative += `**${docUpdates.length} documentation pages** updated. While less urgent, docs often reveal new capabilities or best practices not yet used in LifeOS.\n\n`;
  }

  // Releases summary
  if (releases.length > 0) {
    narrative += `### 🎉 Releases Summary\n\n`;
    narrative += `**${releases.length} new releases** published:\n`;
    releases.forEach(r => {
      narrative += `- ${r.source}: ${r.title}\n`;
    });
    narrative += `\n`;
  }

  // Bottom line
  narrative += `### 🎯 Bottom Line for LifeOS\n\n`;

  if (high.length > 5) {
    narrative += `**High activity period** with ${high.length} high-priority changes. This suggests significant ecosystem development. `;
    narrative += `Focus on the skill and MCP updates first, then work through platform changes.\n\n`;
  } else if (high.length > 0) {
    narrative += `**Moderate activity** with ${high.length} items requiring attention. Not urgent, but should review within the week.\n\n`;
  } else {
    narrative += `**Quiet period** - mostly low-priority updates. Good time to focus on LifeOS development rather than external changes.\n\n`;
  }

  // Specific call-outs
  const topItems: string[] = [];

  if (skillUpdates.filter(u => u.priority === 'HIGH').length > 0) {
    topItems.push('1. **Skills system updates** - Review immediately, may affect LifeOS architecture');
  }
  if (mcpUpdates.filter(u => u.priority === 'HIGH').length > 0) {
    topItems.push('2. **MCP changes** - Test existing integrations, look for new capabilities');
  }
  if (codeUpdates.filter(u => u.priority === 'HIGH').length > 0) {
    topItems.push('3. **Claude Code platform** - Review release notes, test workflows');
  }

  if (topItems.length > 0) {
    narrative += `**Recommended Review Order:**\n`;
    topItems.forEach(item => narrative += `${item}\n`);
    narrative += `\n`;
  }

  return narrative;
}

function countSkills(): number {
  // Simple estimate - could be enhanced to actually count skills
  return 20; // Approximate based on LifeOS's current skill set
}

// Main execution
async function main() {
  console.log('🔍 Checking Anthropic sources for updates...\n');
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`⏰ Looking back: ${DAYS} days`);
  console.log(`🔄 Force mode: ${FORCE ? 'Yes' : 'No'}`);

  // Show last run info
  const lastRun = getLastRunInfo();
  if (lastRun) {
    console.log(`📜 Last run: ${lastRun.days_ago} days ago (${lastRun.last_timestamp.split('T')[0]})`);
  } else {
    console.log(`📜 First run - no previous history`);
  }
  console.log();

  // Load configuration and state
  const sources = loadSources();
  const state = loadState();

  console.log(`📊 Last state update: ${state.last_check_timestamp.split('T')[0]}\n`);
  console.log('⚡ Fetching all sources in parallel...\n');

  // Fetch all sources in parallel
  const fetchPromises: Promise<Update[]>[] = [];

  // Blogs
  for (const blog of sources.blogs) {
    fetchPromises.push(fetchBlog(blog, state));
  }

  // GitHub repos
  for (const repo of sources.github_repos) {
    fetchPromises.push(fetchGitHubRepo(repo, state));
  }

  // Changelogs
  for (const changelog of sources.changelogs) {
    fetchPromises.push(fetchChangelog(changelog, state));
  }

  // Documentation
  for (const docs of sources.documentation) {
    fetchPromises.push(fetchDocs(docs, state));
  }

  // Feeds (RSS/Atom — structured per-post)
  for (const feed of sources.feeds ?? []) {
    fetchPromises.push(fetchFeed(feed, state));
  }

  // Indexes (feedless HTML — link-diff)
  for (const index of sources.indexes ?? []) {
    fetchPromises.push(fetchIndex(index, state));
  }

  // Wait for all fetches
  const allUpdatesArrays = await Promise.all(fetchPromises);
  const allUpdates = allUpdatesArrays.flat();

  console.log(`✅ Fetch complete. Found ${allUpdates.length} updates.\n`);

  if (allUpdates.length === 0) {
    console.log('✨ No new updates found. Everything is up to date!\n');
    console.log('📊 STATUS: All monitored sources checked, no changes detected');
    console.log('➡️ NEXT: Check again later or use --force to see all current content');
    console.log('🎯 COMPLETED: Completed Anthropic changes monitoring check');
    return;
  }

  // Enhance updates with recommendations
  for (const update of allUpdates) {
    update.recommendation = generateRecommendation(update);
    const relevance = assessRelevance(update);
    if (relevance !== update.priority) {
      update.priority = relevance; // Override with assessed relevance
    }
  }

  // Sort by priority
  const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
  allUpdates.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Generate report
  console.log('═'.repeat(80));
  console.log('\n# 🎯 Anthropic Changes Report\n');
  console.log(`📅 Generated: ${new Date().toISOString().split('T')[0]}`);
  console.log(`📊 Period: Last ${DAYS} days`);
  console.log(`🔍 Updates found: ${allUpdates.length}\n`);

  const highPriority = allUpdates.filter(u => u.priority === 'HIGH');
  const mediumPriority = allUpdates.filter(u => u.priority === 'MEDIUM');
  const lowPriority = allUpdates.filter(u => u.priority === 'LOW');

  // Generate and display narrative analysis
  const narrative = generateNarrative(allUpdates);
  console.log(narrative);
  console.log('═'.repeat(80));
  console.log();

  // HIGH PRIORITY
  if (highPriority.length > 0) {
    console.log(`## 🔥 HIGH PRIORITY (${highPriority.length})\n`);
    for (const update of highPriority) {
      console.log(`### [${update.category.toUpperCase()}] ${update.title}\n`);
      console.log(`**Source:** ${update.source}`);
      console.log(`**Date:** ${update.date}`);
      console.log(`**Type:** ${update.type}`);
      console.log(`**Link:** ${update.url}`);
      if (update.summary) console.log(`**Summary:** ${update.summary}`);
      console.log(`\n${update.recommendation}\n`);
      console.log('---\n');
    }
  }

  // MEDIUM PRIORITY
  if (mediumPriority.length > 0) {
    console.log(`## 📌 MEDIUM PRIORITY (${mediumPriority.length})\n`);
    for (const update of mediumPriority) {
      console.log(`### [${update.category.toUpperCase()}] ${update.title}\n`);
      console.log(`**Source:** ${update.source}`);
      console.log(`**Date:** ${update.date}`);
      console.log(`**Link:** ${update.url}`);
      console.log(`\n${update.recommendation}\n`);
      console.log('---\n');
    }
  }

  // LOW PRIORITY
  if (lowPriority.length > 0) {
    console.log(`## 📝 LOW PRIORITY (${lowPriority.length})\n`);
    for (const update of lowPriority) {
      console.log(`- **${update.title}** - [View](${update.url}) - ${update.date}`);
    }
    console.log('\n');
  }

  // Community reminder
  console.log('## 💬 Community Channel\n');
  console.log('**Discord:** https://discord.com/invite/6PPFFzqPDZ');
  console.log('_(Manual check recommended - automated scraping not performed)_\n');

  console.log('═'.repeat(80));
  console.log('\n📊 STATUS: Report generated successfully');
  console.log('➡️ NEXT: Review HIGH priority items and implement relevant recommendations');
  console.log('🎯 COMPLETED: Completed comprehensive Anthropic changes monitoring\n');

  // Update state
  const newState: State = {
    last_check_timestamp: new Date().toISOString(),
    sources: { ...state.sources }
  };

  for (const update of allUpdates) {
    let stateKey = '';

    if (update.category === 'blog') {
      stateKey = `blog_${update.source.toLowerCase().replace(/\s+/g, '_')}`;
      newState.sources[stateKey] = {
        last_hash: update.hash!,
        last_title: update.title,
        last_checked: new Date().toISOString()
      };
    } else if (update.category === 'changelog') {
      stateKey = `changelog_${update.source.toLowerCase().replace(/\s+/g, '_')}`;
      newState.sources[stateKey] = {
        last_hash: update.hash!,
        last_title: update.title,
        last_checked: new Date().toISOString()
      };
    } else if (update.category === 'documentation') {
      stateKey = `docs_${update.source.toLowerCase().replace(/\s+/g, '_')}`;
      newState.sources[stateKey] = {
        last_hash: update.hash!,
        last_title: update.title,
        last_checked: new Date().toISOString()
      };
    }
  }

  saveState(newState);
  console.log('💾 State saved successfully\n');

  // Log this run
  logRun(allUpdates.length, highPriority.length, mediumPriority.length, lowPriority.length);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
