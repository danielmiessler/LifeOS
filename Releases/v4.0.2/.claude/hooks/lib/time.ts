/**
 * Shared Time Utilities
 *
 * Consistent timestamp generation across the hook system.
 * Reads timezone from settings.json via principal.timezone
 * Used by: All hooks that need timestamps
 */

import { getPrincipal } from './identity';

/**
 * Get configured timezone from settings.json (defaults to UTC)
 */
function getTimezone(): string {
  return getPrincipal().timezone || 'UTC';
}

/**
 * Get full timestamp string: "YYYY-MM-DD HH:MM:SS TZ"
 */
export function getPSTTimestamp(): string {
  const timezone = getTimezone();
  const date = new Date();
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');

  // Get short timezone name
  const tzName = date.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'short' }).split(' ').pop() || 'UTC';

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${tzName}`;
}

/**
 * Get date only: "YYYY-MM-DD"
 */
export function getPSTDate(): string {
  const timezone = getTimezone();
  const date = new Date();
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Get year-month for directory structure: "YYYY-MM"
 */
export function getYearMonth(): string {
  return getPSTDate().substring(0, 7);
}

/**
 * Get ISO8601 timestamp with timezone offset
 */
export function getISOTimestamp(): string {
  const timezone = getTimezone();
  const date = new Date();
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');

  // Calculate offset from UTC
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const diffMs = localDate.getTime() - utcDate.getTime();
  const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
  const diffMins = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));
  const sign = diffMs >= 0 ? '+' : '-';
  const offset = `${sign}${String(diffHours).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
}

/**
 * Get timestamp formatted for filenames: "YYYY-MM-DD-HHMMSS"
 */
export function getFilenameTimestamp(): string {
  const timezone = getTimezone();
  const date = new Date();
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Get timestamp components for custom formatting
 */
export function getPSTComponents(): {
  year: number;
  month: string;
  day: string;
  hours: string;
  minutes: string;
  seconds: string;
} {
  const timezone = getTimezone();
  const date = new Date();
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

  return {
    year: localDate.getFullYear(),
    month: String(localDate.getMonth() + 1).padStart(2, '0'),
    day: String(localDate.getDate()).padStart(2, '0'),
    hours: String(localDate.getHours()).padStart(2, '0'),
    minutes: String(localDate.getMinutes()).padStart(2, '0'),
    seconds: String(localDate.getSeconds()).padStart(2, '0'),
  };
}

/**
 * Get timezone string for display
 */
export function getTimezoneDisplay(): string {
  const timezone = getTimezone();
  const date = new Date();
  return date.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'short' }).split(' ').pop() || timezone;
}
