/**
 * Duck's canonical look (#1707), shared by the office, the dog park and
 * the bathtub so he never changes breed between scenes. Duck is an English
 * Cream golden retriever: an ivory coat with cool cream shadows, ears only
 * a shade warmer than his body, dark eyes and a black nose. The real
 * photos in `public/images/duck/` and `public/images/bio/` are the
 * reference; this module only holds colours and small drawing primitives.
 *
 * Mud is never a coat colour. It is painted as patches on top of the cream
 * fur, inside a clip of the part it sits on, so a muddy Duck is still
 * visibly the same white dog.
 */

type Ctx = CanvasRenderingContext2D;

/** Coat colours for a clean Duck. None of them may read as gold or tan. */
export const DUCK_COAT = {
  base: "#f5efe3",
  light: "#fffcf5",
  shade: "#ddd1bf",
  ear: "#ecdcc4",
  outline: "#85786a",
};

/** The same coat soaked through: a little greyer, a little darker. */
export const DUCK_WET_COAT = {
  base: "#ece6db",
  light: "#f9f6ef",
  shade: "#cfc5b5",
  ear: "#e0d2bd",
  outline: "#73695c",
};

export type DuckCoat = typeof DUCK_COAT;

/** Mud tones, layered over the coat. */
export const DUCK_MUD = {
  dark: "#5c3f24",
  mid: "#7a5531",
  splash: "#93693f",
};

const DUCK_EYE = "#22160f";
const DUCK_NOSE = "#151210";

/** An ellipse blob: centre x, centre y, radius x, radius y. */
export type MudBlob = readonly [number, number, number, number];

/**
 * Paints mud blobs at `amount` (0 to 1) opacity inside the current path.
 * The caller builds the path of the body part first. Test canvases
 * without `clip` still get the blobs, unclipped.
 */
export function paintMudInPath(
  ctx: Ctx,
  blobs: readonly MudBlob[],
  amount: number
) {
  if (amount <= 0 || blobs.length === 0) return;
  ctx.save();
  if (typeof ctx.clip === "function") ctx.clip();
  ctx.globalAlpha = Math.min(1, amount) * 0.85;
  blobs.forEach(([x, y, rx, ry], i) => {
    ctx.fillStyle = i % 3 === 0 ? DUCK_MUD.dark : DUCK_MUD.mid;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (i * 0.7) % Math.PI, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/** A dark eye with a darker rim and a catchlight. */
export function drawDuckEye(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = "#3a2a20";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.25, r * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = DUCK_EYE;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.38, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The black button nose with a soft highlight. */
export function drawDuckNose(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation = 0
) {
  ctx.fillStyle = DUCK_NOSE;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.ellipse(
    x - rx * 0.25,
    y - ry * 0.4,
    rx * 0.32,
    ry * 0.25,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}
