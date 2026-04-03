/**
 * Entity Collision Detection Utility
 *
 * Manages entity GUIDs across parsed content to prevent duplicates
 * and build a knowledge graph of people, companies, links, and sources.
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

const ENTITY_INDEX_PATH = path.join(__dirname, '../entity-index.json');

interface EntityIndex {
  version: string;
  last_updated: string;
  people: Record<string, PersonEntity>;
  companies: Record<string, CompanyEntity>;
  links: Record<string, LinkEntity>;
  sources: Record<string, SourceEntity>;
}

interface PersonEntity {
  id: string;
  name: string;
  first_seen: string;
  occurrences: number;
  content_ids: string[];
}

interface CompanyEntity {
  id: string;
  name: string;
  domain: string | null;
  first_seen: string;
  occurrences: number;
  content_ids: string[];
}

interface LinkEntity {
  id: string;
  url: string;
  first_seen: string;
  occurrences: number;
  content_ids: string[];
}

interface SourceEntity {
  id: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  first_seen: string;
  occurrences: number;
  content_ids: string[];
}

/**
 * Normalize person/company name for canonical ID
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Normalize URL for canonical ID
 */
function normalizeUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/$/, '');
}

/**
 * Compute canonical ID for source
 */
function getSourceCanonicalId(source: { url?: string | null; author?: string | null; publication?: string | null }): string {
  if (source.url) {
    return normalizeUrl(source.url);
  }
  const author = source.author ? normalizeName(source.author) : '';
  const publication = source.publication ? normalizeName(source.publication) : '';
  return `${author}|${publication}`;
}

/**
 * Load entity index from disk
 */
export async function loadEntityIndex(): Promise<EntityIndex> {
  try {
    const data = await fs.readFile(ENTITY_INDEX_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty index
    return {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      people: {},
      companies: {},
      links: {},
      sources: {}
    };
  }
}

/**
 * Save entity index to disk
 */
export async function saveEntityIndex(index: EntityIndex): Promise<void> {
  index.last_updated = new Date().toISOString();
  const tempPath = ENTITY_INDEX_PATH + '.tmp';

  // Write to temp file first
  await fs.writeFile(tempPath, JSON.stringify(index, null, 2));

  // Atomic rename
  await fs.rename(tempPath, ENTITY_INDEX_PATH);
}

/**
 * Get existing GUID or create new one for person
 */
export function getOrCreatePerson(
  personData: { name: string },
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = normalizeName(personData.name);

  if (entityIndex.people[canonicalId]) {
    // Entity exists - reuse GUID
    const existing = entityIndex.people[canonicalId];
    if (!existing.content_ids.includes(contentId)) {
      existing.occurrences++;
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    // New entity - create GUID
    const personId = uuidv4();
    entityIndex.people[canonicalId] = {
      id: personId,
      name: personData.name,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return personId;
  }
}

/**
 * Get existing GUID or create new one for company
 */
export function getOrCreateCompany(
  companyData: { name: string; domain: string | null },
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = companyData.domain
    ? companyData.domain.toLowerCase().trim()
    : normalizeName(companyData.name);

  if (entityIndex.companies[canonicalId]) {
    // Entity exists - reuse GUID
    const existing = entityIndex.companies[canonicalId];
    if (!existing.content_ids.includes(contentId)) {
      existing.occurrences++;
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    // New entity - create GUID
    const companyId = uuidv4();
    entityIndex.companies[canonicalId] = {
      id: companyId,
      name: companyData.name,
      domain: companyData.domain,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return companyId;
  }
}

/**
 * Get existing GUID or create new one for link
 */
export function getOrCreateLink(
  linkData: { url: string },
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = normalizeUrl(linkData.url);

  if (entityIndex.links[canonicalId]) {
    // Entity exists - reuse GUID
    const existing = entityIndex.links[canonicalId];
    if (!existing.content_ids.includes(contentId)) {
      existing.occurrences++;
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    // New entity - create GUID
    const linkId = uuidv4();
    entityIndex.links[canonicalId] = {
      id: linkId,
      url: linkData.url,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return linkId;
  }
}

/**
 * Get existing GUID or create new one for source
 */
export function getOrCreateSource(
  sourceData: { url: string | null; author: string | null; publication: string | null },
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = getSourceCanonicalId(sourceData);

  if (entityIndex.sources[canonicalId]) {
    // Entity exists - reuse GUID
    const existing = entityIndex.sources[canonicalId];
    if (!existing.content_ids.includes(contentId)) {
      existing.occurrences++;
      existing.content_ids.push(contentId);
    }
    return existing.id;
  } else {
    // New entity - create GUID
    const sourceId = uuidv4();
    entityIndex.sources[canonicalId] = {
      id: sourceId,
      url: sourceData.url,
      author: sourceData.author,
      publication: sourceData.publication,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return sourceId;
  }
}

/**
 * Check if URL has already been parsed (exists as source link in index)
 */
export function isUrlAlreadyParsed(url: string, entityIndex: EntityIndex): boolean {
  const canonicalId = normalizeUrl(url);
  const linkData = entityIndex.links[canonicalId];

  // Check if this is a source link (appears in content_ids)
  return linkData && linkData.content_ids.length > 0;
}

/**
 * Get content ID for already-parsed URL
 */
export function getExistingContentId(url: string, entityIndex: EntityIndex): string | null {
  const canonicalId = normalizeUrl(url);
  const linkData = entityIndex.links[canonicalId];

  if (linkData && linkData.content_ids.length > 0) {
    return linkData.content_ids[0]; // Return first content that referenced this link
  }

  return null;
}

/**
 * Process all entities for a piece of content and assign GUIDs
 */
export async function processContentEntities(
  contentId: string,
  extractedData: {
    people: Array<{ name: string; [key: string]: any }>;
    companies: Array<{ name: string; domain: string | null; [key: string]: any }>;
    links: Array<{ url: string; [key: string]: any }>;
    sources: Array<{ url: string | null; author: string | null; publication: string | null; [key: string]: any }>;
  }
): Promise<{
  people: Array<any>;
  companies: Array<any>;
  links: Array<any>;
  sources: Array<any>;
}> {
  const entityIndex = await loadEntityIndex();

  // Process people
  const people = extractedData.people.map(person => ({
    ...person,
    id: getOrCreatePerson(person, entityIndex, contentId)
  }));

  // Process companies
  const companies = extractedData.companies.map(company => ({
    ...company,
    id: getOrCreateCompany(company, entityIndex, contentId)
  }));

  // Process links
  const links = extractedData.links.map(link => ({
    ...link,
    id: getOrCreateLink(link, entityIndex, contentId)
  }));

  // Process sources
  const sources = extractedData.sources.map(source => ({
    ...source,
    id: getOrCreateSource(source, entityIndex, contentId)
  }));

  // Save updated index
  await saveEntityIndex(entityIndex);

  return { people, companies, links, sources };
}
