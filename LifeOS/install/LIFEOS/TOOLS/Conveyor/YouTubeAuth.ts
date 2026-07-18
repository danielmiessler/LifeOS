#!/usr/bin/env bun
/**
 * YouTubeAuth — mint the Conveyor YouTube OAuth refresh token (P0).
 *
 * Reuses the existing gws Google Desktop OAuth client (~/.config/gws/
 * client_secret.json), runs the loopback consent flow for the YouTube scopes,
 * verifies the token against channels.list(mine=true), and appends
 * YOUTUBE_OAUTH_REFRESH_TOKEN to ~/.claude/.env (backup written first).
 *
 * Scopes: youtube.upload (uploads) + youtube (metadata, playlists).
 * Token values are never printed. Run: bun YouTubeAuth.ts
 */

import { copyFileSync, appendFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { claudeDir } from "../lifeos-root";

const CLIENT_PATH = join(homedir(), '.config', 'gws', 'client_secret.json');
const ENV_PATH = join(claudeDir(), '.env');
const PORT = 8971;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ');

const client = JSON.parse(readFileSync(CLIENT_PATH, 'utf-8')).installed;
if (!client?.client_id || !client?.client_secret) {
  console.error('[yt-auth] client_secret.json missing installed.client_id/secret');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

console.log('[yt-auth] AUTH_URL_BEGIN');
console.log(authUrl);
console.log('[yt-auth] AUTH_URL_END');
console.log(`[yt-auth] waiting for consent redirect on ${REDIRECT} …`);

const server = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== '/callback') return new Response('not found', { status: 404 });
    const code = url.searchParams.get('code');
    const err = url.searchParams.get('error');
    if (err || !code) {
      console.error(`[yt-auth] consent failed: ${err ?? 'no code'}`);
      setTimeout(() => process.exit(1), 100);
      return new Response(`Consent failed: ${err ?? 'no code'}`, { status: 400 });
    }
    try {
      const tokenResp = await fetch(client.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: client.client_id,
          client_secret: client.client_secret,
          redirect_uri: REDIRECT,
          grant_type: 'authorization_code',
        }),
      });
      const tok = (await tokenResp.json()) as Record<string, string>;
      if (!tokenResp.ok || !tok.refresh_token) {
        console.error(`[yt-auth] token exchange failed (${tokenResp.status}): ${JSON.stringify({ ...tok, access_token: '…', refresh_token: '…' })}`);
        setTimeout(() => process.exit(1), 100);
        return new Response('Token exchange failed — see terminal.', { status: 500 });
      }

      // Verify: whose channel is this, and do we hold the upload scope?
      const chResp = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      const ch = (await chResp.json()) as any;
      const channel = ch?.items?.[0];
      const title = channel?.snippet?.title ?? 'UNKNOWN';
      const id = channel?.id ?? 'UNKNOWN';
      console.log(`[yt-auth] CHANNEL: ${title} (${id})`);
      console.log(`[yt-auth] SCOPES GRANTED: ${tok.scope}`);
      if (!chResp.ok) console.error(`[yt-auth] channels.list returned ${chResp.status} — API may need enabling: ${JSON.stringify(ch?.error?.message ?? '')}`);

      copyFileSync(ENV_PATH, `${ENV_PATH}.bak-ytauth`);
      appendFileSync(
        ENV_PATH,
        `\n# Conveyor YouTube leg (minted ${new Date().toISOString()}, gws Desktop client, channel ${id})\nYOUTUBE_OAUTH_REFRESH_TOKEN=${tok.refresh_token}\n`,
      );
      console.log(`[yt-auth] refresh token appended to ${ENV_PATH} (backup at .env.bak-ytauth)`);
      console.log('[yt-auth] SUCCESS');
      setTimeout(() => { server.stop(); process.exit(0); }, 200);
      return new Response(
        `<html><body style="font-family:monospace;background:#0c0f14;color:#3ddc84;padding:40px"><h2>Conveyor ✓</h2><p>YouTube credential minted for: <b>${title}</b></p><p>You can close this tab.</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    } catch (e) {
      console.error(`[yt-auth] error: ${e}`);
      setTimeout(() => process.exit(1), 100);
      return new Response('Error — see terminal.', { status: 500 });
    }
  },
});
