import { clamp } from "@/lib/game-utils";
import {
  drawOutfitAvatar,
  isSubjectFullyCompliant,
  type AuditorState,
  type ClinicalSubject,
  type OutfitConfig,
} from "@/lib/clinical-trial-chaos";

/** A sparkle drawn over the conveyor after a submission. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
}

/** Layout of the conveyor canvas at a given logical size. */
export function getConveyorGeometry(width: number, height: number) {
  const compact = width <= 500;
  const narrow = width < 280;
  const visibleSlots = narrow ? 2 : compact ? 3 : 5;
  const subjectHeight = compact ? Math.min(52, height - 36) : 52;
  const subjectTop = compact
    ? Math.max(30, (height - subjectHeight) / 2 + 8)
    : height * 0.57 - 26;
  const beltY = compact ? subjectTop + subjectHeight / 2 : height * 0.57;
  return {
    compact,
    narrow,
    visibleSlots,
    beltY,
    beltHeight: compact ? Math.min(44, height - beltY - 4) : 44,
    subjectTop,
    subjectHeight,
    slotWidth: (width - 70) / visibleSlots,
  };
}

/**
 * The slice of the queue the canvas shows. The window follows the selected
 * subject so a selection past the visible slots (via the arrow keys or the
 * dossier) is
 * still drawn, highlighted and tappable.
 */
export function getVisibleSubjects<T extends { id: string }>(
  subjects: T[],
  selectedId: string | null,
  visibleSlots: number
): T[] {
  const selectedIndex = subjects.findIndex((s) => s.id === selectedId);
  const start =
    selectedIndex >= visibleSlots ? selectedIndex - visibleSlots + 1 : 0;
  return subjects.slice(start, start + visibleSlots);
}

/** What the conveyor frame shows beyond the simulation state. */
interface ConveyorDrawOptions {
  selectedSubjectId: string | null;
  floorColor: string;
  outfit: OutfitConfig;
}

/**
 * Draws one conveyor frame: the belt, the visible subject parcels, the
 * player's desk, the auditor and the sparkle particles, which it also
 * advances and prunes.
 */
export function drawConveyor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  auditorState: AuditorState,
  subjects: ClinicalSubject[],
  particles: Particle[],
  { selectedSubjectId, floorColor, outfit }: ConveyorDrawOptions
): void {
  ctx.clearRect(0, 0, width, height);

  // Background Grid (tinted per office floor)
  ctx.fillStyle = floorColor;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // The narrow canvas is a compact queue map; the DOM dossier below it
  // remains the full-fidelity way to inspect and process observations.
  const {
    compact,
    narrow,
    visibleSlots,
    beltY,
    beltHeight,
    subjectTop,
    subjectHeight,
    slotWidth,
  } = getConveyorGeometry(width, height);
  ctx.fillStyle = "#18181b";
  ctx.fillRect(20, beltY, width - 40, beltHeight);

  // Rollers Animation
  ctx.fillStyle = "#27272a";
  const rollerCount = compact ? 12 : 28;
  const timeOffset = (Date.now() / 35) % 20;
  for (let i = 0; i < rollerCount; i++) {
    const rx = 24 + i * ((width - 48) / rollerCount) + timeOffset;
    if (rx < width - 24) {
      ctx.fillRect(rx, beltY + 4, 3, beltHeight - 8);
    }
  }

  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, beltY, width - 40, beltHeight);

  // Conveyor Subject Parcels
  getVisibleSubjects(subjects, selectedSubjectId, visibleSlots).forEach(
    (subj, idx) => {
      const px = 28 + idx * slotWidth;
      const py = subjectTop;

      const isSelected = subj.id === selectedSubjectId;
      ctx.fillStyle = subj.isSAE
        ? "#7f1d1d"
        : isSelected
          ? "#1e3a8a"
          : "#1f2937";
      ctx.strokeStyle = subj.isSAE
        ? "#ef4444"
        : isSelected
          ? "#38bdf8"
          : "#4b5563";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillRect(px, py, slotWidth - 10, subjectHeight);
      ctx.strokeRect(px, py, slotWidth - 10, subjectHeight);

      // Subject Label
      ctx.fillStyle = "#f3f4f6";
      ctx.font = "bold 10px monospace";
      ctx.fillText(subj.subjectLabel, px + 6, py + 16);

      // SAE Badge or Domain Badge
      if (subj.isSAE && !narrow) {
        // Right-aligned so it ends before the status pip; light text reads on the red card
        ctx.fillStyle = "#fecaca";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "right";
        ctx.fillText("⚡ SAE", px + slotWidth - 26, py + 16);
        ctx.textAlign = "left";
      }

      // Compliance status pip
      const allClean = isSubjectFullyCompliant(subj);
      if (!narrow) {
        ctx.fillStyle = allClean ? "#10b981" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(px + slotWidth - 18, py + 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mini timer bar
      const timePercent = Math.max(0, subj.timeRemaining / subj.maxTime);
      ctx.fillStyle = "#374151";
      ctx.fillRect(px + 6, py + subjectHeight - 14, slotWidth - 22, 5);
      ctx.fillStyle =
        timePercent < 0.25
          ? "#ef4444"
          : timePercent < 0.5
            ? "#f59e0b"
            : "#3b82f6";
      ctx.fillRect(
        px + 6,
        py + subjectHeight - 14,
        (slotWidth - 22) * timePercent,
        5
      );
    }
  );

  if (!compact) {
    // Preserve the chosen outfit in the narrow right-side desk lane.
    // The lane starts after the fifth parcel, avoiding belt/card overlap.
    const deskX = width - 46;
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(deskX, height - 13, 34, 4);
    ctx.fillRect(deskX + 3, height - 9, 3, 8);
    ctx.fillRect(deskX + 28, height - 9, 3, 8);
    drawOutfitAvatar(ctx, width - 29, height - 6, outfit, 0.82);
    ctx.fillStyle = "#f4f4f6";
    ctx.font = "bold 8px monospace";
    ctx.fillText("YOU", deskX + 8, height - 49);
  }

  // Auditor Sprite on Top Patrol Floor
  const auditorX = 50 + auditorState.x * (width - 100);
  const auditorY = 44;

  if (compact) {
    ctx.fillStyle = "#f4f4f6";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`FDA ${Math.round(auditorState.suspicion)}%`, 20, 20);
    ctx.textAlign = "right";
    ctx.fillText(`QUEUE ${subjects.length}/5`, width - 24, 20);
    ctx.textAlign = "left";
  } else {
    // Suspicion Aura
    const suspRatio = auditorState.suspicion / 100;
    if (suspRatio > 0.2) {
      const grad = ctx.createRadialGradient(
        auditorX,
        auditorY,
        4,
        auditorX,
        auditorY,
        36
      );
      grad.addColorStop(0, `rgba(239, 68, 68, ${suspRatio * 0.45})`);
      grad.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(auditorX, auditorY, 36, 0, Math.PI * 2);
      ctx.fill();
    }

    // Auditor Body
    ctx.fillStyle =
      auditorState.behavior === "issuing_483"
        ? "#dc2626"
        : auditorState.behavior === "coffee_break"
          ? "#8b5cf6"
          : auditorState.behavior === "suspicious"
            ? "#ea580c"
            : "#0284c7";
    ctx.fillRect(auditorX - 10, auditorY - 14, 20, 28);

    // Clipboard / Coffee Cup
    if (auditorState.behavior === "coffee_break") {
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(auditorX + 5, auditorY - 8, 8, 10);
    } else {
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(
        auditorX + (auditorState.direction > 0 ? 4 : -12),
        auditorY - 6,
        8,
        12
      );
    }

    // Head
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.arc(auditorX, auditorY - 18, 7, 0, Math.PI * 2);
    ctx.fill();

    // Glasses / Hat
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(auditorX - 8, auditorY - 26, 16, 4);
    ctx.fillRect(auditorX - 5, auditorY - 30, 10, 5);

    // Auditor Name / Status Tag
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      auditorState.behavior === "coffee_break"
        ? "☕ FDA COFFEE BREAK"
        : `FDA AUDITOR [${Math.round(auditorState.suspicion)}%]`,
      // Pinned to the left inset when the canvas is narrower than 160px.
      clamp(auditorX, 80, Math.max(80, width - 80)),
      auditorY - 34
    );
    ctx.textAlign = "left";
  }

  // Render Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.02;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
