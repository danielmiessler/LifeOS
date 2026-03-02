# Metadata and File Analysis Workflow

## Overview

**Metadata Analysis** is the extraction and examination of hidden data embedded within documents, images, and files to reveal intelligence about the systems, software, locations, and individuals that created them. Metadata often contains far more information than the primary content, making it a critical OSINT vector.

**Purpose:** Extract intelligence from file metadata including geolocation data, authorship, software versions, organizational information, and system details that support security assessments and social engineering operations.

**Critical Insight:** Organizations routinely publish documents with extensive metadata exposure, revealing internal usernames, software versions, network paths, GPS coordinates, and organizational structures without realizing it.

## When to Use This Workflow

### Primary Scenarios

**Document Intelligence:**
- Analyzing publicly available organizational documents (PDFs, Word, Excel)
- Extracting author names and usernames
- Identifying software versions and creation dates
- Discovering internal file paths and network structures
- Building software inventory from document metadata

**Image Intelligence (IMINT):**
- Extracting GPS coordinates from photos
- Identifying camera models and devices
- Discovering photo timestamps
- Analyzing edit history and software used
- Geolocating images for physical security assessment

**Social Engineering Preparation:**
- Building user profiles from document authorship
- Identifying common software and tools
- Discovering organizational naming conventions
- Understanding document workflow and processes
- Mapping organizational structure from metadata

**Attack Surface Mapping:**
- Identifying software versions for exploit targeting
- Discovering internal network paths
- Mapping file server structures
- Understanding organizational technology stack
- Identifying metadata scrubbing gaps (security maturity indicator)

### Integration with Security Testing

**Feeds Into:**
- Social engineering campaigns (username discovery)
- Targeted exploitation (software version identification)
- Physical penetration testing (geolocation intelligence)
- Credential testing (username enumeration)
- Attack surface mapping (technology inventory)

**Complements:**
- Social media intelligence (cross-reference locations)
- Subdomain reconnaissance (internal server discovery)
- Technology fingerprinting (version confirmation)
- Organizational mapping (personnel identification)

## Required Tools

### Essential Tools

**Metadata Extraction:**
- **ExifTool** - Universal metadata extraction for all file types
- **exiftool** (Perl) - Original comprehensive implementation
- **pyexiftool** (Python) - Python wrapper for ExifTool

**Document Analysis:**
- **pdfinfo** - PDF metadata extraction (poppler-utils)
- **strings** - Extract printable strings from files
- **file** - Identify file types

**Image Analysis:**
- **ExifTool** - Primary tool for image metadata
- **ImageMagick** (identify) - Image format details
- **Pillow** (Python PIL) - Programmatic image analysis

### Supporting Tools

**Automated Collection:**
- **metagoofil** - Automated document harvesting and analysis
- **FOCA** (Windows) - Fingerprinting Organizations with Collected Archives
- **SpiderFoot** - Metadata modules for automation

**Geolocation:**
- **ExifTool** - GPS coordinate extraction
- **Google Maps** - Coordinate visualization
- **geopy** (Python) - Geocoding and reverse geocoding

**Analysis and Correlation:**
- **grep, awk, sed** - Text processing and pattern matching
- **jq** - JSON processing for structured output
- **SQLite** - Database for large-scale metadata analysis

## Methodology

### Phase 1: Document Discovery and Collection

**Objective:** Identify and download publicly available documents from target organization.

**Step 1: Google Dorking for Documents**

```bash
# PDF documents
site:example.com filetype:pdf

# Microsoft Word documents
site:example.com (filetype:doc OR filetype:docx)

# Excel spreadsheets
site:example.com (filetype:xls OR filetype:xlsx)

# PowerPoint presentations
site:example.com (filetype:ppt OR filetype:pptx)

# All document types
site:example.com (filetype:pdf OR filetype:doc OR filetype:docx OR filetype:xls OR filetype:xlsx OR filetype:ppt OR filetype:pptx)

# Specific document types
site:example.com intitle:"annual report" filetype:pdf
site:example.com "whitepaper" filetype:pdf
site:example.com "press release" filetype:pdf
```

**Step 2: Automated Document Harvesting with Metagoofil**

```bash
# Install metagoofil
pip3 install metagoofil

# Basic usage
metagoofil -d example.com -t pdf,doc,docx,xls,xlsx -l 100 -n 25 -o output_dir -f results.html

# Parameters:
# -d : target domain
# -t : file types to search (comma-separated)
# -l : limit number of search results
# -n : number of files to download
# -o : output directory
# -f : output filename for HTML report

# Comprehensive collection
metagoofil -d example.com -t pdf,doc,docx,xls,xlsx,ppt,pptx -l 200 -n 50 -o docs -f metagoofil-report.html

# Only download files without metadata extraction
metagoofil -d example.com -t pdf -l 100 -n 50 -o pdfs --download-only
```

**Step 3: Manual Download Script**

```bash
#!/bin/bash
# Download documents from Google search results

DOMAIN="example.com"
OUTDIR="documents-$DOMAIN"
mkdir -p $OUTDIR

# Function to download PDFs
download_pdfs() {
  echo "[+] Searching for PDFs..."

  # Use googler or manual curl to Google search
  # Example with wget (requires Google search URL)
  # This is simplified - real implementation needs proper Google API or scraping

  # Manual approach: Save Google search results URLs to file
  echo "Manually save URLs from Google: site:$DOMAIN filetype:pdf"
  echo "Save to urls.txt, then run:"
  echo "wget -i urls.txt -P $OUTDIR"
}

# Alternative: Use curl to download specific known documents
curl -o $OUTDIR/document1.pdf https://example.com/files/document1.pdf
curl -o $OUTDIR/document2.pdf https://example.com/files/document2.pdf
```

**Step 4: Organization and Inventory**

```bash
# Create organized directory structure
mkdir -p documents/{pdfs,docs,xlsx,pptx,images}

# Sort by file type
find downloads -name "*.pdf" -exec mv {} documents/pdfs/ \;
find downloads -name "*.doc*" -exec mv {} documents/docs/ \;
find downloads -name "*.xls*" -exec mv {} documents/xlsx/ \;
find downloads -name "*.ppt*" -exec mv {} documents/pptx/ \;
find downloads -name "*.jpg" -o -name "*.png" -exec mv {} documents/images/ \;

# Create inventory
find documents -type f > document-inventory.txt
echo "Total documents: $(wc -l < document-inventory.txt)"
```

### Phase 2: Metadata Extraction with ExifTool

**Objective:** Extract all metadata from collected documents and images.

**Step 1: ExifTool Installation**

```bash
# macOS
brew install exiftool

# Ubuntu/Debian
sudo apt-get install libimage-exiftool-perl

# Verify installation
exiftool -ver
```

**Step 2: Basic Metadata Extraction**

```bash
# Extract metadata from single file
exiftool document.pdf

# Extract metadata from all PDFs
exiftool documents/pdfs/*.pdf

# Save output to text file
exiftool document.pdf > document-metadata.txt

# Extract specific tags
exiftool -Author -Creator -Producer document.pdf

# JSON output for parsing
exiftool -json document.pdf > document-metadata.json

# CSV output for spreadsheet analysis
exiftool -csv documents/pdfs/*.pdf > pdf-metadata.csv
```

**Step 3: Batch Processing All Documents**

```bash
# Extract metadata from all documents recursively
exiftool -r documents/ > all-metadata.txt

# JSON output for all documents
exiftool -r -json documents/ > all-metadata.json

# CSV output with specific fields
exiftool -r -csv -Author -Creator -Producer -CreateDate -ModifyDate documents/ > metadata-summary.csv

# Process each file type separately
exiftool -csv documents/pdfs/*.pdf > pdf-metadata.csv
exiftool -csv documents/docs/*.docx > docx-metadata.csv
exiftool -csv documents/xlsx/*.xlsx > xlsx-metadata.csv
```

**Step 4: Extracting Specific Intelligence**

**Author and Creator Information:**
```bash
# Extract all unique authors
exiftool -Author -csv -r documents/ | tail -n +2 | cut -d',' -f2 | sort -u > authors.txt

# Extract creators
exiftool -Creator -csv -r documents/ | tail -n +2 | cut -d',' -f2 | sort -u > creators.txt

# Extract both author and creator
exiftool -Author -Creator -csv -r documents/ > authors-creators.csv
```

**Software and Version Information:**
```bash
# Extract software used to create documents
exiftool -Software -Producer -Creator -csv -r documents/ > software-inventory.csv

# Identify Microsoft Office versions
exiftool -csv -r documents/ | grep -i "Microsoft Office"

# Identify Adobe products
exiftool -csv -r documents/ | grep -i "Adobe"
```

**Date and Time Intelligence:**
```bash
# Extract creation dates
exiftool -CreateDate -csv -r documents/ > creation-dates.csv

# Extract modification dates
exiftool -ModifyDate -csv -r documents/ > modification-dates.csv

# Timeline analysis (earliest to latest)
exiftool -CreateDate -csv -r documents/ | sort -t',' -k2
```

**Internal Path Disclosure:**
```bash
# Look for internal file paths
exiftool -a -G1 -s documents/*.pdf | grep -i "path\|directory\|folder"

# Common internal path metadata
exiftool -XMP-xmpMM:DerivedFromDocumentID -csv documents/*.pdf
exiftool -XMP-xmpMM:DocumentID -csv documents/*.pdf

# Extract all XMP metadata (often contains paths)
exiftool -xmp:all documents/*.pdf
```

### Phase 3: Image Metadata and Geolocation Analysis

**Objective:** Extract GPS coordinates, device information, and timestamps from images.

**Step 1: GPS Coordinate Extraction**

```bash
# Check for GPS data in image
exiftool -GPS* image.jpg

# Extract GPS coordinates
exiftool -GPSLatitude -GPSLongitude image.jpg

# Extract GPS in decimal degrees format
exiftool -GPSPosition image.jpg

# Batch extract GPS from all images
exiftool -GPSPosition -csv -r images/ > gps-coordinates.csv

# Extract only images WITH GPS data
exiftool -if '$GPSLatitude' -GPSPosition -csv -r images/ > images-with-gps.csv
```

**Step 2: GPS Coordinate Formatting**

```bash
# Convert to Google Maps format
exiftool -p '$GPSLatitude, $GPSLongitude' image.jpg

# Create Google Maps URL
LAT=$(exiftool -GPSLatitude -n image.jpg | awk -F': ' '{print $2}')
LON=$(exiftool -GPSLongitude -n image.jpg | awk -F': ' '{print $2}')
echo "https://www.google.com/maps?q=$LAT,$LON"

# Batch create Google Maps URLs
for img in images/*.jpg; do
  LAT=$(exiftool -GPSLatitude -n "$img" 2>/dev/null | awk -F': ' '{print $2}')
  LON=$(exiftool -GPSLongitude -n "$img" 2>/dev/null | awk -F': ' '{print $2}')
  if [ ! -z "$LAT" ]; then
    echo "$img: https://www.google.com/maps?q=$LAT,$LON"
  fi
done > image-locations.txt
```

**Step 3: Device and Camera Information**

```bash
# Extract camera make and model
exiftool -Make -Model image.jpg

# Extract all camera information
exiftool -Camera* image.jpg

# Batch extract device information
exiftool -Make -Model -csv -r images/ > device-inventory.csv

# Identify unique devices used
exiftool -Make -Model -csv -r images/ | tail -n +2 | cut -d',' -f2,3 | sort -u

# Look for smartphone signatures
exiftool -csv -r images/ | grep -i "iphone\|samsung\|pixel\|huawei"
```

**Step 4: Timestamp and Edit History**

```bash
# Extract all date/time fields
exiftool -time:all image.jpg

# Creation vs modification comparison
exiftool -CreateDate -ModifyDate -DateTimeOriginal image.jpg

# Identify edited images (create != modify)
exiftool -if '$CreateDate ne $ModifyDate' -FileName -CreateDate -ModifyDate -csv images/

# Extract editing software used
exiftool -Software -HistorySoftwareAgent -csv images/ > image-editing-software.csv
```

**Step 5: Advanced Image Intelligence**

```bash
# Extract thumbnail (may contain different image)
exiftool -b -ThumbnailImage image.jpg > thumbnail.jpg

# Check for embedded metadata in thumbnail
exiftool thumbnail.jpg

# Extract IPTC keywords and descriptions
exiftool -IPTC:Keywords -IPTC:Caption-Abstract image.jpg

# Check for copyright and ownership
exiftool -Copyright -Creator -Rights image.jpg

# Extract all XMP metadata
exiftool -xmp:all image.jpg
```

### Phase 4: Document-Specific Analysis

**Objective:** Extract intelligence specific to document types.

#### PDF Analysis

**Step 1: PDF Metadata**

```bash
# Basic PDF metadata
exiftool document.pdf

# PDF-specific fields
pdfinfo document.pdf

# Extract PDF producer and creator
exiftool -Producer -Creator document.pdf

# Check for JavaScript (potential malware)
exiftool -JavaScript document.pdf

# Extract PDF creation tool chain
exiftool -Producer -Creator -CreatorTool document.pdf
```

**Step 2: PDF Internal Paths**

```bash
# Look for internal file paths in PDF metadata
exiftool -a -G1 document.pdf | grep -i "path\|directory"

# Extract document ID and version history
exiftool -XMP-xmpMM:all document.pdf

# Check for tracked changes history
exiftool -XMP-xmpMM:History document.pdf
```

#### Microsoft Office Documents

**Step 1: Office Document Metadata**

```bash
# Word document metadata
exiftool document.docx

# Extract author and last modified by
exiftool -Author -LastModifiedBy document.docx

# Extract company and organization
exiftool -Company document.docx

# Extract editing time (minutes spent editing)
exiftool -TotalEditTime document.docx

# Extract template used
exiftool -Template document.docx
```

**Step 2: Organizational Intelligence**

```bash
# Extract company names from all documents
exiftool -Company -csv documents/*.docx | tail -n +2 | cut -d',' -f2 | sort -u

# Extract manager and category
exiftool -Manager -Category document.docx

# Extract internal version tracking
exiftool -DocSecurity -Revision document.docx
```

#### Excel Spreadsheets

```bash
# Extract Excel metadata
exiftool spreadsheet.xlsx

# Extract last author
exiftool -Author -LastModifiedBy spreadsheet.xlsx

# Check for hidden sheets
exiftool -Workbook spreadsheet.xlsx | grep -i "hidden"

# Extract calculation settings (may reveal formulas)
exiftool -CalcMode -CalcPrecision spreadsheet.xlsx
```

### Phase 5: Metadata Analysis and Pattern Discovery

**Objective:** Correlate metadata across multiple files to discover patterns and intelligence.

**Step 1: Author and Username Enumeration**

```bash
# Extract all unique authors
exiftool -Author -csv -r documents/ | tail -n +2 | cut -d',' -f2 | sort -u > unique-authors.txt

# Extract usernames from internal paths
exiftool -a -G1 -r documents/ | grep -oE "Users/[^/]+" | cut -d'/' -f2 | sort -u > usernames.txt

# Extract last modified by (often username)
exiftool -LastModifiedBy -csv -r documents/ | tail -n +2 | cut -d',' -f2 | sort -u > last-modified-by.txt

# Email address extraction from metadata
exiftool -a -G1 -r documents/ | grep -oE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" | sort -u > emails-from-metadata.txt
```

**Step 2: Software and Version Inventory**

```bash
# Create software inventory
exiftool -Software -Producer -Creator -csv -r documents/ | tail -n +2 | cut -d',' -f2,3,4 | sort -u > software-inventory.txt

# Count software usage
exiftool -Software -csv -r documents/ | tail -n +2 | cut -d',' -f2 | sort | uniq -c | sort -rn

# Identify outdated software versions
exiftool -Producer -csv documents/*.pdf | grep -i "Adobe\|Microsoft" | sort -u

# Look for security-relevant software
exiftool -csv -r documents/ | grep -iE "adobe|microsoft|openoffice|libreoffice"
```

**Step 3: Timeline Analysis**

```bash
# Sort documents by creation date
exiftool -CreateDate -FileName -csv -r documents/ | sort -t',' -k2

# Find oldest documents
exiftool -CreateDate -FileName -csv -r documents/ | sort -t',' -k2 | head -20

# Find newest documents
exiftool -CreateDate -FileName -csv -r documents/ | sort -t',' -k2 | tail -20

# Identify document modification patterns
exiftool -CreateDate -ModifyDate -csv documents/*.pdf | \
  awk -F',' '{diff = ($3-$2); if (diff > 86400) print $1, diff/86400 " days"}'

# Monthly document creation timeline
exiftool -CreateDate -csv -r documents/ | cut -d',' -f2 | cut -d':' -f1-2 | sort | uniq -c
```

**Step 4: Internal Network Path Discovery**

```bash
# Extract all internal paths
exiftool -a -G1 -r documents/ | grep -oE "[A-Z]:\\\\[^\"]+" | sort -u > internal-paths.txt

# Extract server names from UNC paths
exiftool -a -G1 -r documents/ | grep -oE "\\\\\\\\[^\\\\]+" | sort -u > server-names.txt

# Extract domain usernames from paths
exiftool -a -G1 -r documents/ | grep -oE "Users\\\\[^\\\\\"]+" | cut -d'\\' -f2 | sort -u

# Reconstruct file server structure
exiftool -a -G1 -r documents/ | grep -oE "[A-Z]:\\\\[^\"]+" | cut -d'\\' -f1-3 | sort -u
```

**Step 5: Geolocation Clustering**

```bash
# Extract all GPS coordinates
exiftool -GPSPosition -FileName -csv -r images/ | tail -n +2 > all-gps-data.csv

# Count images by location (rough clustering)
exiftool -GPSPosition -csv -r images/ | tail -n +2 | cut -d',' -f2 | sort | uniq -c

# Identify most common locations
# (Requires manual analysis or Python script for clustering)

# Create KML file for Google Earth visualization
exiftool -p kml.fmt -r images/ > images-map.kml
```

### Phase 6: Automated Analysis and Reporting

**Objective:** Automate metadata extraction and generate intelligence reports.

**Step 1: Comprehensive Analysis Script**

```bash
#!/bin/bash
# Metadata Intelligence Analysis Script

TARGET="example.com"
DOCDIR="documents"
OUTDIR="metadata-analysis-$(date +%Y%m%d)"

mkdir -p $OUTDIR/{raw,processed,reports}

echo "[+] Phase 1: Extracting all metadata"
exiftool -r -json $DOCDIR/ > $OUTDIR/raw/all-metadata.json
exiftool -r -csv $DOCDIR/ > $OUTDIR/raw/all-metadata.csv

echo "[+] Phase 2: Author and username extraction"
exiftool -Author -LastModifiedBy -csv -r $DOCDIR/ | tail -n +2 > $OUTDIR/processed/authors.csv
cat $OUTDIR/processed/authors.csv | cut -d',' -f2,3 | tr ',' '\n' | sort -u > $OUTDIR/processed/unique-users.txt
echo "    Found: $(wc -l < $OUTDIR/processed/unique-users.txt) unique users"

echo "[+] Phase 3: Software inventory"
exiftool -Software -Producer -Creator -csv -r $DOCDIR/ | tail -n +2 > $OUTDIR/processed/software.csv
cat $OUTDIR/processed/software.csv | cut -d',' -f2,3,4 | tr ',' '\n' | grep -v "^$" | sort -u > $OUTDIR/processed/software-list.txt
echo "    Found: $(wc -l < $OUTDIR/processed/software-list.txt) unique software products"

echo "[+] Phase 4: Internal path discovery"
exiftool -a -G1 -r $DOCDIR/ | grep -oE "[A-Z]:\\\\[^\"]+" | sort -u > $OUTDIR/processed/internal-paths.txt
exiftool -a -G1 -r $DOCDIR/ | grep -oE "\\\\\\\\[^\\\\]+" | cut -d'\\' -f3 | sort -u > $OUTDIR/processed/servers.txt
echo "    Found: $(wc -l < $OUTDIR/processed/servers.txt) server names"

echo "[+] Phase 5: Email extraction"
exiftool -a -G1 -r $DOCDIR/ | grep -oE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" | sort -u > $OUTDIR/processed/emails.txt
echo "    Found: $(wc -l < $OUTDIR/processed/emails.txt) email addresses"

echo "[+] Phase 6: GPS extraction (if images present)"
if [ -d "$DOCDIR/images" ]; then
  exiftool -GPSPosition -FileName -csv -r $DOCDIR/images/ | tail -n +2 > $OUTDIR/processed/gps-data.csv
  echo "    Found: $(wc -l < $OUTDIR/processed/gps-data.csv) images with GPS data"
fi

echo "[+] Phase 7: Timeline analysis"
exiftool -CreateDate -FileName -csv -r $DOCDIR/ | sort -t',' -k2 > $OUTDIR/processed/timeline.csv

echo "[+] Phase 8: Generating report"
cat > $OUTDIR/reports/executive-summary.md <<EOF
# Metadata Intelligence Report
**Target:** $TARGET
**Date:** $(date)
**Documents Analyzed:** $(find $DOCDIR -type f | wc -l)

## Key Findings

### User Enumeration
- Unique users discovered: $(wc -l < $OUTDIR/processed/unique-users.txt)
- Top 10 document authors:
$(cat $OUTDIR/processed/authors.csv | cut -d',' -f2 | grep -v "^$" | sort | uniq -c | sort -rn | head -10)

### Software Inventory
- Unique software products: $(wc -l < $OUTDIR/processed/software-list.txt)
- Software list: See processed/software-list.txt

### Internal Infrastructure
- Server names discovered: $(wc -l < $OUTDIR/processed/servers.txt)
- Servers: $(cat $OUTDIR/processed/servers.txt | tr '\n' ', ')

### Email Addresses
- Email addresses found: $(wc -l < $OUTDIR/processed/emails.txt)
- Emails: See processed/emails.txt

### Document Timeline
- Oldest document: $(head -1 $OUTDIR/processed/timeline.csv | cut -d',' -f2)
- Newest document: $(tail -1 $OUTDIR/processed/timeline.csv | cut -d',' -f2)

## Security Implications

### Username Enumeration
The discovered usernames can be used for:
- Email address generation (username@$TARGET)
- Credential stuffing attacks
- Social engineering targeting
- Authentication enumeration

### Software Vulnerability Targeting
Identified software versions can be researched for:
- Known vulnerabilities (CVE search)
- Exploitation opportunities
- Version-specific attack vectors

### Internal Network Intelligence
Discovered server names and paths reveal:
- Internal naming conventions
- File server structure
- Domain architecture
- Organizational structure

## Recommendations

1. **Metadata Scrubbing:** Implement automated metadata removal before document publication
2. **User Training:** Educate staff on metadata exposure risks
3. **Document Review:** Review all public documents for metadata exposure
4. **Software Updates:** Update identified outdated software
5. **Monitoring:** Regular scans for newly published documents

## Next Steps

1. Cross-reference usernames with email format for credential testing
2. Search CVE databases for identified software versions
3. Attempt authentication with discovered credentials
4. Social engineering campaigns using discovered personnel
5. Targeted exploitation based on software inventory

## Files Generated
- Raw metadata: raw/all-metadata.{json,csv}
- User list: processed/unique-users.txt
- Software inventory: processed/software-list.txt
- Server names: processed/servers.txt
- Email addresses: processed/emails.txt
- GPS data: processed/gps-data.csv (if applicable)
- Timeline: processed/timeline.csv
EOF

echo "[+] Analysis complete!"
echo "    Report: $OUTDIR/reports/executive-summary.md"
```

**Step 2: Python Advanced Analysis**

```python
#!/usr/bin/env python3
"""
Advanced Metadata Analysis with Statistical Analysis
"""

import json
import csv
from collections import Counter
from datetime import datetime

class MetadataAnalyzer:
    def __init__(self, json_file):
        with open(json_file, 'r') as f:
            self.data = json.load(f)

    def extract_authors(self):
        """Extract all unique authors"""
        authors = set()
        for item in self.data:
            if 'Author' in item:
                authors.add(item['Author'])
            if 'Creator' in item:
                authors.add(item['Creator'])
            if 'LastModifiedBy' in item:
                authors.add(item['LastModifiedBy'])
        return sorted(authors)

    def software_inventory(self):
        """Create software inventory with counts"""
        software = []
        for item in self.data:
            if 'Software' in item:
                software.append(item['Software'])
            if 'Producer' in item:
                software.append(item['Producer'])
        return Counter(software).most_common()

    def username_extraction(self):
        """Extract usernames from paths"""
        import re
        usernames = set()

        for item in self.data:
            # Check all fields for paths
            for key, value in item.items():
                if isinstance(value, str):
                    # Windows paths: C:\Users\username\
                    matches = re.findall(r'Users[\\/]([^\\/]+)', value)
                    usernames.update(matches)

                    # Mac paths: /Users/username/
                    matches = re.findall(r'/Users/([^/]+)', value)
                    usernames.update(matches)

        return sorted(usernames)

    def timeline_analysis(self):
        """Analyze document timeline"""
        dates = []
        for item in self.data:
            if 'CreateDate' in item:
                try:
                    date = datetime.strptime(item['CreateDate'], '%Y:%m:%d %H:%M:%S')
                    dates.append(date)
                except:
                    pass

        if dates:
            dates.sort()
            return {
                'earliest': dates[0],
                'latest': dates[-1],
                'total_days': (dates[-1] - dates[0]).days,
                'count': len(dates)
            }
        return None

    def generate_report(self):
        """Generate comprehensive report"""
        print("\n" + "="*60)
        print("METADATA INTELLIGENCE REPORT")
        print("="*60)

        # Authors
        authors = self.extract_authors()
        print(f"\n[+] Unique Authors: {len(authors)}")
        for author in authors[:10]:
            print(f"    - {author}")

        # Usernames
        usernames = self.username_extraction()
        print(f"\n[+] Extracted Usernames: {len(usernames)}")
        for username in usernames[:10]:
            print(f"    - {username}")

        # Software
        software = self.software_inventory()
        print(f"\n[+] Software Inventory: {len(software)} products")
        for sw, count in software[:10]:
            print(f"    - {sw}: {count} documents")

        # Timeline
        timeline = self.timeline_analysis()
        if timeline:
            print(f"\n[+] Timeline Analysis:")
            print(f"    Earliest: {timeline['earliest']}")
            print(f"    Latest: {timeline['latest']}")
            print(f"    Span: {timeline['total_days']} days")
            print(f"    Documents: {timeline['count']}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <metadata.json>")
        sys.exit(1)

    analyzer = MetadataAnalyzer(sys.argv[1])
    analyzer.generate_report()
```

## Output Analysis

### High-Value Intelligence

**Usernames and Authentication:**
- Convert usernames to email addresses (`username@example.com`)
- Test for username enumeration vulnerabilities
- Create credential lists for password spraying
- Social engineering targeting

**Software Vulnerabilities:**
- Search CVE databases for identified versions
- Identify end-of-life software
- Plan exploitation based on known vulnerabilities
- Prioritize patching recommendations

**Geolocation Intelligence:**
- Identify office locations
- Map employee residences (ethical considerations!)
- Physical security assessment preparation
- Social engineering scenario development

**Organizational Structure:**
- Map departments and teams from metadata
- Identify key personnel
- Understand reporting relationships
- Build organizational charts

## Next Steps

### Immediate Actions

**1. Username Enumeration:**
```bash
# Create email list from usernames
while read username; do
  echo "${username}@example.com"
done < usernames.txt > email-candidates.txt

# Test for valid emails
# Use email verification services or manual testing
```

**2. Vulnerability Research:**
```bash
# Search for CVEs in identified software
# Example: Adobe Acrobat 9.0 found
searchsploit "Adobe Acrobat 9.0"
# Check CVE databases, exploit-db, etc.
```

**3. Credential Testing:**
```bash
# Use discovered emails for breach database checks
# Test against authentication endpoints (authorized only)
# Password spraying with common passwords
```

### Integration with Security Testing

**Social Engineering:**
- Use discovered names for targeted phishing
- Reference internal projects from metadata
- Impersonate discovered personnel
- Create realistic pretexts based on org structure

**Targeted Exploitation:**
- Focus on software versions with known CVEs
- Develop exploits for identified technology stack
- Chain vulnerabilities based on discovered infrastructure

**Physical Security:**
- Use geolocation for office identification
- Plan physical penetration testing approaches
- Develop plausible pretexts

## Legal and Ethical Considerations

### Legal Framework

**Always Legal:**
- Analyzing publicly available documents
- Extracting metadata from authorized materials
- Document downloads from public websites

**Requires Authorization:**
- Using discovered credentials for access
- Exploiting identified vulnerabilities
- Accessing non-public systems
- Social engineering using discovered information

### Ethical Guidelines

**Privacy Considerations:**
- Minimize collection of personal information
- Focus on security-relevant metadata
- Avoid deep personal life investigation
- Consider impact of exposure

**Responsible Disclosure:**
- Report metadata exposure to organization
- Provide remediation guidance
- Allow reasonable response time
- Avoid public disclosure without permission

## Best Practices

### Operational Security

**Clean Working Environment:**
- Use VM for metadata analysis
- Beware of malicious documents
- Sandbox unknown files
- Maintain chain of custody

**Data Management:**
- Organize findings systematically
- Document data sources
- Secure sensitive findings
- Proper retention and disposal

### Quality Control

**Verify Findings:**
- Cross-reference multiple sources
- Validate usernames and emails
- Confirm software versions
- Check dates for consistency

**False Positive Filtering:**
- Remove template metadata
- Filter generic usernames
- Validate internal paths
- Assess relevance and value

## Troubleshooting

### Common Issues

**No metadata found:**
```bash
# Check if metadata was scrubbed
exiftool -a document.pdf

# Try different tools
pdfinfo document.pdf
strings document.pdf | grep -i "author\|creator"
```

**GPS not in standard fields:**
```bash
# Check all GPS tags
exiftool -GPS:all image.jpg

# Check XMP metadata
exiftool -xmp:all image.jpg

# Check EXIF thumbnail
exiftool -b -ThumbnailImage image.jpg | exiftool -GPS:all -
```

**Internal paths not extracting:**
```bash
# Use -a flag for all tags
exiftool -a -G1 document.pdf | grep -i path

# Check for XMP metadata
exiftool -xmp:all document.pdf

# Extract all strings
strings document.pdf | grep -i "users\|documents"
```

## References

**ExifTool:**
- Documentation: https://exiftool.org/
- Tag Names: https://exiftool.org/TagNames/
- Examples: https://exiftool.org/examples.html

**metagoofil:**
- GitHub: https://github.com/laramies/metagoofil
- Usage: https://tools.kali.org/information-gathering/metagoofil

**FOCA:**
- Tool: https://github.com/ElevenPaths/FOCA
- Documentation: https://www.elevenpaths.com/labstools/foca/

**Related Workflows:**
- `master-guide.md` - Complete OSINT methodology
- `reconnaissance.md` - Domain and network reconnaissance
- `social-media-intel.md` - Social media intelligence
- `automation.md` - Automated collection and analysis

---

**Key Takeaway:** Metadata is the hidden intelligence layer in documents and images. Organizations routinely expose sensitive information through metadata without realizing it. Systematic metadata analysis reveals usernames, software versions, internal paths, geolocation, and organizational structure—all critical for security testing and social engineering. Always operate within legal and ethical boundaries, and focus on security-relevant intelligence rather than personal privacy invasion.
