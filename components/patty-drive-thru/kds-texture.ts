import {
  MAX_OPEN_ORDERS,
  MODIFIER_LABELS,
  formatClock,
  type KdsBand,
  type KdsTicket,
  type TicketLine,
} from "@/lib/patty-drive-thru";

/** Pixel size of the kitchen display's canvas texture. */
export const KDS_TEXTURE_WIDTH = 1024;
export const KDS_TEXTURE_HEIGHT = 384;

/**
 * Colours of the kitchen display. They are the 3D screen's own palette, drawn
 * into a texture, so they do not use the page's CSS tokens.
 */
const KDS_COLORS = {
  background: "#0b100e",
  text: "#e6efe4",
  dim: "#93a397",
  alert: "#ff9c7a",
  active: "#f4f1d2",
  bands: {
    green: "#3e7b4b",
    yellow: "#b8952a",
    red: "#a9412f",
  } satisfies Record<KdsBand, string>,
} as const;

function lineText(line: TicketLine): { text: string; alert: boolean } {
  switch (line.status) {
    case "dropped":
      return { text: `${line.label} DROPPED`, alert: true };
    case "locked":
      return { text: `${line.label} 18+`, alert: true };
    case "brewing":
      return { text: `${line.label} brewing`, alert: false };
    case "rung":
      return { text: `${line.label} ✓`, alert: false };
    default:
      return { text: line.label, alert: false };
  }
}

/**
 * Draws the kitchen display: one column per open order, oldest on the left,
 * each headed by its age band. The 3D scene uploads the result as a texture.
 */
export function drawKds(
  ctx: CanvasRenderingContext2D,
  tickets: readonly KdsTicket[],
  width = KDS_TEXTURE_WIDTH,
  height = KDS_TEXTURE_HEIGHT
): void {
  ctx.fillStyle = KDS_COLORS.background;
  ctx.fillRect(0, 0, width, height);

  if (tickets.length === 0) {
    ctx.fillStyle = KDS_COLORS.dim;
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NO ORDERS", width / 2, height / 2);
    ctx.textAlign = "left";
    return;
  }

  const gap = 10;
  const columns = MAX_OPEN_ORDERS;
  const columnWidth = (width - gap * (columns + 1)) / columns;
  const header = 58;

  tickets.slice(0, columns).forEach((ticket, index) => {
    const x = gap + index * (columnWidth + gap);
    ctx.fillStyle = KDS_COLORS.bands[ticket.band];
    ctx.fillRect(x, gap, columnWidth, header);

    ctx.fillStyle = KDS_COLORS.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 30px monospace";
    ctx.fillText(`#${ticket.orderId}`, x + 10, gap + header / 2);
    ctx.textAlign = "right";
    ctx.font = "bold 26px monospace";
    ctx.fillText(
      formatClock(ticket.ageSec),
      x + columnWidth - 10,
      gap + header / 2
    );

    if (ticket.active) {
      ctx.strokeStyle = KDS_COLORS.active;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, gap + 2, columnWidth - 4, height - gap * 2 - 4);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = gap + header + 12;
    for (const line of ticket.lines) {
      const { text, alert } = lineText(line);
      ctx.fillStyle = alert ? KDS_COLORS.alert : KDS_COLORS.text;
      ctx.font = "bold 24px monospace";
      ctx.fillText(text, x + 10, y, columnWidth - 20);
      y += 32;
      if (line.modifier) {
        ctx.fillStyle = line.modifierPending
          ? KDS_COLORS.alert
          : KDS_COLORS.dim;
        ctx.font = "22px monospace";
        ctx.fillText(
          `  ${MODIFIER_LABELS[line.modifier].toUpperCase()}`,
          x + 10,
          y,
          columnWidth - 20
        );
        y += 30;
      }
    }

    if (ticket.ready) {
      ctx.fillStyle = KDS_COLORS.text;
      ctx.font = "bold 24px monospace";
      ctx.fillText("READY", x + 10, height - gap - 40);
    }
  });
}
