import { describe, it, expect } from 'vitest';
import { isCloudIP } from '../src/middleware/ip-filter.js';

describe('isCloudIP', () => {
  // AWS ranges
  it('detects AWS EC2 IPs', () => {
    expect(isCloudIP('3.5.140.2')).toBe(true);      // 3.0.0.0/8
    expect(isCloudIP('18.216.0.1')).toBe(true);      // 18.0.0.0/8
    expect(isCloudIP('54.239.28.85')).toBe(true);    // 54.128.0.0/9
    expect(isCloudIP('52.15.0.1')).toBe(true);       // 52.0.0.0/10
  });

  // GCP ranges
  it('detects GCP IPs', () => {
    expect(isCloudIP('35.192.0.1')).toBe(true);      // 35.192.0.0/11
    expect(isCloudIP('104.154.0.1')).toBe(true);     // 104.154.0.0/15
  });

  // Azure ranges
  it('detects Azure IPs', () => {
    expect(isCloudIP('20.50.0.1')).toBe(true);       // 20.0.0.0/8
    expect(isCloudIP('40.76.0.1')).toBe(true);       // 40.64.0.0/10
  });

  // DigitalOcean ranges
  it('detects DigitalOcean IPs', () => {
    expect(isCloudIP('164.90.1.1')).toBe(true);      // 164.90.0.0/16
    expect(isCloudIP('138.197.0.1')).toBe(true);     // 138.197.0.0/16
  });

  // Hetzner ranges
  it('detects Hetzner IPs', () => {
    expect(isCloudIP('65.21.90.216')).toBe(true);    // 65.21.0.0/16 (our own server!)
    expect(isCloudIP('95.217.0.1')).toBe(true);      // 95.216.0.0/14
    expect(isCloudIP('49.13.0.1')).toBe(true);       // 49.12.0.0/14
  });

  // OVH ranges
  it('detects OVH IPs', () => {
    expect(isCloudIP('51.77.0.1')).toBe(true);       // 51.77.0.0/16
    expect(isCloudIP('54.37.0.1')).toBe(true);       // 54.36.0.0/14
  });

  // Private / loopback — should NOT be flagged as cloud
  it('allows private and loopback IPs', () => {
    expect(isCloudIP('127.0.0.1')).toBe(false);
    expect(isCloudIP('10.0.0.1')).toBe(false);
    expect(isCloudIP('192.168.1.1')).toBe(false);
    expect(isCloudIP('172.16.0.1')).toBe(false);
    expect(isCloudIP('172.31.255.255')).toBe(false);
    expect(isCloudIP('::1')).toBe(false);
  });

  // Residential IPs — should NOT be flagged
  it('allows residential IPs', () => {
    expect(isCloudIP('86.56.100.1')).toBe(false);    // German residential
    expect(isCloudIP('73.162.0.1')).toBe(false);     // US Comcast
    expect(isCloudIP('24.5.0.1')).toBe(false);       // US cable ISP
    expect(isCloudIP('82.132.0.1')).toBe(false);     // UK residential
    expect(isCloudIP('203.0.113.1')).toBe(false);    // TEST-NET-3 (not cloud)
  });

  // Edge cases
  it('handles invalid IPs gracefully', () => {
    expect(isCloudIP('')).toBe(false);
    expect(isCloudIP('not-an-ip')).toBe(false);
    expect(isCloudIP('999.999.999.999')).toBe(false);
  });

  // 172.x private range edge: Linode uses 172.104.0.0/15 which is NOT private
  it('correctly handles 172.x non-private ranges', () => {
    expect(isCloudIP('172.16.0.1')).toBe(false);     // Private (172.16-31)
    expect(isCloudIP('172.104.0.1')).toBe(true);     // Linode (not private)
    expect(isCloudIP('172.232.0.1')).toBe(true);     // Linode (not private)
  });
});
