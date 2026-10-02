// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  WELCH_TRAILS,
  WELCH_LIFTS,
  WELCH_POIS,
  RESPONSIBILITY_CODE,
  SUMMIT_ELEVATION_FT,
  BASE_ELEVATION_FT,
  VERTICAL_DROP_FT,
  catmullRomToPath,
  calculateElevationAt,
  calculateAverageGrade,
  interpolateSkierPosition,
  getWelchTrailById,
  getWelchLiftById,
  getWelchPoiById,
} from "@/lib/patrol";

describe("Welch Village Geospatial Terrain Engine & Mountain Dataset (Issue #835)", () => {
  describe("1. Topographic Calibration & Invariants", () => {
    it("exports authentic Welch Village elevation constants", () => {
      expect(SUMMIT_ELEVATION_FT).toBe(1060);
      expect(BASE_ELEVATION_FT).toBe(700);
      expect(VERTICAL_DROP_FT).toBe(360);
      expect(SUMMIT_ELEVATION_FT - BASE_ELEVATION_FT).toBe(VERTICAL_DROP_FT);
    });

    it("contains all 10 NSAA Responsibility Code rules in sequential order", () => {
      expect(RESPONSIBILITY_CODE).toHaveLength(10);
      RESPONSIBILITY_CODE.forEach((rule, idx) => {
        expect(rule.number).toBe(idx + 1);
        expect(rule.id).toBe(`rule-${idx + 1}`);
        expect(rule.title).toBeTruthy();
        expect(rule.rule.length).toBeGreaterThan(15);
      });
    });
  });

  describe("2. Comprehensive Trail Dataset (49+ Authentic Trails)", () => {
    it("contains at least 49 authentic Welch Village trails", () => {
      expect(WELCH_TRAILS.length).toBeGreaterThanOrEqual(49);
    });

    it("validates trail data structures and elevation bounds across all sectors", () => {
      const validSectors = new Set([
        "East Slopes",
        "West Slopes",
        "The Back Bowl",
      ]);
      const validZones = new Set(["main", "back-bowl"]);
      const validDifficulties = new Set([
        "green",
        "blue",
        "black",
        "double-black",
        "terrain-park",
      ]);

      for (const trail of WELCH_TRAILS) {
        expect(trail.id).toBeTruthy();
        expect(trail.name).toBeTruthy();
        expect(validSectors.has(trail.sector)).toBe(true);
        expect(validZones.has(trail.zone)).toBe(true);
        expect(validDifficulties.has(trail.difficulty)).toBe(true);

        // Elevation bounds
        expect(trail.summitElevationFt).toBeGreaterThanOrEqual(
          BASE_ELEVATION_FT
        );
        expect(trail.summitElevationFt).toBeLessThanOrEqual(
          SUMMIT_ELEVATION_FT
        );
        expect(trail.baseElevationFt).toBeGreaterThanOrEqual(BASE_ELEVATION_FT);
        expect(trail.baseElevationFt).toBeLessThanOrEqual(
          trail.summitElevationFt
        );

        // Vertical drop & length
        expect(trail.verticalDropFt).toBeGreaterThan(0);
        expect(trail.verticalDropFt).toBeLessThanOrEqual(VERTICAL_DROP_FT);
        expect(trail.lengthFt).toBeGreaterThanOrEqual(trail.verticalDropFt);

        // Points geometry
        expect(trail.points.length).toBeGreaterThanOrEqual(3);
        for (const pt of trail.points) {
          expect(typeof pt.x).toBe("number");
          expect(typeof pt.y).toBe("number");
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
        }

        // Description
        expect(trail.description.length).toBeGreaterThan(10);
      }
    });

    it("contains signature trails across East Slopes, West Slopes, and The Back Bowl", () => {
      const trailNames = new Set(WELCH_TRAILS.map((t) => t.name));

      // East Slopes
      expect(trailNames.has("Harley's Hollow")).toBe(true);
      expect(trailNames.has("Dream Catcher")).toBe(true);
      expect(trailNames.has("Cannon Ball")).toBe(true);
      expect(trailNames.has("Dan's Dive")).toBe(true);

      // West Slopes
      expect(trailNames.has("Long Way Home")).toBe(true);
      expect(trailNames.has("Cedar Fork")).toBe(true);
      expect(trailNames.has("Twister")).toBe(true);
      expect(trailNames.has("Lift Face")).toBe(true);

      // The Back Bowl
      expect(trailNames.has("The Great Gorge")).toBe(true);
      expect(trailNames.has("Black Forest")).toBe(true);
      expect(trailNames.has("Adam's Abyss")).toBe(true);
      expect(trailNames.has("Great Scott")).toBe(true);
    });

    it("allows trail lookup by ID via getWelchTrailById", () => {
      const trail = getWelchTrailById("long-way-home");
      expect(trail).toBeDefined();
      expect(trail?.name).toBe("Long Way Home");
      expect(trail?.sector).toBe("West Slopes");
      expect(trail?.difficulty).toBe("green");

      expect(getWelchTrailById("non-existent-trail")).toBeUndefined();
    });
  });

  describe("3. Mechanical Chairlifts Dataset (All 10 Lifts)", () => {
    it("contains all 10 Welch Village chairlifts and surface tows", () => {
      expect(WELCH_LIFTS).toHaveLength(10);
    });

    it("validates mechanical parameters for each lift", () => {
      const validTypes = new Set(["quad", "triple", "double", "carpet", "tow"]);
      const validStatuses = new Set(["open", "closed", "on-hold"]);

      for (const lift of WELCH_LIFTS) {
        expect(lift.id).toBeTruthy();
        expect(lift.name).toBeTruthy();
        expect(validTypes.has(lift.type)).toBe(true);
        expect(validStatuses.has(lift.status)).toBe(true);
        expect(lift.capacity).toBeGreaterThan(0);
        expect(lift.lengthFt).toBeGreaterThan(0);
        expect(lift.verticalRiseFt).toBeGreaterThan(0);
        expect(lift.verticalRiseFt).toBeLessThanOrEqual(VERTICAL_DROP_FT);
        expect(lift.towerCount).toBeGreaterThanOrEqual(0);
        expect(lift.speedMph).toBeGreaterThan(0);

        expect(typeof lift.topTerminal.x).toBe("number");
        expect(typeof lift.topTerminal.y).toBe("number");
        expect(typeof lift.bottomTerminal.x).toBe("number");
        expect(typeof lift.bottomTerminal.y).toBe("number");
      }
    });

    it("contains Belle Creek Quad, Face Lift 2000, Cannon Valley Quad, and SkiLink Double", () => {
      const liftIds = new Set(WELCH_LIFTS.map((l) => l.id));
      expect(liftIds.has("belle-creek-quad")).toBe(true);
      expect(liftIds.has("cannon-valley-quad")).toBe(true);
      expect(liftIds.has("east-quad")).toBe(true);
      expect(liftIds.has("face-lift-2000")).toBe(true);
      expect(liftIds.has("skilink-double")).toBe(true);
      expect(liftIds.has("west-quad")).toBe(true);
      expect(liftIds.has("lookout-quad")).toBe(true);
      expect(liftIds.has("sunrise-triple")).toBe(true);
      expect(liftIds.has("magic-carpet")).toBe(true);
      expect(liftIds.has("tow-rope")).toBe(true);
    });

    it("allows lift lookup by ID via getWelchLiftById", () => {
      const lift = getWelchLiftById("belle-creek-quad");
      expect(lift).toBeDefined();
      expect(lift?.name).toBe("Belle Creek Quad");
      expect(lift?.zone).toBe("back-bowl");
      expect(lift?.type).toBe("quad");

      expect(getWelchLiftById("non-existent-lift")).toBeUndefined();
    });
  });

  describe("4. Points of Interest Dataset (All 9 POIs)", () => {
    it("contains all 9 authentic Welch Village POIs", () => {
      expect(WELCH_POIS).toHaveLength(9);
    });

    it("validates POI coordinates, category, and elevations", () => {
      const validCategories = new Set([
        "medical",
        "chalet",
        "dining",
        "service",
        "parking",
        "trailhead",
      ]);

      for (const poi of WELCH_POIS) {
        expect(poi.id).toBeTruthy();
        expect(poi.name).toBeTruthy();
        expect(validCategories.has(poi.category)).toBe(true);
        expect(typeof poi.coordinates.x).toBe("number");
        expect(typeof poi.coordinates.y).toBe("number");
        expect(poi.elevationFt).toBeGreaterThanOrEqual(BASE_ELEVATION_FT - 10);
        expect(poi.elevationFt).toBeLessThanOrEqual(SUMMIT_ELEVATION_FT);
        expect(poi.description.length).toBeGreaterThan(10);
      }
    });

    it("includes Patrol Clinic, Chalets, MADD JAXX, and Cannon Valley Trail corridor", () => {
      const poiIds = new Set(WELCH_POIS.map((p) => p.id));
      expect(poiIds.has("patrol-clinic")).toBe(true);
      expect(poiIds.has("main-chalet")).toBe(true);
      expect(poiIds.has("east-chalet")).toBe(true);
      expect(poiIds.has("madd-jaxx")).toBe(true);
      expect(poiIds.has("rental-center")).toBe(true);
      expect(poiIds.has("skilink-center")).toBe(true);
      expect(poiIds.has("parking-corridor")).toBe(true);
      expect(poiIds.has("cannon-valley-trail")).toBe(true);
      expect(poiIds.has("summit-shack")).toBe(true);
    });

    it("allows POI lookup by ID via getWelchPoiById", () => {
      const clinic = getWelchPoiById("patrol-clinic");
      expect(clinic).toBeDefined();
      expect(clinic?.name).toContain("Patrol Clinic");
      expect(clinic?.category).toBe("medical");

      expect(getWelchPoiById("non-existent-poi")).toBeUndefined();
    });
  });

  describe("5. Catmull-Rom to Cubic Bézier Spline Pipeline", () => {
    it("returns empty string for empty points array", () => {
      expect(catmullRomToPath([])).toBe("");
    });

    it("returns Move-to for single point", () => {
      expect(catmullRomToPath([{ x: 10, y: 20 }])).toBe("M 10 20");
    });

    it("returns Line-to for two points", () => {
      expect(
        catmullRomToPath([
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ])
      ).toBe("M 10 20 L 30 40");
    });

    it("generates smooth cubic Bézier curve commands for 3+ points", () => {
      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 150 },
        { x: 300, y: 120 },
        { x: 400, y: 250 },
      ];

      const path = catmullRomToPath(points);
      expect(path.startsWith("M 100 100")).toBe(true);
      expect(path).toContain("C");

      // Verify command count: 3 segments = 3 C commands
      const cCommands = path.split("C").length - 1;
      expect(cCommands).toBe(3);
    });

    it("supports closed paths with trailing Z command", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const closedPath = catmullRomToPath(points, true);
      expect(closedPath.endsWith("Z")).toBe(true);
      const cCommands = closedPath.split("C").length - 1;
      expect(cCommands).toBe(4);
    });
  });

  describe("6. Elevation & Gradient Mathematics", () => {
    it("interpolates elevation correctly in main zone", () => {
      // Near summit (y <= 180) -> 1060 ft
      expect(calculateElevationAt(1000, 100, "main")).toBe(1060);
      expect(calculateElevationAt(1000, 180, "main")).toBe(1060);

      // Near base (y >= 1160) -> 700 ft
      expect(calculateElevationAt(1000, 1160, "main")).toBe(700);
      expect(calculateElevationAt(1000, 1250, "main")).toBe(700);

      // Mid-mountain (~670) -> ~880 ft
      const midElev = calculateElevationAt(1000, 670, "main");
      expect(midElev).toBeGreaterThan(800);
      expect(midElev).toBeLessThan(950);
    });

    it("interpolates elevation correctly in back-bowl zone", () => {
      // Summit rim (y <= 140) -> 1060 ft
      expect(calculateElevationAt(600, 100, "back-bowl")).toBe(1060);
      expect(calculateElevationAt(600, 140, "back-bowl")).toBe(1060);

      // Base basin (y >= 780) -> 700 ft
      expect(calculateElevationAt(600, 780, "back-bowl")).toBe(700);
      expect(calculateElevationAt(600, 850, "back-bowl")).toBe(700);

      // Mid-bowl (460) -> 880 ft
      const midElev = calculateElevationAt(600, 460, "back-bowl");
      expect(midElev).toBe(880);
    });

    it("calculates average grade percentages correctly", () => {
      // 360 ft drop over 1800 ft length = 20%
      expect(calculateAverageGrade(360, 1800)).toBe(20);

      // 340 ft drop over 1700 ft length = 20%
      expect(calculateAverageGrade(340, 1700)).toBe(20);

      // 360 ft drop over 3100 ft length = 12%
      expect(calculateAverageGrade(360, 3100)).toBe(12);

      // Boundary: 0 or negative length returns 0
      expect(calculateAverageGrade(100, 0)).toBe(0);
      expect(calculateAverageGrade(100, -50)).toBe(0);
      expect(calculateAverageGrade(NaN, 1000)).toBe(0);
      expect(calculateAverageGrade(100, NaN)).toBe(0);
      expect(calculateAverageGrade(Infinity, 1000)).toBe(0);
    });

    it("handles non-finite values defensively in calculateElevationAt", () => {
      expect(calculateElevationAt(100, NaN, "main")).toBe(BASE_ELEVATION_FT);
      expect(calculateElevationAt(100, Infinity, "back-bowl")).toBe(
        BASE_ELEVATION_FT
      );
    });

    it("returns undefined for invalid or empty lookup IDs across all entity types", () => {
      expect(getWelchTrailById("")).toBeUndefined();
      expect(getWelchTrailById(null as unknown as string)).toBeUndefined();
      expect(getWelchLiftById("")).toBeUndefined();
      expect(getWelchLiftById(undefined as unknown as string)).toBeUndefined();
      expect(getWelchPoiById("")).toBeUndefined();
      expect(getWelchPoiById(123 as unknown as string)).toBeUndefined();
    });
  });

  describe("7. Skier Polyline Position & Tangent Interpolation", () => {
    it("handles boundary inputs for skier interpolation", () => {
      expect(interpolateSkierPosition([], 0.5)).toEqual({
        x: 0,
        y: 0,
        angleRad: 0,
      });
      expect(interpolateSkierPosition([{ x: 50, y: 60 }], 0.5)).toEqual({
        x: 50,
        y: 60,
        angleRad: 0,
      });
    });

    it("interpolates position and angle at start, midpoint, and end", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ];

      // At start (progress = 0)
      const start = interpolateSkierPosition(points, 0);
      expect(start.x).toBe(0);
      expect(start.y).toBe(0);
      expect(start.angleRad).toBeCloseTo(0);

      // At midpoint (progress = 0.5): distance is 100 out of 200, exactly at corner (100, 0)
      const mid = interpolateSkierPosition(points, 0.5);
      expect(mid.x).toBeCloseTo(100);
      expect(mid.y).toBeCloseTo(0);

      // In second segment (progress = 0.75): (100, 50) heading down (+pi/2)
      const q3 = interpolateSkierPosition(points, 0.75);
      expect(q3.x).toBeCloseTo(100);
      expect(q3.y).toBeCloseTo(50);
      expect(q3.angleRad).toBeCloseTo(Math.PI / 2);

      // At finish (progress = 1.0)
      const end = interpolateSkierPosition(points, 1.0);
      expect(end.x).toBe(100);
      expect(end.y).toBe(100);
    });

    it("clamps out-of-bounds progress values gracefully", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const under = interpolateSkierPosition(points, -0.5);
      expect(under.x).toBe(0);
      expect(under.y).toBe(0);

      const over = interpolateSkierPosition(points, 1.5);
      expect(over.x).toBe(100);
      expect(over.y).toBe(100);

      // Non-finite progress values fallback safely to start
      const nanProg = interpolateSkierPosition(points, NaN);
      expect(nanProg.x).toBe(0);
      expect(nanProg.y).toBe(0);

      const infProg = interpolateSkierPosition(points, Infinity);
      expect(infProg.x).toBe(0);
      expect(infProg.y).toBe(0);
    });
  });
});
