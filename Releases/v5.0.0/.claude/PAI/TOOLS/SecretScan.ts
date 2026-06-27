#!/usr/bin/env bun
/**
 * SecretScan.ts - Secret Scanning CLI
 *
 * Scan directories for sensitive information using TruffleHog.
 * Detects 700+ credential types with entropy analysis and pattern matching.
 * Part of PAI CORE Tools.
 *
 * Usage:
 *   bun ${PAI_DIR}/TOOLS/SecretScan.ts <directory>
 *   bun ${PAI_DIR}/TOOLS/SecretScan.ts . --verbose
 *   bun ${PAI_DIR}/TOOLS/SecretScan.ts . --verify
 *
 * @see ~/.claude/skills/_PAI/Workflows/SecretScanning.md
 */

/*

## Options
- --verbose: Show detailed information about each finding
- --json: Output results in JSON format
- --verify: Attempt to verify if credentials are active

## What it detects
- API keys (OpenAI, AWS, GitHub, Stripe, etc.)
- OAuth tokens
- Private keys
- Database connection strings
- And 700+ other credential types
*/

import { spawn } from 'child_process';
import { existsSync } from 'fs';

interface TruffleHogFinding {
  SourceMetadata: {
    Data: {
      Filesystem: {
        file: string;
        line: number;
      }
    }
  };
  DetectorType: string;
  DecoderName: string;
  Verified: boolean;
  Raw: string;
  RawV2: string;
  Redacted: string;
  ExtraData: any;
}

async function runTruffleHog(targetDir: string, options: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['filesystem', targetDir, '--json', '--no-update', ...options];
    
    console.log(`🔍 Running TruffleHog scan on: ${targetDir}\n`);
    console.log(`⏳ This may take a moment...\n`);
    
    const trufflehog = spawn('trufflehog', args);
    let output = '';
    let errorOutput = '';
    
    trufflehog.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    trufflehog.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    trufflehog.on('close', (code) => {
      if (code !== 0 && code !== 183) { // 183 = findings detected
        reject(new Error(`TruffleHog exited with code ${code}: ${errorOutput}`));
      } else {
        resolve(output);
      }
    });
    
    trufflehog.on('error', (err) => {
      reject(err);
    });
  });
}

function parseTruffleHogOutput(output: string): TruffleHogFinding[] {
  const findings: TruffleHogFinding[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const finding = JSON.parse(line);
      if (finding.SourceMetadata?.Data?.Filesystem) {
        findings.push(finding);
      }
    } catch (e) {
      // Skip non-JSON lines
    }
  }
  
  return findings;
}

function formatFindings(findings: TruffleHogFinding[], verbose: boolean) {
  if (findings.length === 0) {
    console.log('✅ No sensitive information found!');
    return;
  }
  
  console.log(`🚨 Found ${findings.length} potential secret${findings.length > 1 ? 's' : ''}:\n`);
  console.log('─'.repeat(60));
  
  // Group by severity
  const verified = findings.filter(f => f.Verified);
  const unverified = findings.filter(f => !f.Verified);
  
  if (verified.length > 0) {
    console.log('\n🔴 VERIFIED SECRETS (ACTIVE CREDENTIALS!)');
    console.log('─'.repeat(60));
    for (const finding of verified) {
      displayFinding(finding, verbose);
    }
  }
  
  if (unverified.length > 0) {
    console.log('\n⚠️  POTENTIAL SECRETS (Unverified)');
    console.log('─'.repeat(60));
    for (const finding of unverified) {
      displayFinding(finding, verbose);
    }
  }
  
  // Summary
  console.log('\n📋 SUMMARY & URGENT ACTIONS:');
  console.log('─'.repeat(60));
  
  if (verified.length > 0) {
    console.log('\n🚨 CRITICAL - VERIFIED ACTIVE CREDENTIALS FOUND:');
    console.log('1. IMMEDIATELY rotate/revoke these credentials');
    console.log('2. Check if these were ever pushed to a public repository');
    console.log('3. Audit logs for any unauthorized access');
    console.log('4. Move all secrets to environment variables or secret vaults');
  }
  
  console.log('\n🛡️  RECOMMENDATIONS:');
  console.log('1. Never commit secrets to git repositories');
  console.log('2. Use .env files for local development (add to .gitignore)');
  console.log('3. Use secret management services for production');
  console.log('4. Set up pre-commit hooks to prevent secret commits');
  console.log('5. Run: git filter-branch or BFG to remove secrets from git history');
}

function displayFinding(finding: TruffleHogFinding, verbose: boolean) {
  const file = finding.SourceMetadata.Data.Filesystem.file;
  const line = finding.SourceMetadata.Data.Filesystem.line || 'unknown';
  const type = finding.DetectorType;
  const verified = finding.Verified ? '✓ VERIFIED' : '✗ Unverified';
  
  console.log(`\n📄 ${file}`);
  console.log(`   Type: ${type} ${verified}`);
  console.log(`   Line: ${line}`);
  
  if (verbose) {
    console.log(`   Secret: ${finding.Redacted}`);
    if (finding.ExtraData) {
      console.log(`   Details: ${JSON.stringify(finding.ExtraData, null, 2)}`);
    }
  }
  
  // Recommendations based on type
  const recommendations: { [key: string]: string } = {
    'OpenAI': 'Revoke at platform.openai.com, use OPENAI_API_KEY env var',
    'AWS': 'Rotate via AWS IAM immediately, use AWS Secrets Manager',
    'GitHub': 'Revoke at github.com/settings/tokens, use GitHub Secrets',
    'Stripe': 'Roll key at dashboard.stripe.com, use STRIPE_SECRET_KEY env var',
    'Slack': 'Revoke at api.slack.com/apps, use environment variables',
    'Google': 'Revoke at console.cloud.google.com, use Secret Manager',
  };
  
  const recommendation = Object.entries(recommendations)
    .find(([key]) => String(type).includes(key))?.[1] || 
    'Remove from code and use secure secret management';
    
  console.log(`   💡 Fix: ${recommendation}`);
}

async function main() {
  const targetDir = process.argv[2] || process.cwd();
  const verbose = process.argv.includes('--verbose');
  const jsonOutput = process.argv.includes('--json');
  const verify = process.argv.includes('--verify');
  
  if (!existsSync(targetDir)) {
    console.error(`❌ Directory not found: ${targetDir}`);
    process.exit(1);
  }
  
  // Check if trufflehog is installed
  try {
    await runTruffleHog('--help', []);
  } catch (error) {
    console.error('❌ TruffleHog is not installed or not in PATH');
    console.error('Install with: brew install trufflehog');
    process.exit(1);
  }
  
  try {
    const options = [];
    if (verify) {
      options.push('--verify');
    }
    
    const output = await runTruffleHog(targetDir, options);
    
    if (jsonOutput) {
      console.log(output);
    } else {
      const findings = parseTruffleHogOutput(output);
      formatFindings(findings, verbose);
    }
    
    // Exit with error code if verified secrets found
    const findings = parseTruffleHogOutput(output);
    if (findings.some(f => f.Verified)) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error running TruffleHog: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
