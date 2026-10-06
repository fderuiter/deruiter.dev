import {
  BOOTH_CREW,
  MODIFIER_LABELS,
  getKdsTickets,
  getPosBreadcrumb,
  getPosScreen,
  type KdsTicket,
  type TicketLineStatus,
  type TicketSource,
} from "@/lib/patty-drive-thru";

/** Pixel size of the register screen's canvas texture (4:3, like the bezel). */
export const POS_TEXTURE_WIDTH = 640;
export const POS_TEXTURE_HEIGHT = 480;

/**
 * Colours of the register screen in the 3D booth. They match the cabinet's
 * --pdt-screen-* and --pdt-key-* tokens, drawn into a texture.
 */
const POS_COLORS = {
  screen: "#1c2a33",
  text: "#dcefe6",
  dim: "#9fb8b0",
  ok: "#9fe3a8",
  alert: "#ffb199",
  rule: "rgba(220, 239, 230, 0.2)",
  key: "#e7e1cc",
  keyActive: "#f2d16b",
  keyDisabled: "#6f7a75",
  bump: "#e2b84c",
  ink: "#1f1d17",
} as const;

/** An order tab on the register: a ticket without its ticking clocks. */
type PosTab = Pick<
  KdsTicket,
  "orderId" | "ready" | "active" | "needsCoworker" | "lines"
>;

/** Everything the register screen shows, read from the shift in one go. */
interface PosPicture {
  breadcrumb: string;
  tickets: readonly PosTab[];
  keys: readonly string[];
}

/**
 * Reads what the register screen shows. It leaves out the order ages, so the
 * picture only changes when something on the screen does.
 */
export function readPosPicture(state: TicketSource): PosPicture {
  const screen = getPosScreen(state);
  return {
    breadcrumb: getPosBreadcrumb(state).join(" › "),
    tickets: getKdsTickets(state).map((ticket) => ({
      orderId: ticket.orderId,
      ready: ticket.ready,
      active: ticket.active,
      needsCoworker: ticket.needsCoworker,
      lines: ticket.lines,
    })),
    keys: (screen.children ?? []).map(
      (node) => `${node.label}${node.children ? " ›" : ""}`
    ),
  };
}

function key(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = POS_COLORS.ink;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2, w - 10);
}

/**
 * Draws a picture of the register on the 3D screen: the order strip, the open
 * ticket, the menu keys and the order actions. It is only a picture; the real
 * register is the DOM one that opens over the booth.
 */
export function drawPos(
  ctx: CanvasRenderingContext2D,
  picture: PosPicture,
  width = POS_TEXTURE_WIDTH,
  height = POS_TEXTURE_HEIGHT
): void {
  const pad = 14;
  ctx.fillStyle = POS_COLORS.screen;
  ctx.fillRect(0, 0, width, height);

  // Title bar.
  ctx.fillStyle = POS_COLORS.text;
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("PATTY'S POS 2.1", pad, 22);
  ctx.fillStyle = POS_COLORS.dim;
  ctx.textAlign = "right";
  ctx.font = "16px monospace";
  ctx.fillText(picture.breadcrumb.toUpperCase(), width - pad, 22, width / 2);
  ctx.fillStyle = POS_COLORS.rule;
  ctx.fillRect(pad, 40, width - pad * 2, 2);

  // Order strip.
  const active = picture.tickets.find((t) => t.active) ?? null;
  if (picture.tickets.length === 0) {
    ctx.fillStyle = POS_COLORS.dim;
    ctx.textAlign = "left";
    ctx.font = "18px monospace";
    ctx.fillText("No cars. Wipe something.", pad, 74);
  } else {
    picture.tickets.forEach((ticket, index) => {
      key(
        ctx,
        `#${ticket.orderId}${ticket.ready ? " ✓" : ""}`,
        pad + index * 100,
        54,
        90,
        40,
        ticket.active ? POS_COLORS.keyActive : POS_COLORS.key
      );
    });
  }

  // The open ticket.
  ctx.strokeStyle = POS_COLORS.rule;
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, 106, width - pad * 2, 132);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  if (active) {
    ctx.fillStyle = POS_COLORS.text;
    ctx.font = "bold 20px monospace";
    ctx.fillText(`Order #${active.orderId}`, pad + 10, 114);
    active.lines.slice(0, 4).forEach((line, index) => {
      const y = 142 + index * 23;
      ctx.font = "18px monospace";
      ctx.fillStyle = POS_COLORS.text;
      const modifier = line.modifier
        ? ` · ${MODIFIER_LABELS[line.modifier]}${line.modifierPending ? "?" : " ✓"}`
        : "";
      ctx.fillText(`${line.label}${modifier}`, pad + 10, y, width * 0.6);
      const alert = line.status === "dropped" || line.status === "locked";
      ctx.fillStyle = alert
        ? POS_COLORS.alert
        : line.status === "rung" || line.status === "ready-to-ring"
          ? POS_COLORS.ok
          : POS_COLORS.dim;
      ctx.textAlign = "right";
      ctx.fillText(statusText(line.status), width - pad - 10, y);
      ctx.textAlign = "left";
    });
  } else {
    ctx.fillStyle = POS_COLORS.dim;
    ctx.font = "18px monospace";
    ctx.fillText("Pick an order to ring it up.", pad + 10, 116);
  }

  // Menu keys, four to a row.
  const columns = 4;
  const gap = 10;
  const keyWidth = (width - pad * 2 - gap * (columns - 1)) / columns;
  picture.keys.slice(0, 8).forEach((label, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    key(
      ctx,
      label,
      pad + column * (keyWidth + gap),
      252 + row * 64,
      keyWidth,
      54,
      POS_COLORS.key
    );
  });

  // Order actions.
  const actions: [string, boolean][] = [
    ["‹ Back", true],
    [`Flag ${BOOTH_CREW.coworker}`, !!active?.needsCoworker],
    ["Bump order", !!active],
  ];
  const actionWidth = (width - pad * 2 - gap * 2) / 3;
  actions.forEach(([label, enabled], index) => {
    key(
      ctx,
      label,
      pad + index * (actionWidth + gap),
      height - pad - 50,
      actionWidth,
      50,
      !enabled
        ? POS_COLORS.keyDisabled
        : index === 2
          ? POS_COLORS.bump
          : POS_COLORS.key
    );
  });
}

function statusText(status: TicketLineStatus): string {
  switch (status) {
    case "to-ring":
      return "to ring";
    case "rung":
      return "rung";
    case "dropped":
      return "DROPPED";
    case "locked":
      return "18+";
    case "brewing":
      return "brewing";
    case "ready-to-ring":
      return "ready";
  }
}
