#!/usr/bin/env python3
"""
FFUF Helper Script - Assists with common ffuf tasks
"""

import json
import sys
import argparse
from pathlib import Path
from collections import Counter


def analyze_results(json_file):
    """Analyze ffuf JSON results and find interesting anomalies"""
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    results = data.get('results', [])
    
    if not results:
        print("No results found in JSON file")
        return
    
    print(f"\n=== FFUF Results Analysis ===")
    print(f"Total results: {len(results)}")
    
    # Status code distribution
    status_codes = Counter(r['status'] for r in results)
    print(f"\n[+] Status Code Distribution:")
    for code, count in sorted(status_codes.items()):
        print(f"    {code}: {count}")
    
    # Response size analysis
    sizes = [r['length'] for r in results]
    avg_size = sum(sizes) / len(sizes) if sizes else 0
    print(f"\n[+] Response Sizes:")
    print(f"    Average: {avg_size:.0f} bytes")
    print(f"    Min: {min(sizes)} bytes")
    print(f"    Max: {max(sizes)} bytes")
    
    # Find anomalies
    print(f"\n[+] Interesting Findings:")
    
    # Look for different status codes
    interesting_codes = [r for r in results if r['status'] not in [404, 403]]
    if interesting_codes:
        print(f"    - Found {len(interesting_codes)} results with interesting status codes")
        for r in interesting_codes[:10]:  # Show first 10
            print(f"      {r['status']} - {r['url']} ({r['length']} bytes)")
    
    # Look for size anomalies (significantly different from average)
    size_threshold = avg_size * 0.5  # 50% difference
    anomalous_sizes = [r for r in results if abs(r['length'] - avg_size) > size_threshold]
    if anomalous_sizes:
        print(f"    - Found {len(anomalous_sizes)} results with anomalous sizes")
        for r in sorted(anomalous_sizes, key=lambda x: x['length'], reverse=True)[:10]:
            print(f"      {r['status']} - {r['url']} ({r['length']} bytes)")
    
    # Look for interesting words in URLs
    interesting_keywords = ['admin', 'api', 'backup', 'config', 'dev', 'test', 
                           'staging', 'git', 'env', 'sql', 'db', 'key', 'secret',
                           'password', 'token', 'internal', 'private']
    interesting_urls = [r for r in results 
                       if any(kw in r['url'].lower() for kw in interesting_keywords)]
    if interesting_urls:
        print(f"    - Found {len(interesting_urls)} results with interesting keywords")
        for r in interesting_urls[:10]:
            print(f"      {r['status']} - {r['url']}")
    
    # Timing anomalies (if available)
    if results and 'duration' in results[0]:
        durations = [r['duration'] for r in results]
        avg_duration = sum(durations) / len(durations)
        slow_requests = [r for r in results if r['duration'] > avg_duration * 2]
        if slow_requests:
            print(f"    - Found {len(slow_requests)} slow responses (potential SQLi, etc.)")
            for r in sorted(slow_requests, key=lambda x: x['duration'], reverse=True)[:5]:
                print(f"      {r['status']} - {r['url']} ({r['duration']}ms)")


def create_request_file(output_file, method='GET', url='/', headers=None, body=None):
    """Create a template req.txt file"""
    
    # Parse URL to get host and path
    if '://' in url:
        protocol, rest = url.split('://', 1)
        if '/' in rest:
            host, path = rest.split('/', 1)
            path = '/' + path
        else:
            host = rest
            path = '/'
    else:
        host = 'target.com'
        path = url if url.startswith('/') else '/' + url
    
    # Start building the request
    lines = [f"{method} {path} HTTP/1.1"]
    lines.append(f"Host: {host}")
    lines.append("User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
    
    # Add headers
    if headers:
        for header in headers:
            lines.append(header)
    
    # Add blank line before body
    lines.append("")
    
    # Add body if present
    if body:
        lines.append(body)
    
    # Write to file
    with open(output_file, 'w') as f:
        f.write('\n'.join(lines))
    
    print(f"[+] Created request template: {output_file}")
    print(f"[!] Don't forget to add the FUZZ keyword where you want to fuzz!")


def generate_wordlist(output_file, type='numbers', start=1, end=1000):
    """Generate common wordlists"""
    with open(output_file, 'w') as f:
        if type == 'numbers':
            for i in range(start, end + 1):
                f.write(f"{i}\n")
        elif type == 'padded':
            width = len(str(end))
            for i in range(start, end + 1):
                f.write(f"{str(i).zfill(width)}\n")
    
    print(f"[+] Generated {type} wordlist: {output_file}")
    print(f"    Range: {start}-{end}")


def main():
    parser = argparse.ArgumentParser(
        description='FFUF Helper - Analyze results and create templates',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze ffuf JSON results
  %(prog)s analyze results.json
  
  # Create a request template
  %(prog)s create-req -o req.txt -m POST -u "https://api.target.com/users" \\
      -H "Authorization: Bearer TOKEN" -d '{"action":"FUZZ"}'
  
  # Generate number wordlist for IDOR testing
  %(prog)s wordlist -o ids.txt -t numbers -s 1 -e 10000
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Analyze command
    analyze_parser = subparsers.add_parser('analyze', help='Analyze ffuf JSON results')
    analyze_parser.add_argument('json_file', help='Path to ffuf JSON output file')
    
    # Create request command
    req_parser = subparsers.add_parser('create-req', help='Create req.txt template')
    req_parser.add_argument('-o', '--output', required=True, help='Output file path')
    req_parser.add_argument('-m', '--method', default='GET', help='HTTP method')
    req_parser.add_argument('-u', '--url', default='/', help='URL or path')
    req_parser.add_argument('-H', '--header', action='append', dest='headers', 
                           help='Add header (can be used multiple times)')
    req_parser.add_argument('-d', '--data', help='Request body')
    
    # Generate wordlist command
    wl_parser = subparsers.add_parser('wordlist', help='Generate wordlist')
    wl_parser.add_argument('-o', '--output', required=True, help='Output file path')
    wl_parser.add_argument('-t', '--type', choices=['numbers', 'padded'], 
                          default='numbers', help='Wordlist type')
    wl_parser.add_argument('-s', '--start', type=int, default=1, help='Start number')
    wl_parser.add_argument('-e', '--end', type=int, default=1000, help='End number')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'analyze':
        analyze_results(args.json_file)
    elif args.command == 'create-req':
        create_request_file(args.output, args.method, args.url, 
                          args.headers, args.data)
    elif args.command == 'wordlist':
        generate_wordlist(args.output, args.type, args.start, args.end)


if __name__ == '__main__':
    main()
