// ABOUTME: Blocks cloud/datacenter IPs from executing runs to prevent automated abuse.
// ABOUTME: Uses a static CIDR blocklist of major cloud providers (AWS, GCP, Azure, DO, Hetzner, OVH, Vultr, Linode, Oracle).

import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// CIDR blocklist — major cloud / datacenter ranges (IPv4 only)
// Sources: AWS ip-ranges.json, GCP cloud.json, Azure ServiceTags, ARIN/RIPE WHOIS
// ---------------------------------------------------------------------------

const CLOUD_CIDRS: readonly string[] = [
  // === AWS ===
  '3.0.0.0/8',        // Entire block (acquired from GE, 2018)
  '13.32.0.0/11',
  '13.208.0.0/12',
  '15.177.0.0/16',
  '15.181.0.0/16',
  '15.197.0.0/16',
  '16.16.0.0/12',
  '18.0.0.0/8',       // Entire block (acquired from MIT, 2017)
  '23.20.0.0/14',
  '34.192.0.0/10',
  '34.0.0.0/12',
  '35.72.0.0/13',
  '35.80.0.0/12',
  '35.152.0.0/13',
  '35.160.0.0/11',
  '44.192.0.0/10',
  '46.51.0.0/16',
  '50.16.0.0/12',
  '50.112.0.0/12',
  '52.0.0.0/10',
  '52.64.0.0/11',
  '52.192.0.0/10',
  '54.64.0.0/10',     // AWS portion of 54.x
  '54.128.0.0/9',     // AWS portion of 54.x
  '63.32.0.0/11',
  '64.252.0.0/16',
  '72.21.192.0/18',
  '75.101.128.0/17',
  '99.77.0.0/16',
  '99.150.0.0/15',
  '100.20.0.0/14',
  '100.24.0.0/13',
  '107.20.0.0/14',
  '108.128.0.0/10',
  '174.129.0.0/16',
  '176.34.0.0/15',
  '184.72.0.0/15',
  '204.236.128.0/17',

  // === GCP ===
  '34.64.0.0/10',
  '35.184.0.0/13',
  '35.192.0.0/11',
  '35.224.0.0/12',
  '35.240.0.0/13',
  '104.154.0.0/15',
  '104.196.0.0/14',
  '130.211.0.0/16',
  '146.148.0.0/17',

  // === Azure ===
  '13.64.0.0/11',
  '13.96.0.0/13',
  '13.104.0.0/14',
  '20.0.0.0/8',       // Massive Azure allocation
  '23.96.0.0/13',
  '40.64.0.0/10',
  '40.112.0.0/13',
  '51.104.0.0/14',
  '51.124.0.0/16',
  '51.140.0.0/14',
  '52.96.0.0/12',
  '52.112.0.0/12',
  '52.136.0.0/13',
  '52.148.0.0/14',
  '52.152.0.0/13',
  '52.160.0.0/11',
  '52.224.0.0/11',
  '65.52.0.0/14',
  '104.40.0.0/13',
  '104.208.0.0/13',
  '137.116.0.0/14',
  '168.61.0.0/16',
  '168.62.0.0/15',
  '191.232.0.0/13',

  // === DigitalOcean ===
  '64.225.0.0/16',
  '68.183.0.0/16',
  '104.131.0.0/16',
  '104.236.0.0/16',
  '128.199.0.0/16',
  '134.209.0.0/16',
  '137.184.0.0/14',
  '138.68.0.0/16',
  '138.197.0.0/16',
  '139.59.0.0/16',
  '142.93.0.0/16',
  '143.110.0.0/16',
  '143.198.0.0/16',
  '146.190.0.0/15',
  '157.230.0.0/16',
  '157.245.0.0/16',
  '159.65.0.0/16',
  '159.89.0.0/16',
  '159.203.0.0/16',
  '161.35.0.0/16',
  '164.90.0.0/16',
  '164.92.0.0/16',
  '165.22.0.0/16',
  '165.227.0.0/16',
  '167.71.0.0/16',
  '167.172.0.0/16',
  '170.64.0.0/16',
  '174.138.0.0/16',
  '178.128.0.0/16',
  '188.166.0.0/16',
  '206.189.0.0/16',

  // === Hetzner ===
  '5.9.0.0/16',
  '23.88.0.0/13',
  '46.4.0.0/16',
  '49.12.0.0/14',
  '65.21.0.0/16',
  '65.108.0.0/15',
  '78.46.0.0/15',
  '88.99.0.0/16',
  '88.198.0.0/16',
  '94.130.0.0/15',
  '95.216.0.0/14',
  '116.202.0.0/15',
  '128.140.0.0/16',
  '135.181.0.0/16',
  '136.243.0.0/16',
  '138.201.0.0/16',
  '144.76.0.0/16',
  '148.251.0.0/16',
  '157.90.0.0/16',
  '159.69.0.0/16',
  '162.55.0.0/16',
  '167.235.0.0/16',
  '168.119.0.0/16',
  '176.9.0.0/16',
  '178.63.0.0/16',
  '188.40.0.0/16',
  '195.201.0.0/16',
  '213.133.96.0/19',
  '213.239.192.0/18',

  // === OVH ===
  '51.38.0.0/15',
  '51.68.0.0/14',
  '51.75.0.0/16',
  '51.77.0.0/16',
  '51.79.0.0/16',
  '51.83.0.0/16',
  '51.89.0.0/16',
  '51.91.0.0/16',
  '51.161.0.0/16',
  '51.178.0.0/16',
  '51.195.0.0/16',
  '54.36.0.0/14',
  '91.121.0.0/16',
  '135.125.0.0/16',
  '137.74.0.0/16',
  '139.99.0.0/16',
  '141.94.0.0/15',
  '144.217.0.0/16',
  '145.239.0.0/16',
  '147.135.0.0/16',
  '149.56.0.0/16',
  '158.69.0.0/16',
  '164.132.0.0/16',
  '167.114.0.0/16',
  '176.31.0.0/16',
  '178.32.0.0/15',
  '188.165.0.0/16',
  '192.95.0.0/16',
  '192.99.0.0/16',
  '198.27.64.0/18',
  '198.50.128.0/17',

  // === Vultr ===
  '45.32.0.0/16',
  '45.63.0.0/16',
  '45.76.0.0/16',
  '45.77.0.0/16',
  '64.176.0.0/16',
  '66.42.0.0/16',
  '78.141.192.0/18',
  '95.179.128.0/17',
  '104.156.224.0/19',
  '104.238.128.0/17',
  '108.61.0.0/16',
  '136.244.64.0/18',
  '140.82.0.0/16',
  '144.202.0.0/16',
  '149.28.0.0/16',
  '155.138.128.0/17',
  '207.148.0.0/16',
  '209.250.224.0/19',

  // === Linode / Akamai ===
  '45.33.0.0/16',
  '45.56.0.0/16',
  '45.79.0.0/16',
  '50.116.0.0/16',
  '69.164.192.0/18',
  '72.14.176.0/20',
  '74.207.224.0/19',
  '96.126.96.0/19',
  '97.107.128.0/17',
  '139.144.0.0/16',
  '139.162.0.0/16',
  '143.42.0.0/16',
  '170.187.128.0/17',
  '172.104.0.0/15',
  '172.232.0.0/13',
  '176.58.96.0/19',
  '178.79.128.0/17',
  '194.195.192.0/18',

  // === Oracle Cloud ===
  '129.146.0.0/15',
  '129.148.0.0/14',
  '130.35.0.0/16',
  '132.145.0.0/16',
  '132.226.0.0/15',
  '140.83.0.0/16',
  '140.84.0.0/14',
  '141.144.0.0/14',
  '141.148.0.0/15',
  '144.24.0.0/13',
  '146.56.0.0/14',
  '150.136.0.0/13',
  '152.67.0.0/16',
  '152.70.0.0/15',
  '155.248.0.0/14',
  '158.101.0.0/16',
  '168.138.0.0/15',
  '193.122.0.0/15',
];

// ---------------------------------------------------------------------------
// Pre-parsed CIDR lookup table (computed once at module load)
// ---------------------------------------------------------------------------

interface ParsedCIDR {
  network: number;   // Unsigned 32-bit network address (masked)
  mask: number;      // Unsigned 32-bit subnet mask
}

function parseCIDR(cidr: string): ParsedCIDR {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  const parts = ip.split('.').map(Number);
  const ipNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  return { network: (ipNum & mask) >>> 0, mask };
}

function ipToUint32(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Parse all CIDRs at startup
const parsedCIDRs: ParsedCIDR[] = CLOUD_CIDRS.map(parseCIDR);

// Parse allowlist from env (comma-separated IPs to exempt)
function getAllowlist(): Set<string> {
  const raw = process.env.CLOUD_IP_ALLOWLIST;
  if (!raw) return new Set();
  return new Set(raw.split(',').map(ip => ip.trim()).filter(Boolean));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an IPv4 address belongs to a known cloud provider.
 */
export function isCloudIP(ip: string): boolean {
  // Skip private / loopback ranges
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.')) return false;
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return false; // 172.16-31.x.x = private
  }

  // IPv6 addresses are not checked (pass through)
  if (ip.includes(':')) return false;

  const ipNum = ipToUint32(ip);
  if (ipNum === 0) return false;

  for (const cidr of parsedCIDRs) {
    if (((ipNum & cidr.mask) >>> 0) === cidr.network) {
      return true;
    }
  }
  return false;
}

/**
 * Extract client IP from request headers.
 * Behind Caddy reverse proxy, the last entry in X-Forwarded-For is the real client IP.
 */
function getClientIP(c: Context): string | null {
  // X-Forwarded-For: take the LAST entry (appended by our trusted proxy, Caddy).
  // We do NOT trust X-Real-IP since Caddy doesn't set it — an attacker could spoof it.
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim()).filter(Boolean);
    return ips[ips.length - 1] || null;
  }

  return null;
}

/**
 * Middleware that blocks cloud/datacenter IPs from executing runs.
 * Only applied to POST /runs (run creation) — not reads.
 *
 * Disable with CLOUD_IP_FILTER=false env var.
 * Allowlist specific IPs with CLOUD_IP_ALLOWLIST=1.2.3.4,5.6.7.8
 */
export async function cloudIPFilterMiddleware(c: Context, next: Next) {
  // Only filter POST requests (run creation)
  if (c.req.method !== 'POST') return next();

  // Check if filtering is disabled
  if (process.env.CLOUD_IP_FILTER === 'false') return next();

  const clientIP = getClientIP(c);

  // Fail-open if we can't determine the IP (local dev without proxy)
  if (!clientIP) return next();

  // Check allowlist
  const allowlist = getAllowlist();
  if (allowlist.has(clientIP)) return next();

  if (isCloudIP(clientIP)) {
    logger.info('Blocked cloud IP from run execution', { ip: clientIP, path: c.req.path });
    return c.json({
      error: 'Cloud IP not allowed',
      message: 'This request was blocked because it came from a server, not a personal device. Please try from your own computer or phone.',
    }, 403);
  }

  return next();
}
