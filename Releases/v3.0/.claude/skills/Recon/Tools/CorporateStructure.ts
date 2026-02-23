#!/usr/bin/env bun
/**
 * CorporateStructure.ts - Corporate hierarchy and domain mapping for assessments
 * Maps parent companies, subsidiaries, and associated domains for target expansion
 *
 * Usage:
 *   bun CorporateStructure.ts <company> [options]
 *
 * Examples:
 *   bun CorporateStructure.ts "Instagram"       # Find parent (Meta), siblings, domains
 *   bun CorporateStructure.ts "Microsoft"       # Find all subsidiaries and domains
 *   bun CorporateStructure.ts "Slack" --context # Output as assessment context
 *
 * Assessment Use Case:
 *   When starting a new engagement, run this to build full attack surface:
 *   1. Find parent company (who owns the target)
 *   2. Find siblings (what else does parent own - often shared infra)
 *   3. Find children (what does target own - legacy systems)
 *   4. Map all domains for enumeration
 */

import { $ } from "bun";

interface CorporateEntity {
  name: string;
  domains: string[];
  acquisitionDate?: string;
  acquisitionPrice?: string;
}

interface CorporateHierarchy {
  target: string;
  parent?: CorporateEntity;
  siblings: CorporateEntity[];  // Other companies owned by same parent
  children: CorporateEntity[];  // Companies owned by target
  allDomains: string[];         // Flattened list for enumeration
}

interface CorporateStructureResult {
  query: string;
  timestamp: string;
  hierarchy: CorporateHierarchy;
  assessmentContext: string;    // Markdown context for assessment docs
  errors: string[];
}

// Corporate ownership database
// Format: company -> { parent, children with domains }
const CORPORATE_REGISTRY: Record<string, {
  parent?: string;
  children: CorporateEntity[];
}> = {
  // Alphabet/Google family
  "alphabet": {
    parent: undefined,
    children: [
      { name: "Google", domains: ["google.com", "googleapis.com", "gstatic.com", "googlevideo.com", "google.co.*"] },
      { name: "YouTube", domains: ["youtube.com", "youtu.be", "ytimg.com", "ggpht.com"], acquisitionDate: "2006", acquisitionPrice: "$1.65B" },
      { name: "Waze", domains: ["waze.com"], acquisitionDate: "2013", acquisitionPrice: "$1.1B" },
      { name: "Nest", domains: ["nest.com"], acquisitionDate: "2014", acquisitionPrice: "$3.2B" },
      { name: "Fitbit", domains: ["fitbit.com"], acquisitionDate: "2021", acquisitionPrice: "$2.1B" },
      { name: "Mandiant", domains: ["mandiant.com"], acquisitionDate: "2022", acquisitionPrice: "$5.4B" },
      { name: "Looker", domains: ["looker.com"], acquisitionDate: "2020", acquisitionPrice: "$2.6B" },
      { name: "DeepMind", domains: ["deepmind.com"], acquisitionDate: "2014", acquisitionPrice: "$500M" },
      { name: "Kaggle", domains: ["kaggle.com"], acquisitionDate: "2017" },
      { name: "DoubleClick", domains: ["doubleclick.com", "doubleclick.net"], acquisitionDate: "2008", acquisitionPrice: "$3.1B" },
      { name: "Waymo", domains: ["waymo.com"] },
      { name: "Verily", domains: ["verily.com"] },
      { name: "Calico", domains: ["calicolabs.com"] },
      { name: "Wing", domains: ["wing.com"] },
      { name: "Chronicle", domains: ["chronicle.security"] },
    ],
  },
  "google": {
    parent: "Alphabet",
    children: [], // Google's acquisitions roll up to Alphabet
  },
  "youtube": { parent: "Alphabet", children: [] },
  "waze": { parent: "Alphabet", children: [] },
  "nest": { parent: "Alphabet", children: [] },
  "fitbit": { parent: "Alphabet", children: [] },
  "mandiant": { parent: "Alphabet", children: [] },
  "deepmind": { parent: "Alphabet", children: [] },
  "kaggle": { parent: "Alphabet", children: [] },
  "waymo": { parent: "Alphabet", children: [] },

  // Meta family
  "meta": {
    parent: undefined,
    children: [
      { name: "Facebook", domains: ["facebook.com", "fb.com", "fbcdn.net", "fbsbx.com"] },
      { name: "Instagram", domains: ["instagram.com", "cdninstagram.com"], acquisitionDate: "2012", acquisitionPrice: "$1B" },
      { name: "WhatsApp", domains: ["whatsapp.com", "whatsapp.net"], acquisitionDate: "2014", acquisitionPrice: "$19B" },
      { name: "Oculus", domains: ["oculus.com", "oculuscdn.com"], acquisitionDate: "2014", acquisitionPrice: "$2B" },
      { name: "Giphy", domains: ["giphy.com"], acquisitionDate: "2020", acquisitionPrice: "$400M" },
      { name: "Mapillary", domains: ["mapillary.com"], acquisitionDate: "2020" },
      { name: "Kustomer", domains: ["kustomer.com"], acquisitionDate: "2020", acquisitionPrice: "$1B" },
      { name: "Threads", domains: ["threads.net"] },
    ],
  },
  "facebook": { parent: "Meta", children: [] },
  "instagram": { parent: "Meta", children: [] },
  "whatsapp": { parent: "Meta", children: [] },
  "oculus": { parent: "Meta", children: [] },
  "giphy": { parent: "Meta", children: [] },

  // Microsoft family
  "microsoft": {
    parent: undefined,
    children: [
      { name: "LinkedIn", domains: ["linkedin.com", "licdn.com"], acquisitionDate: "2016", acquisitionPrice: "$26.2B" },
      { name: "GitHub", domains: ["github.com", "githubusercontent.com", "githubassets.com"], acquisitionDate: "2018", acquisitionPrice: "$7.5B" },
      { name: "Nuance", domains: ["nuance.com"], acquisitionDate: "2021", acquisitionPrice: "$19.7B" },
      { name: "Activision Blizzard", domains: ["activision.com", "blizzard.com", "battle.net", "king.com"], acquisitionDate: "2023", acquisitionPrice: "$68.7B" },
      { name: "Mojang", domains: ["minecraft.net", "mojang.com"], acquisitionDate: "2014", acquisitionPrice: "$2.5B" },
      { name: "ZeniMax", domains: ["bethesda.net", "zenimax.com"], acquisitionDate: "2021", acquisitionPrice: "$7.5B" },
      { name: "Skype", domains: ["skype.com"], acquisitionDate: "2011", acquisitionPrice: "$8.5B" },
      { name: "Yammer", domains: ["yammer.com"], acquisitionDate: "2012", acquisitionPrice: "$1.2B" },
      { name: "Xamarin", domains: ["xamarin.com"], acquisitionDate: "2016" },
      { name: "npm", domains: ["npmjs.com", "npmjs.org"], acquisitionDate: "2020" },
      { name: "Azure", domains: ["azure.com", "azure.microsoft.com", "azurewebsites.net", "azureedge.net"] },
      { name: "Office 365", domains: ["office.com", "office365.com", "outlook.com", "sharepoint.com", "onedrive.com"] },
    ],
  },
  "linkedin": { parent: "Microsoft", children: [] },
  "github": { parent: "Microsoft", children: [] },
  "activision": { parent: "Microsoft", children: [] },
  "blizzard": { parent: "Microsoft", children: [] },
  "mojang": { parent: "Microsoft", children: [] },
  "skype": { parent: "Microsoft", children: [] },
  "npm": { parent: "Microsoft", children: [] },

  // Amazon family
  "amazon": {
    parent: undefined,
    children: [
      { name: "AWS", domains: ["aws.amazon.com", "amazonaws.com", "awsstatic.com", "elasticbeanstalk.com", "cloudfront.net"] },
      { name: "Whole Foods", domains: ["wholefoodsmarket.com"], acquisitionDate: "2017", acquisitionPrice: "$13.7B" },
      { name: "Twitch", domains: ["twitch.tv", "twitchcdn.net", "jtvnw.net"], acquisitionDate: "2014", acquisitionPrice: "$970M" },
      { name: "Ring", domains: ["ring.com"], acquisitionDate: "2018", acquisitionPrice: "$1B" },
      { name: "MGM", domains: ["mgm.com"], acquisitionDate: "2022", acquisitionPrice: "$8.45B" },
      { name: "iRobot", domains: ["irobot.com"], acquisitionDate: "2022", acquisitionPrice: "$1.7B" },
      { name: "One Medical", domains: ["onemedical.com"], acquisitionDate: "2023", acquisitionPrice: "$3.9B" },
      { name: "Zappos", domains: ["zappos.com"], acquisitionDate: "2009", acquisitionPrice: "$1.2B" },
      { name: "Audible", domains: ["audible.com"], acquisitionDate: "2008", acquisitionPrice: "$300M" },
      { name: "IMDb", domains: ["imdb.com"], acquisitionDate: "1998" },
      { name: "Goodreads", domains: ["goodreads.com"], acquisitionDate: "2013" },
      { name: "Comixology", domains: ["comixology.com"], acquisitionDate: "2014" },
      { name: "PillPack", domains: ["pillpack.com"], acquisitionDate: "2018", acquisitionPrice: "$753M" },
      { name: "Eero", domains: ["eero.com"], acquisitionDate: "2019" },
    ],
  },
  "aws": { parent: "Amazon", children: [] },
  "twitch": { parent: "Amazon", children: [] },
  "ring": { parent: "Amazon", children: [] },
  "wholefoodsmarket": { parent: "Amazon", children: [] },
  "zappos": { parent: "Amazon", children: [] },
  "audible": { parent: "Amazon", children: [] },
  "imdb": { parent: "Amazon", children: [] },
  "goodreads": { parent: "Amazon", children: [] },

  // Salesforce family
  "salesforce": {
    parent: undefined,
    children: [
      { name: "Slack", domains: ["slack.com", "slack-edge.com", "slack-imgs.com"], acquisitionDate: "2021", acquisitionPrice: "$27.7B" },
      { name: "Tableau", domains: ["tableau.com"], acquisitionDate: "2019", acquisitionPrice: "$15.7B" },
      { name: "MuleSoft", domains: ["mulesoft.com"], acquisitionDate: "2018", acquisitionPrice: "$6.5B" },
      { name: "Heroku", domains: ["heroku.com", "herokuapp.com"], acquisitionDate: "2010", acquisitionPrice: "$212M" },
      { name: "ExactTarget", domains: ["exacttarget.com"], acquisitionDate: "2013", acquisitionPrice: "$2.5B" },
      { name: "Quip", domains: ["quip.com"], acquisitionDate: "2016", acquisitionPrice: "$750M" },
    ],
  },
  "slack": { parent: "Salesforce", children: [] },
  "tableau": { parent: "Salesforce", children: [] },
  "mulesoft": { parent: "Salesforce", children: [] },
  "heroku": { parent: "Salesforce", children: [] },

  // Oracle family
  "oracle": {
    parent: undefined,
    children: [
      { name: "NetSuite", domains: ["netsuite.com"], acquisitionDate: "2016", acquisitionPrice: "$9.3B" },
      { name: "Cerner", domains: ["cerner.com"], acquisitionDate: "2022", acquisitionPrice: "$28.3B" },
      { name: "Sun Microsystems", domains: ["sun.com", "java.com", "mysql.com"], acquisitionDate: "2010", acquisitionPrice: "$7.4B" },
      { name: "PeopleSoft", domains: ["peoplesoft.com"], acquisitionDate: "2005", acquisitionPrice: "$10.3B" },
      { name: "OCI", domains: ["oraclecloud.com", "oraclecorp.com"] },
    ],
  },
  "netsuite": { parent: "Oracle", children: [] },
  "cerner": { parent: "Oracle", children: [] },
  "mysql": { parent: "Oracle", children: [] },
  "java": { parent: "Oracle", children: [] },

  // Cisco family
  "cisco": {
    parent: undefined,
    children: [
      { name: "Splunk", domains: ["splunk.com", "splunkcloud.com"], acquisitionDate: "2024", acquisitionPrice: "$28B" },
      { name: "Duo Security", domains: ["duo.com", "duosecurity.com"], acquisitionDate: "2018", acquisitionPrice: "$2.35B" },
      { name: "AppDynamics", domains: ["appdynamics.com"], acquisitionDate: "2017", acquisitionPrice: "$3.7B" },
      { name: "Webex", domains: ["webex.com"], acquisitionDate: "2007", acquisitionPrice: "$3.2B" },
      { name: "Meraki", domains: ["meraki.com"], acquisitionDate: "2012", acquisitionPrice: "$1.2B" },
      { name: "Sourcefire", domains: ["sourcefire.com"], acquisitionDate: "2013", acquisitionPrice: "$2.7B" },
    ],
  },
  "splunk": { parent: "Cisco", children: [] },
  "duo": { parent: "Cisco", children: [] },
  "duosecurity": { parent: "Cisco", children: [] },
  "webex": { parent: "Cisco", children: [] },
  "appdynamics": { parent: "Cisco", children: [] },

  // Adobe family
  "adobe": {
    parent: undefined,
    children: [
      { name: "Figma", domains: ["figma.com"], acquisitionDate: "2022", acquisitionPrice: "$20B" },
      { name: "Magento", domains: ["magento.com"], acquisitionDate: "2018", acquisitionPrice: "$1.68B" },
      { name: "Marketo", domains: ["marketo.com"], acquisitionDate: "2018", acquisitionPrice: "$4.75B" },
      { name: "Frame.io", domains: ["frame.io"], acquisitionDate: "2021", acquisitionPrice: "$1.275B" },
      { name: "Workfront", domains: ["workfront.com"], acquisitionDate: "2020", acquisitionPrice: "$1.5B" },
    ],
  },
  "figma": { parent: "Adobe", children: [] },
  "magento": { parent: "Adobe", children: [] },
  "marketo": { parent: "Adobe", children: [] },

  // IBM family
  "ibm": {
    parent: undefined,
    children: [
      { name: "Red Hat", domains: ["redhat.com", "openshift.com", "ansible.com"], acquisitionDate: "2019", acquisitionPrice: "$34B" },
      { name: "HashiCorp", domains: ["hashicorp.com", "terraform.io", "vagrantup.com", "consul.io", "vaultproject.io"], acquisitionDate: "2024", acquisitionPrice: "$6.4B" },
      { name: "Turbonomic", domains: ["turbonomic.com"], acquisitionDate: "2021" },
      { name: "Instana", domains: ["instana.com"], acquisitionDate: "2020" },
    ],
  },
  "redhat": { parent: "IBM", children: [] },
  "hashicorp": { parent: "IBM", children: [] },
  "terraform": { parent: "IBM", children: [] },

  // Apple (fewer acquisitions to track)
  "apple": {
    parent: undefined,
    children: [
      { name: "Beats", domains: ["beatsbydre.com"], acquisitionDate: "2014", acquisitionPrice: "$3B" },
      { name: "Shazam", domains: ["shazam.com"], acquisitionDate: "2018", acquisitionPrice: "$400M" },
      { name: "Dark Sky", domains: ["darksky.net"], acquisitionDate: "2020" },
    ],
  },
  "beats": { parent: "Apple", children: [] },
  "shazam": { parent: "Apple", children: [] },

  // Security vendors
  "paloaltonetworks": {
    parent: undefined,
    children: [
      { name: "Demisto", domains: ["demisto.com"], acquisitionDate: "2019", acquisitionPrice: "$560M" },
      { name: "Expanse", domains: ["expanse.co"], acquisitionDate: "2020", acquisitionPrice: "$800M" },
      { name: "Crypsis", domains: ["crypsis.com"], acquisitionDate: "2020", acquisitionPrice: "$265M" },
      { name: "Bridgecrew", domains: ["bridgecrew.io"], acquisitionDate: "2021", acquisitionPrice: "$200M" },
      { name: "Cider Security", domains: ["cidersecurity.io"], acquisitionDate: "2022", acquisitionPrice: "$300M" },
      { name: "Talon Cyber Security", domains: ["talon-sec.com"], acquisitionDate: "2023", acquisitionPrice: "$625M" },
    ],
  },
  "demisto": { parent: "Palo Alto Networks", children: [] },
  "bridgecrew": { parent: "Palo Alto Networks", children: [] },

  "crowdstrike": {
    parent: undefined,
    children: [
      { name: "Humio", domains: ["humio.com"], acquisitionDate: "2021", acquisitionPrice: "$400M" },
      { name: "Preempt Security", domains: ["preemptsecurity.com"], acquisitionDate: "2020", acquisitionPrice: "$96M" },
      { name: "SecureCircle", domains: ["securecircle.com"], acquisitionDate: "2022", acquisitionPrice: "$61M" },
      { name: "Reposify", domains: ["reposify.com"], acquisitionDate: "2022" },
    ],
  },
  "humio": { parent: "CrowdStrike", children: [] },

  // Broadcom family
  "broadcom": {
    parent: undefined,
    children: [
      { name: "VMware", domains: ["vmware.com"], acquisitionDate: "2023", acquisitionPrice: "$69B" },
      { name: "Symantec Enterprise", domains: ["symantec.com", "broadcom.com/solutions/symantec"], acquisitionDate: "2019", acquisitionPrice: "$10.7B" },
      { name: "CA Technologies", domains: ["ca.com"], acquisitionDate: "2018", acquisitionPrice: "$18.9B" },
    ],
  },
  "vmware": {
    parent: "Broadcom",
    children: [
      { name: "Carbon Black", domains: ["carbonblack.com"], acquisitionDate: "2019", acquisitionPrice: "$2.1B" },
      { name: "Pivotal", domains: ["pivotal.io", "spring.io"], acquisitionDate: "2019", acquisitionPrice: "$2.7B" },
      { name: "Heptio", domains: ["heptio.com"], acquisitionDate: "2018", acquisitionPrice: "$550M" },
      { name: "Tanzu", domains: ["tanzu.vmware.com"] },
    ],
  },
  "carbonblack": { parent: "VMware", children: [] },
  "pivotal": { parent: "VMware", children: [] },
  "symantec": { parent: "Broadcom", children: [] },
};

function normalizeCompanyName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/inc$|corp$|llc$|ltd$/, "");
}

function getCorporateHierarchy(companyName: string): CorporateHierarchy {
  const normalized = normalizeCompanyName(companyName);
  const hierarchy: CorporateHierarchy = {
    target: companyName,
    parent: undefined,
    siblings: [],
    children: [],
    allDomains: [],
  };

  // Look up the company
  const companyData = CORPORATE_REGISTRY[normalized];

  if (!companyData) {
    return hierarchy;
  }

  // Get children (subsidiaries)
  hierarchy.children = companyData.children;

  // Get parent
  if (companyData.parent) {
    const parentNormalized = normalizeCompanyName(companyData.parent);
    const parentData = CORPORATE_REGISTRY[parentNormalized];

    hierarchy.parent = {
      name: companyData.parent,
      domains: parentData?.children.find(c =>
        normalizeCompanyName(c.name) === parentNormalized
      )?.domains || [],
    };

    // Get siblings (other companies owned by parent)
    if (parentData) {
      hierarchy.siblings = parentData.children.filter(c =>
        normalizeCompanyName(c.name) !== normalized
      );
    }
  }

  // Collect all domains
  const allDomains = new Set<string>();

  // Add parent domains
  if (hierarchy.parent?.domains) {
    hierarchy.parent.domains.forEach(d => allDomains.add(d));
  }

  // Add sibling domains
  for (const sibling of hierarchy.siblings) {
    sibling.domains.forEach(d => allDomains.add(d));
  }

  // Add child domains
  for (const child of hierarchy.children) {
    child.domains.forEach(d => allDomains.add(d));
  }

  hierarchy.allDomains = [...allDomains].sort();

  return hierarchy;
}

function generateAssessmentContext(hierarchy: CorporateHierarchy): string {
  const lines: string[] = [];

  lines.push(`# Corporate Structure: ${hierarchy.target}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  if (hierarchy.parent) {
    lines.push(`## Parent Company`);
    lines.push(`- **${hierarchy.parent.name}**`);
    lines.push("");
  }

  if (hierarchy.siblings.length > 0) {
    lines.push(`## Sibling Companies (Same Parent)`);
    lines.push("*Potential shared infrastructure, SSO, or internal APIs*");
    lines.push("");
    for (const sib of hierarchy.siblings) {
      const price = sib.acquisitionPrice ? ` (${sib.acquisitionPrice})` : "";
      lines.push(`### ${sib.name}${price}`);
      lines.push(`Domains: ${sib.domains.join(", ")}`);
      lines.push("");
    }
  }

  if (hierarchy.children.length > 0) {
    lines.push(`## Subsidiaries / Acquisitions`);
    lines.push("*Often have legacy systems, separate security teams*");
    lines.push("");
    for (const child of hierarchy.children) {
      const price = child.acquisitionPrice ? ` - ${child.acquisitionPrice}` : "";
      const date = child.acquisitionDate ? ` (${child.acquisitionDate})` : "";
      lines.push(`### ${child.name}${date}${price}`);
      lines.push(`Domains: ${child.domains.join(", ")}`);
      lines.push("");
    }
  }

  if (hierarchy.allDomains.length > 0) {
    lines.push(`## All Related Domains (${hierarchy.allDomains.length})`);
    lines.push("*For subdomain enumeration and recon*");
    lines.push("```");
    for (const domain of hierarchy.allDomains) {
      lines.push(domain);
    }
    lines.push("```");
  }

  return lines.join("\n");
}

async function getCorporateStructure(
  company: string,
  options: { json?: boolean; context?: boolean } = {}
): Promise<CorporateStructureResult> {
  const hierarchy = getCorporateHierarchy(company);

  const result: CorporateStructureResult = {
    query: company,
    timestamp: new Date().toISOString(),
    hierarchy,
    assessmentContext: generateAssessmentContext(hierarchy),
    errors: [],
  };

  if (hierarchy.children.length === 0 && !hierarchy.parent && hierarchy.siblings.length === 0) {
    result.errors.push(
      `No corporate structure data found for "${company}". ` +
      `Try the parent company name, or research via Crunchbase/Wikipedia.`
    );
  }

  return result;
}

function parseArgs(args: string[]): { company: string; options: { json?: boolean; context?: boolean; domainsOnly?: boolean } } {
  const options: { json?: boolean; context?: boolean; domainsOnly?: boolean } = {};
  let company = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--context":
      case "-c":
        options.context = true;
        break;
      case "--domains-only":
      case "-d":
        options.domainsOnly = true;
        break;
      case "-h":
      case "--help":
        console.log(`
CorporateStructure - Map corporate hierarchy for security assessments

Usage:
  bun CorporateStructure.ts <company> [options]

Arguments:
  company               Company name to research

Options:
  -c, --context         Output as assessment context (markdown)
  -d, --domains-only    Output only the domain list (for piping)
  --json                Output as JSON

Assessment Use Case:
  When starting a new engagement, map the full attack surface:
  1. Who owns this company? (parent)
  2. What else does the parent own? (siblings - shared infra)
  3. What does this company own? (children - legacy systems)
  4. All associated domains for enumeration

Examples:
  # Starting assessment on Slack - find full Salesforce family
  bun CorporateStructure.ts "Slack"

  # Get Microsoft's full acquisition portfolio
  bun CorporateStructure.ts "Microsoft" --context

  # Get all Meta domains for enumeration
  bun CorporateStructure.ts "Instagram" --domains-only | xargs -I{} bun SubdomainEnum.ts {}

  # Export for assessment documentation
  bun CorporateStructure.ts "GitHub" --context > corporate-context.md

Supported Company Families:
  Alphabet/Google, Meta/Facebook, Microsoft, Amazon, Apple,
  Salesforce, Oracle, Cisco, Adobe, IBM, VMware, Broadcom,
  Palo Alto Networks, CrowdStrike
`);
        process.exit(0);
      default:
        if (!arg.startsWith("-")) {
          company = arg;
        }
    }
  }

  return { company, options };
}

// Main execution
const args = process.argv.slice(2);
const { company, options } = parseArgs(args);

if (!company) {
  console.error("Error: Company name required");
  console.error("Usage: bun CorporateStructure.ts <company> [options]");
  console.error("Use --help for more information");
  process.exit(1);
}

const result = await getCorporateStructure(company, options);

if (options.domainsOnly) {
  // Just output domains, one per line (for piping)
  for (const domain of result.hierarchy.allDomains) {
    console.log(domain);
  }
} else if (options.context) {
  // Output assessment context markdown
  console.log(result.assessmentContext);
} else if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  // Human-readable output
  const h = result.hierarchy;

  console.log(`\n🏢 Corporate Structure: ${h.target}`);
  console.log(`⏱️  ${result.timestamp}\n`);

  if (h.parent) {
    console.log(`📍 Parent Company: ${h.parent.name}`);
    console.log();
  }

  if (h.siblings.length > 0) {
    console.log(`👥 Sibling Companies (${h.siblings.length}):`);
    console.log("   *Same parent - potential shared infrastructure*\n");
    for (const sib of h.siblings.slice(0, 10)) {
      console.log(`   ${sib.name}`);
      console.log(`     ${sib.domains.slice(0, 3).join(", ")}${sib.domains.length > 3 ? "..." : ""}`);
    }
    if (h.siblings.length > 10) {
      console.log(`   ... and ${h.siblings.length - 10} more`);
    }
    console.log();
  }

  if (h.children.length > 0) {
    console.log(`🏭 Subsidiaries/Acquisitions (${h.children.length}):`);
    console.log("   *Often legacy systems, separate security teams*\n");
    for (const child of h.children) {
      const price = child.acquisitionPrice ? ` - ${child.acquisitionPrice}` : "";
      const date = child.acquisitionDate ? ` (${child.acquisitionDate})` : "";
      console.log(`   ${child.name}${date}${price}`);
      console.log(`     ${child.domains.join(", ")}`);
    }
    console.log();
  }

  console.log(`🌐 Total Related Domains: ${h.allDomains.length}`);

  if (result.errors.length > 0) {
    console.log("\n📝 Notes:");
    for (const err of result.errors) {
      console.log(`   ${err}`);
    }
  }

  if (h.allDomains.length > 0) {
    console.log(`\n💡 Next steps:`);
    console.log(`   bun CorporateStructure.ts "${company}" --domains-only | head -5`);
    console.log(`   bun CorporateStructure.ts "${company}" --context > assessment-context.md`);
  }
}

export { getCorporateStructure, getCorporateHierarchy, CorporateHierarchy, CorporateStructureResult };
