import { RandomizationError } from "../disclosure/privacy";
import {
  SUBJECT_ID_MASK_MAX_LENGTH,
  SUBJECT_ID_TOKEN_BOUNDS,
  type LegacyMaskMigrationResult,
  type ParsedSubjectIdMask,
  type ParsedSubjectIdMaskResult,
  type PrngStream,
  type SubjectIdContext,
  type SubjectIdGenerator,
  type SubjectIdMaskPreviewResult,
  type SubjectIdMaskSegment,
  type ValidationFinding,
} from "../../types";

const RND_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Computes the documented randomization check digit:
 * extracts ASCII digits 0-9 (empty yields 0), starts from the rightmost digit
 * initially undoubled, doubles alternate preceding digits (subtracting 9 when
 * greater than 9), and returns `(10 - (sum % 10)) % 10`.
 */
export function computeRandomizationCheckDigit(input: string): number {
  const digits: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      digits.push(code - 48);
    }
  }
  if (digits.length === 0) return 0;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits[i];
    if (shouldDouble) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    shouldDouble = !shouldDouble;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Explicitly migrates supported legacy bracket tokens (`[SiteID]`,
 * `[StratumCode]`, and 1-12 `[0...]` / `[#...]` padded sequence masks) to
 * modern `{SITE}`, `{STRATUM}`, and `{SEQ:n}` syntax.
 */
export function migrateLegacySubjectIdMask(
  pattern: string
): LegacyMaskMigrationResult {
  let migrated = pattern
    .replaceAll("[SiteID]", "{SITE}")
    .replaceAll("[StratumCode]", "{STRATUM}");

  migrated = migrated.replace(
    /\[(0{1,12}|#{1,12})\]/g,
    (_match, inner: string) => {
      return `{SEQ:${inner.length}}`;
    }
  );

  return Object.freeze({
    changed: migrated !== pattern,
    pattern: migrated,
  });
}

function invalidMaskFinding(message: string): ValidationFinding {
  return {
    code: "INVALID_SUBJECT_ID_MASK",
    severity: "error",
    fieldPath: "subjectIdMask.pattern",
    message,
  };
}

function parseBoundedTokenParam(
  raw: string,
  min: number,
  max: number
): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

/**
 * Parses and validates a modern subject identifier mask against the bounded
 * grammar: `{SITE}`, `{STRATUM}`, `{SEQ:n}` (1..12), `{RND:n}` (1..32), and
 * at most one `{CHECKSUM}`, with total pattern length at most 128 characters.
 * Unmigrated legacy `[...]` bracket tokens are rejected until explicitly migrated.
 */
export function parseSubjectIdMask(pattern: string): ParsedSubjectIdMaskResult {
  const findings: ValidationFinding[] = [];
  if (pattern.length === 0 || pattern.length > SUBJECT_ID_MASK_MAX_LENGTH) {
    findings.push(
      invalidMaskFinding(
        `Subject ID mask must be between 1 and ${SUBJECT_ID_MASK_MAX_LENGTH} characters.`
      )
    );
    return { ok: false, findings };
  }

  if (pattern.includes("[") || pattern.includes("]")) {
    findings.push(
      invalidMaskFinding(
        "Unmigrated square-bracket tokens are not permitted; run explicit legacy mask migration first."
      )
    );
    return { ok: false, findings };
  }

  const segments: SubjectIdMaskSegment[] = [];
  let checksumCount = 0;
  let hasRandomToken = false;
  let cursor = 0;

  while (cursor < pattern.length) {
    const openIdx = pattern.indexOf("{", cursor);
    const closeIdx = pattern.indexOf("}", cursor);

    if (closeIdx !== -1 && (openIdx === -1 || closeIdx < openIdx)) {
      findings.push(
        invalidMaskFinding(
          `Unmatched closing brace "}" at position ${closeIdx}.`
        )
      );
      break;
    }

    if (openIdx === -1) {
      segments.push({ kind: "literal", value: pattern.slice(cursor) });
      break;
    }

    if (openIdx > cursor) {
      segments.push({ kind: "literal", value: pattern.slice(cursor, openIdx) });
    }

    const endIdx = pattern.indexOf("}", openIdx + 1);
    if (endIdx === -1) {
      findings.push(
        invalidMaskFinding(`Unclosed token brace "{" at position ${openIdx}.`)
      );
      break;
    }

    const tokenBody = pattern.slice(openIdx + 1, endIdx);
    if (tokenBody.includes("{")) {
      findings.push(
        invalidMaskFinding(
          `Nested or malformed brace inside token "{${tokenBody}}".`
        )
      );
      break;
    }

    if (tokenBody === "SITE") {
      segments.push({ kind: "site" });
    } else if (tokenBody === "STRATUM") {
      segments.push({ kind: "stratum" });
    } else if (tokenBody === "CHECKSUM") {
      checksumCount += 1;
      if (checksumCount > 1) {
        findings.push(
          invalidMaskFinding(
            "Subject ID mask may contain at most one {CHECKSUM} token."
          )
        );
      } else {
        segments.push({ kind: "checksum" });
      }
    } else if (tokenBody.startsWith("SEQ:")) {
      const width = parseBoundedTokenParam(
        tokenBody.slice(4),
        SUBJECT_ID_TOKEN_BOUNDS.minSeqWidth,
        SUBJECT_ID_TOKEN_BOUNDS.maxSeqWidth
      );
      if (width === null) {
        findings.push(
          invalidMaskFinding(
            `{SEQ:n} width must be a canonical integer between ${SUBJECT_ID_TOKEN_BOUNDS.minSeqWidth} and ${SUBJECT_ID_TOKEN_BOUNDS.maxSeqWidth}.`
          )
        );
      } else {
        segments.push({ kind: "seq", width });
      }
    } else if (tokenBody.startsWith("RND:")) {
      const length = parseBoundedTokenParam(
        tokenBody.slice(4),
        SUBJECT_ID_TOKEN_BOUNDS.minRndLength,
        SUBJECT_ID_TOKEN_BOUNDS.maxRndLength
      );
      if (length === null) {
        findings.push(
          invalidMaskFinding(
            `{RND:n} length must be a canonical integer between ${SUBJECT_ID_TOKEN_BOUNDS.minRndLength} and ${SUBJECT_ID_TOKEN_BOUNDS.maxRndLength}.`
          )
        );
      } else {
        hasRandomToken = true;
        segments.push({ kind: "rnd", length });
      }
    } else {
      findings.push(
        invalidMaskFinding(`Unknown or malformed mask token "{${tokenBody}}".`)
      );
    }

    cursor = endIdx + 1;
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }

  const mask: ParsedSubjectIdMask = Object.freeze({
    pattern,
    segments: Object.freeze(segments),
    hasRandomToken,
    hasChecksum: checksumCount === 1,
  });
  return { ok: true, mask };
}

function renderParsedMask(
  mask: ParsedSubjectIdMask,
  context: SubjectIdContext,
  sequenceNumber: number,
  drawRandomChars: (length: number) => string
): string {
  const parts: string[] = [];
  let checksumSlot = -1;

  for (const segment of mask.segments) {
    switch (segment.kind) {
      case "literal":
        parts.push(segment.value);
        break;
      case "site":
        parts.push(context.siteCode);
        break;
      case "stratum":
        parts.push(context.stratumLabel);
        break;
      case "seq":
        parts.push(String(sequenceNumber).padStart(segment.width, "0"));
        break;
      case "rnd":
        parts.push(drawRandomChars(segment.length));
        break;
      case "checksum":
        checksumSlot = parts.length;
        parts.push("");
        break;
    }
  }

  if (checksumSlot !== -1) {
    const withoutChecksum = parts.join("");
    parts[checksumSlot] = String(
      computeRandomizationCheckDigit(withoutChecksum)
    );
  }

  return parts.join("");
}

/**
 * Renders a deterministic example subject identifier for UI mask feedback
 * without consuming any allocation or identifier PRNG stream.
 */
export function previewSubjectIdMask(
  pattern: string,
  sample: Partial<SubjectIdContext> = {}
): SubjectIdMaskPreviewResult {
  const parsed = parseSubjectIdMask(pattern);
  if (!parsed.ok) {
    return { ok: false, findings: parsed.findings };
  }

  const exampleId = renderParsedMask(
    parsed.mask,
    {
      siteCode: sample.siteCode ?? "S01",
      stratumLabel: sample.stratumLabel ?? "STR",
    },
    1,
    (length) => {
      let out = "";
      for (let i = 0; i < length; i += 1) {
        out += RND_ALPHABET[i % RND_ALPHABET.length];
      }
      return out;
    }
  );

  return { ok: true, exampleId };
}

/**
 * Creates a stateful subject identifier generator using an isolated identifier
 * PRNG stream, per-site sequence counters starting at 1 across intersections,
 * and global collision detection (up to 100 retries when `{RND:n}` is present,
 * immediate failure otherwise).
 */
export function createSubjectIdGenerator(
  pattern: string,
  identifierStream: PrngStream
): SubjectIdGenerator {
  const parsed = parseSubjectIdMask(pattern);
  if (!parsed.ok) {
    throw new RandomizationError("SUBJECT_ID_MASK_INVALID");
  }
  const mask = parsed.mask;
  const siteCounters = new Map<string, number>();
  const seenIds = new Set<string>();

  function drawRandomChars(length: number): string {
    let out = "";
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(
        identifierStream.nextFloat() * RND_ALPHABET.length
      );
      out += RND_ALPHABET[idx];
    }
    return out;
  }

  function nextId(context: SubjectIdContext): string {
    const nextSeq = (siteCounters.get(context.siteCode) ?? 0) + 1;
    siteCounters.set(context.siteCode, nextSeq);

    const maxAttempts = mask.hasRandomToken
      ? 1 + SUBJECT_ID_TOKEN_BOUNDS.maxCollisionRetries
      : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const candidate = renderParsedMask(
        mask,
        context,
        nextSeq,
        drawRandomChars
      );
      if (!seenIds.has(candidate)) {
        seenIds.add(candidate);
        return candidate;
      }
    }

    if (mask.hasRandomToken) {
      // The code alone leaves the process, never the site code or mask.
      throw new RandomizationError("SUBJECT_ID_COLLISION");
    }
    throw new RandomizationError("SUBJECT_ID_COLLISION");
  }

  return Object.freeze({ nextId });
}
