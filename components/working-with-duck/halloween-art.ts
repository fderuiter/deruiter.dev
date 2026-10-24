/**
 * Halloween mode art (#2737): Duck's costumes and the spooky set dressing
 * for the office and the dog park. Everything is drawn from the same
 * canvas primitives as the rest of the game, in the 800x500 logical space,
 * and nothing here loops on its own: the lanterns only flicker with the
 * game's tick, and stay steady under reduced motion.
 *
 * Costumes draw in two passes. The body pass runs straight after Duck's
 * body, so his near legs and head still sit in front of it; the head pass
 * runs last, like the hats. Duck faces +x in both, as in office-art.
 */
import type {
  DuckAccessory,
  DuckHalloweenCostume,
} from "@/lib/working-with-duck-engine";

type Ctx = CanvasRenderingContext2D;

/** Duck's torso as office-art draws it: centre, radii and tilt. */
interface CostumeBody {
  x: number;
  y: number;
  rx: number;
  ry: number;
  tilt: number;
}

/** Where the head-pass pieces sit, from the pose that drew Duck. */
interface CostumeAnchors {
  head: [number, number];
  /** The head's own rotation, so the hood hugs the skull. */
  headTilt: number;
  feet: Array<[number, number]>;
}

/** The duck suit's plush yellow, its shadow and its seams. */
const PLUSH = { base: "#facc15", light: "#fde68a", shade: "#eab308" };
const PLUSH_SEAM = "#a16207";
const BILL = { base: "#f97316", edge: "#c2410c" };
const CAPE = { outer: "#18181b", lining: "#b91c1c", edge: "#3f3f46" };
const PUMPKIN = { base: "#ea580c", rib: "#c2410c", stem: "#4d7c0f" };

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

/** Costume pieces that cover Duck's torso: the duck suit and the cape. */
export function drawCostumeBody(
  ctx: Ctx,
  kind: DuckAccessory,
  body: CostumeBody,
  neck: [number, number]
) {
  if (kind === "duck-costume") drawDuckSuit(ctx, body);
  else if (kind === "vampire-cape") drawCape(ctx, body, neck);
}

/** Costume pieces drawn over Duck's head and paws. */
export function drawCostumeHead(
  ctx: Ctx,
  kind: DuckHalloweenCostume,
  anchors: CostumeAnchors
) {
  if (kind === "duck-costume") {
    drawDuckHood(ctx, anchors.head, anchors.headTilt);
    for (const [fx, fy] of anchors.feet) drawWebbedBootie(ctx, fx, fy);
  } else if (kind === "witch-hat") {
    drawWitchHat(ctx, anchors.head);
  }
}

/**
 * The plush suit over his back and the wing on his near side. It stops
 * short of the body's outline so a rim of cream coat still shows: it is
 * Duck in a costume, not a yellow dog.
 */
function drawDuckSuit(ctx: Ctx, b: CostumeBody) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.tilt);
  ctx.fillStyle = PLUSH.base;
  ctx.strokeStyle = PLUSH_SEAM;
  ctx.lineWidth = 1.3;
  ellipse(ctx, 0, -b.ry * 0.08, b.rx * 0.86, b.ry * 0.8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PLUSH.light;
  ellipse(ctx, b.rx * 0.05, -b.ry * 0.45, b.rx * 0.55, b.ry * 0.22);
  ctx.fill();

  // Tail feathers poke out at the back
  ctx.fillStyle = PLUSH.base;
  ctx.beginPath();
  ctx.moveTo(-b.rx * 0.8, -b.ry * 0.3);
  ctx.lineTo(-b.rx * 1.08, -b.ry * 0.62);
  ctx.lineTo(-b.rx * 0.98, -b.ry * 0.12);
  ctx.lineTo(-b.rx * 1.12, -b.ry * 0.05);
  ctx.lineTo(-b.rx * 0.82, b.ry * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // The near wing, folded back along his side
  ctx.translate(-b.rx * 0.08, -b.ry * 0.05);
  ctx.rotate(-0.2);
  ctx.fillStyle = PLUSH.shade;
  ctx.beginPath();
  ctx.moveTo(b.rx * 0.38, -b.ry * 0.3);
  ctx.bezierCurveTo(
    b.rx * 0.05,
    -b.ry * 0.72,
    -b.rx * 0.5,
    -b.ry * 0.45,
    -b.rx * 0.66,
    b.ry * 0.12
  );
  ctx.bezierCurveTo(
    -b.rx * 0.38,
    b.ry * 0.36,
    b.rx * 0.08,
    b.ry * 0.3,
    b.rx * 0.38,
    -b.ry * 0.3
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = PLUSH_SEAM;
  ctx.lineWidth = 1;
  for (const f of [-0.45, -0.2, 0.05]) {
    ctx.beginPath();
    ctx.moveTo(b.rx * f, -b.ry * 0.12);
    ctx.lineTo(b.rx * (f - 0.14), b.ry * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The duck hood: a plush shell over the top and back of his head, with
 * the costume's own eye and bill on top. His face, eye and nose stay
 * clear so he still reads as Duck.
 */
function drawDuckHood(ctx: Ctx, [hx, hy]: [number, number], tilt: number) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);

  ctx.fillStyle = PLUSH.base;
  ctx.strokeStyle = PLUSH_SEAM;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, -12);
  ctx.bezierCurveTo(6, -23, -13, -24, -18, -10);
  ctx.bezierCurveTo(-22, 1, -17, 13, -8, 17);
  ctx.quadraticCurveTo(-3, 9, -4, 2);
  ctx.quadraticCurveTo(-3, -6, 8, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The soft rim that frames his face
  ctx.strokeStyle = PLUSH.light;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-7, 15);
  ctx.quadraticCurveTo(-3, 9, -4, 2);
  ctx.quadraticCurveTo(-3, -6, 7, -11);
  ctx.stroke();

  // The bill, pointing the way he faces
  ctx.fillStyle = BILL.base;
  ctx.strokeStyle = BILL.edge;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(1, -21);
  ctx.quadraticCurveTo(14, -24, 18, -18);
  ctx.quadraticCurveTo(14, -13, 2, -15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -18);
  ctx.quadraticCurveTo(11, -18, 17, -18);
  ctx.stroke();
  ctx.fillStyle = BILL.edge;
  ellipse(ctx, 12, -20, 0.9, 0.7);
  ctx.fill();

  // The costume's googly eye
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 1;
  ellipse(ctx, -4, -18, 3.6, 3.6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#18181b";
  ellipse(ctx, -3, -17.6, 1.7, 1.7);
  ctx.fill();

  // A tuft of plush feathers on top
  ctx.strokeStyle = PLUSH_SEAM;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  for (const [x, lean] of [
    [-10, -4],
    [-7, -1],
    [-4, 2],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, -21);
    ctx.quadraticCurveTo(x + lean, -27, x + lean * 1.6, -25);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.restore();
}

/** An orange webbed bootie over a paw, toes pointing forward. */
function drawWebbedBootie(ctx: Ctx, fx: number, fy: number) {
  ctx.fillStyle = BILL.base;
  ctx.strokeStyle = BILL.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4.5 + fx, fy - 6);
  ctx.lineTo(4 + fx, fy - 6);
  ctx.lineTo(4 + fx, fy - 1);
  ctx.lineTo(10 + fx, fy - 0.5);
  ctx.lineTo(8 + fx, fy + 1.5);
  ctx.lineTo(6 + fx, fy + 0.6);
  ctx.lineTo(4.5 + fx, fy + 2.4);
  ctx.lineTo(2 + fx, fy + 1);
  ctx.lineTo(-4.5 + fx, fy + 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A crooked witch's hat with an orange band, perched between his ears. */
function drawWitchHat(ctx: Ctx, [hx, hy]: [number, number]) {
  ctx.save();
  ctx.translate(hx - 1, hy - 12);
  ctx.fillStyle = "#1c1917";
  ctx.strokeStyle = "#57534e";
  ctx.lineWidth = 1;
  ellipse(ctx, 0, 3, 17, 4.5);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9, 2.5);
  ctx.quadraticCurveTo(-5, -9, -5, -15);
  ctx.quadraticCurveTo(-8, -22, -17, -24);
  ctx.quadraticCurveTo(-3, -22, 2, -15);
  ctx.quadraticCurveTo(6, -6, 9, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PUMPKIN.base;
  ctx.beginPath();
  ctx.moveTo(-8.4, 0.5);
  ctx.lineTo(8.3, 0.5);
  ctx.lineTo(7.4, -2.6);
  ctx.lineTo(-7.5, -2.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.strokeRect(-1.8, -2.8, 3.6, 3.4);
  ctx.restore();
}

/**
 * A vampire cape over his back: black outside, red lining showing at the
 * hem, and a high collar that stands up behind his head.
 */
function drawCape(ctx: Ctx, b: CostumeBody, [nx, ny]: [number, number]) {
  const backX = b.x - b.rx * 1.08;
  const hemY = b.y + b.ry * 0.78;
  const shape = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(nx + dx, ny - 3 + dy);
    ctx.quadraticCurveTo(
      b.x + dx,
      b.y - b.ry * 1.3 + dy,
      backX + dx,
      b.y - b.ry * 0.05 + dy
    );
    ctx.lineTo(backX + b.rx * 0.08 + dx, hemY + dy);
    // A scalloped hem back towards the chest
    const front = nx - b.rx * 0.3;
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const x0 = backX + b.rx * 0.08 + ((front - backX) * (i - 0.5)) / steps;
      const x1 = backX + b.rx * 0.08 + ((front - backX) * i) / steps;
      ctx.quadraticCurveTo(
        x0 + dx,
        hemY - 5 + dy,
        x1 + dx,
        hemY - (i === steps ? b.ry * 0.5 : 0) + dy
      );
    }
    ctx.closePath();
  };
  // The lining, a little lower, peeks out under the black
  ctx.fillStyle = CAPE.lining;
  shape(0, 2.5);
  ctx.fill();
  ctx.fillStyle = CAPE.outer;
  ctx.strokeStyle = CAPE.edge;
  ctx.lineWidth = 1.2;
  shape(0, 0);
  ctx.fill();
  ctx.stroke();
  // The standing collar, red inside
  ctx.fillStyle = CAPE.lining;
  ctx.strokeStyle = CAPE.outer;
  ctx.beginPath();
  ctx.moveTo(nx - 12, ny + 1);
  ctx.lineTo(nx - 17, ny - 18);
  ctx.lineTo(nx - 6, ny - 9);
  ctx.lineTo(nx - 1, ny - 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A jack-o'-lantern sitting on the floor at its base point. */
function drawJackOLantern(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  glow: number
) {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y - r * 0.8);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(ctx, 0, r * 0.82, r * 1.1, r * 0.22);
  ctx.fill();
  // Warm light spills on the floor around a lit pumpkin
  if (glow > 0 && typeof ctx.createRadialGradient === "function") {
    const pool = ctx.createRadialGradient(0, r * 0.4, 0, 0, r * 0.4, r * 3);
    pool.addColorStop(0, `rgba(251, 146, 60, ${0.22 * glow})`);
    pool.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = pool;
    ellipse(ctx, 0, r * 0.4, r * 3, r * 2);
    ctx.fill();
  }
  ctx.fillStyle = PUMPKIN.base;
  ctx.strokeStyle = PUMPKIN.rib;
  ctx.lineWidth = 1.2;
  for (const [ox, rx] of [
    [-r * 0.45, r * 0.62],
    [r * 0.45, r * 0.62],
    [0, r * 0.7],
  ]) {
    ellipse(ctx, ox, 0, rx, r * 0.82);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = PUMPKIN.stem;
  ctx.fillRect(-r * 0.1, -r * 1.05, r * 0.2, r * 0.3);
  // Carved face, lit from inside
  ctx.fillStyle =
    glow > 0 ? `rgba(253, 224, 71, ${0.55 + 0.45 * glow})` : "#7c2d12";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.42, -r * 0.08);
    ctx.lineTo(side * r * 0.18, -r * 0.08);
    ctx.lineTo(side * r * 0.3, -r * 0.36);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, r * 0.18);
  ctx.quadraticCurveTo(0, r * 0.72, r * 0.5, r * 0.18);
  ctx.lineTo(r * 0.24, r * 0.3);
  ctx.lineTo(r * 0.12, r * 0.18);
  ctx.lineTo(-r * 0.04, r * 0.32);
  ctx.lineTo(-r * 0.2, r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A corner cobweb: spokes from the corner and sagging threads between. */
function drawCobweb(ctx: Ctx, x: number, y: number, size: number, dir: 1 | -1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.strokeStyle = "rgba(241, 245, 249, 0.4)";
  ctx.lineWidth = 0.8;
  const spokes = [0, 0.4, 0.8, 1.2, Math.PI / 2];
  for (const a of spokes) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.stroke();
  }
  for (const f of [0.35, 0.6, 0.85]) {
    ctx.beginPath();
    for (let i = 0; i < spokes.length - 1; i++) {
      const a0 = spokes[i];
      const a1 = spokes[i + 1];
      const mid = (a0 + a1) / 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * size * f, Math.sin(a0) * size * f);
      ctx.quadraticCurveTo(
        Math.cos(mid) * size * f * 0.82,
        Math.sin(mid) * size * f * 0.82,
        Math.cos(a1) * size * f,
        Math.sin(a1) * size * f
      );
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A paper bat on the garland. */
function drawBat(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.2);
  ctx.quadraticCurveTo(-s * 0.6, -s * 0.9, -s * 1.4, -s * 0.4);
  ctx.quadraticCurveTo(-s * 1.0, -s * 0.2, -s * 1.1, s * 0.25);
  ctx.quadraticCurveTo(-s * 0.7, 0, -s * 0.5, s * 0.3);
  ctx.quadraticCurveTo(-s * 0.3, s * 0.05, 0, s * 0.45);
  ctx.quadraticCurveTo(s * 0.3, s * 0.05, s * 0.5, s * 0.3);
  ctx.quadraticCurveTo(s * 0.7, 0, s * 1.1, s * 0.25);
  ctx.quadraticCurveTo(s * 1.0, -s * 0.2, s * 1.4, -s * 0.4);
  ctx.quadraticCurveTo(s * 0.6, -s * 0.9, 0, -s * 0.2);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ellipse(ctx, -s * 0.14, -s * 0.05, s * 0.07, s * 0.07);
  ctx.fill();
  ellipse(ctx, s * 0.14, -s * 0.05, s * 0.07, s * 0.07);
  ctx.fill();
  ctx.restore();
}

/**
 * How bright a lantern burns this tick: a slow, uneven candle flicker,
 * or a steady flame under reduced motion.
 */
export function lanternGlow(ticks: number, seed: number, calm: boolean) {
  if (calm) return 0.85;
  return (
    0.78 +
    Math.sin(ticks * 0.17 + seed) * 0.12 +
    Math.sin(ticks * 0.41 + seed * 2.3) * 0.08
  );
}

/** Where the office's set dressing sits, clear of every hotspot. */
const OFFICE_LANTERNS: ReadonlyArray<[number, number, number]> = [
  [290, 136, 28],
  [602, 176, 24],
  [262, 474, 26],
  [652, 472, 22],
];

/**
 * The office dressed for Halloween: cobwebs in the top corners, a bat
 * garland along the wall and four jack-o'-lanterns on the floor.
 */
export function drawHalloweenOffice(ctx: Ctx, ticks: number, calm: boolean) {
  drawCobweb(ctx, 0, 0, 58, 1);
  drawCobweb(ctx, 800, 0, 58, -1);

  // The garland sags between two pins either side of the window
  ctx.strokeStyle = "#78716c";
  ctx.lineWidth = 1;
  const garlands: Array<[number, number]> = [
    [150, 340],
    [466, 620],
  ];
  for (const [x0, x1] of garlands) {
    const sag = 16;
    ctx.beginPath();
    ctx.moveTo(x0, 10);
    ctx.quadraticCurveTo((x0 + x1) / 2, 10 + sag * 2, x1, 10);
    ctx.stroke();
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const x = x0 + (x1 - x0) * t;
      // A point on the quadratic sag at t
      const y = 10 + sag * 2 * 2 * t * (1 - t);
      drawBat(ctx, x, y + 6, 8);
    }
  }

  OFFICE_LANTERNS.forEach(([x, y, size], i) =>
    drawJackOLantern(ctx, x, y, size, lanternGlow(ticks, i * 1.7, calm))
  );
}

/**
 * The dog park's pumpkins, in the top corners either side of the throw
 * banner, where the guide tip along the bottom never covers them.
 */
const PARK_LANTERNS: ReadonlyArray<[number, number, number]> = [
  [38, 62, 26],
  [150, 56, 20],
  [652, 56, 20],
  [764, 64, 28],
];

/** Pumpkins in the dog park, drawn before the puddles and hurdles. */
export function drawHalloweenPark(ctx: Ctx, ticks: number, calm: boolean) {
  PARK_LANTERNS.forEach(([x, y, size], i) =>
    drawJackOLantern(ctx, x, y, size, lanternGlow(ticks, i * 2.1, calm))
  );
}

/** A kid in a bedsheet ghost costume, feet at (x, y). */
function drawGhostKid(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(ctx, 0, 0, 13, 3);
  ctx.fill();
  // The sheet: a dome on top, a wavy hem at the floor
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, -2);
  ctx.lineTo(-12, -26);
  ctx.quadraticCurveTo(-12, -44, 0, -44);
  ctx.quadraticCurveTo(12, -44, 12, -26);
  ctx.lineTo(12, -2);
  ctx.quadraticCurveTo(9, -6, 6, -2);
  ctx.quadraticCurveTo(3, -6, 0, -2);
  ctx.quadraticCurveTo(-3, -6, -6, -2);
  ctx.quadraticCurveTo(-9, -6, -12, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1c1917";
  ellipse(ctx, -4, -32, 2.2, 3);
  ctx.fill();
  ellipse(ctx, 4, -32, 2.2, 3);
  ctx.fill();
  ctx.restore();
}

/** A kid dressed as a witch, feet at (x, y). */
function drawWitchKid(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(ctx, 0, 0, 11, 3);
  ctx.fill();
  // Dress
  ctx.fillStyle = "#7e22ce";
  ctx.beginPath();
  ctx.moveTo(-10, -2);
  ctx.lineTo(-5, -24);
  ctx.lineTo(5, -24);
  ctx.lineTo(10, -2);
  ctx.closePath();
  ctx.fill();
  // Face
  ctx.fillStyle = "#fcd9b6";
  ellipse(ctx, 0, -29, 5.5, 5.5);
  ctx.fill();
  // Hat: a wide brim and a bent cone
  ctx.fillStyle = "#18181b";
  ellipse(ctx, 0, -33, 10, 2.4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -34);
  ctx.lineTo(6, -34);
  ctx.quadraticCurveTo(3, -44, 7, -50);
  ctx.quadraticCurveTo(-2, -44, -6, -34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Trick-or-treaters at the office's back door (#2740): a ghost and a
 * witch, with a jack-o'-lantern bucket held out between them. They bob on
 * their toes with the game's tick, and stand still under reduced motion.
 *
 * @param ctx - The office canvas.
 * @param doorX - The back door's left edge.
 * @param floorY - The floor line the kids stand on.
 * @param ticks - The game tick, for the bob.
 * @param calm - True under reduced motion.
 */
export function drawTrickOrTreaters(
  ctx: Ctx,
  doorX: number,
  floorY: number,
  ticks: number,
  calm: boolean
) {
  const bob = (seed: number) =>
    calm ? 0 : Math.abs(Math.sin(ticks * 0.12 + seed)) * -2;
  drawGhostKid(ctx, doorX + 22, floorY + bob(0));
  drawWitchKid(ctx, doorX + 62, floorY + bob(1.4));
  drawJackOLantern(
    ctx,
    doorX + 42,
    floorY - 4 + bob(0.7),
    14,
    lanternGlow(ticks, 5.3, calm)
  );
}
