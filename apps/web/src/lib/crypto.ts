/**
 * Cryptographic Forensic Sealing Utilities (SIH26143)
 * Implements NIST FIPS PUB 180-4 compliant SHA-256 hashing for maritime legal dossiers.
 * Zero external dependencies; works synchronously in all environments.
 */

// Round constants: first 32 bits of fractional parts of cube roots of first 64 primes (2..311)
const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, b: number): number {
  return (n >>> b) | (n << (32 - b));
}

/**
 * Pure synchronous SHA-256 implementation producing a 64-character hexadecimal digest.
 */
export function sha256Sync(input: string): string {
  // Convert string to UTF-8 bytes
  const utf8: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let c = input.charCodeAt(i);
    if (c < 128) {
      utf8.push(c);
    } else if (c < 2048) {
      utf8.push(192 | (c >> 6), 128 | (c & 63));
    } else if (c < 55296 || c >= 57344) {
      utf8.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    } else {
      i++;
      c = 65536 + (((c & 1023) << 10) | (input.charCodeAt(i) & 1023));
      utf8.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
  }

  // Pre-processing / Padding: append 0x80 then pad with 0s until length % 64 === 56
  const bitLength = utf8.length * 8;
  utf8.push(0x80);
  while (utf8.length % 64 !== 56) {
    utf8.push(0);
  }
  // Append 64-bit big-endian bit length (assuming <= 2^32 bits)
  for (let i = 0; i < 4; i++) {
    utf8.push(0);
  }
  for (let i = 3; i >= 0; i--) {
    utf8.push((bitLength >>> (i * 8)) & 0xff);
  }

  // Initial hash values: first 32 bits of fractional parts of square roots of first 8 primes (2..19)
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const W = new Int32Array(64);

  // Process 512-bit (64-byte) blocks
  for (let i = 0; i < utf8.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const idx = i + t * 4;
      W[t] = (utf8[idx] << 24) | (utf8[idx + 1] << 16) | (utf8[idx + 2] << 8) | utf8[idx + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const hexParts = [h0, h1, h2, h3, h4, h5, h6, h7].map((val) =>
    (val >>> 0).toString(16).padStart(8, '0')
  );
  return hexParts.join('');
}

export interface ForensicEvidenceParams {
  incidentId: string;
  sourceScene: string;
  acquisitionUtc: string;
  centroid: string;
  areaSqKm: number | string;
  culpritMmsi: number | string;
  culpritName: string;
  anomalyScore: number | string;
  volumeLiters?: number | string;
}

/**
 * Builds the canonical manifest string and computes its NIST FIPS 180-4 SHA-256 digest.
 * Cross-platform compatible with Python backend `apps/api/services/pdf_generator.py`.
 */
export function computeForensicEvidenceHash(params: ForensicEvidenceParams): string {
  const areaFormatted = Number(params.areaSqKm || 0).toFixed(2);
  const anomalyFormatted = Number(params.anomalyScore || 0).toFixed(1);
  const volFormatted = params.volumeLiters !== undefined ? String(Math.round(Number(params.volumeLiters))) : '0';

  const canonicalPayload = [
    'OCEANGUARD-FORENSIC-MANIFEST-V1',
    `INCIDENT=${params.incidentId}`,
    `SCENE=${params.sourceScene}`,
    `TIMESTAMP=${params.acquisitionUtc}`,
    `CENTROID=${params.centroid}`,
    `AREA=${areaFormatted}`,
    `VOLUME=${volFormatted}`,
    `CULPRIT_MMSI=${params.culpritMmsi}`,
    `CULPRIT_NAME=${params.culpritName}`,
    `ANOMALY=${anomalyFormatted}`,
  ].join('|');

  return sha256Sync(canonicalPayload);
}

/**
 * Computes SHA-256 for binary files (e.g. generated PDF Blob).
 */
export async function computeBlobSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digestBuf = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digestBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback for environments lacking crypto.subtle
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return sha256Sync(binary);
}
