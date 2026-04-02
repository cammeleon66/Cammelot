// Galahad QA — Tile Map & Pathfinding Tests
// Regression check: tile-map-pathfinding

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { TileMap, TILE_TYPES, buildCammelotMap, PALETTE } from "../src/grid_engine/tile_map.js";

describe("TileMap", () => {
  let map;

  beforeEach(() => {
    // Small test map (16x12) to keep pathfinding fast
    map = new TileMap(16, 12);
  });

  // --- Tile Operations ---

  describe("tile operations", () => {
    it("should initialize all tiles to EMPTY (0)", () => {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          assert.strictEqual(map.getTile(x, y), TILE_TYPES.EMPTY);
        }
      }
    });

    it("should set and get tiles correctly", () => {
      map.setTile(5, 3, TILE_TYPES.GRASS);
      assert.strictEqual(map.getTile(5, 3), TILE_TYPES.GRASS);
    });

    it("should return EMPTY for out-of-bounds coordinates", () => {
      assert.strictEqual(map.getTile(-1, 0), TILE_TYPES.EMPTY);
      assert.strictEqual(map.getTile(100, 100), TILE_TYPES.EMPTY);
    });

    it("should ignore setTile for out-of-bounds coordinates", () => {
      map.setTile(-1, -1, TILE_TYPES.WATER);
      // Should not throw, just no-op
      assert.strictEqual(map.getTile(-1, -1), TILE_TYPES.EMPTY);
    });

    it("should fill a rectangular region", () => {
      map.fillRect(2, 2, 4, 3, TILE_TYPES.ROAD);
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          assert.strictEqual(map.getTile(2 + dx, 2 + dy), TILE_TYPES.ROAD);
        }
      }
    });
  });

  // --- Tile Metadata ---

  describe("tile metadata", () => {
    it("should set and get metadata for a tile", () => {
      map.setTileMetadata(3, 4, { id: "gp-test", name: "Test GP" });
      const meta = map.getTileMetadata(3, 4);
      assert.deepStrictEqual(meta, { id: "gp-test", name: "Test GP" });
    });

    it("should return null for tiles without metadata", () => {
      assert.strictEqual(map.getTileMetadata(0, 0), null);
    });
  });

  // --- Entity Management ---

  describe("entity management", () => {
    it("should place and retrieve entities", () => {
      map.placeEntity("patient-1", 5, 3, "patient", "healthy");
      const entities = map.getEntitiesAt(5, 3);
      assert.strictEqual(entities.length, 1);
      assert.strictEqual(entities[0].id, "patient-1");
      assert.strictEqual(entities[0].spriteState, "healthy");
    });

    it("should move entities to new positions", () => {
      map.placeEntity("patient-2", 0, 0, "patient");
      map.moveEntity("patient-2", 10, 5);
      const atOld = map.getEntitiesAt(0, 0);
      const atNew = map.getEntitiesAt(10, 5);
      assert.strictEqual(atOld.length, 0);
      assert.strictEqual(atNew.length, 1);
    });

    it("should update entity sprite state", () => {
      map.placeEntity("patient-3", 1, 1, "patient", "healthy");
      map.updateEntitySprite("patient-3", "ghost");
      const entities = map.getEntitiesAt(1, 1);
      assert.strictEqual(entities[0].spriteState, "ghost");
    });

    it("should remove entities", () => {
      map.placeEntity("temp", 2, 2, "patient");
      map.removeEntity("temp");
      const entities = map.getEntitiesAt(2, 2);
      assert.strictEqual(entities.length, 0);
    });
  });

  // --- Congestion ---

  describe("congestion", () => {
    it("should track congestion levels by building id", () => {
      map.updateCongestion("hospital-1", 0);
      assert.strictEqual(map.getCongestionLevel("hospital-1"), "empty");

      map.updateCongestion("hospital-1", 3);
      assert.strictEqual(map.getCongestionLevel("hospital-1"), "low");

      map.updateCongestion("hospital-1", 10);
      assert.strictEqual(map.getCongestionLevel("hospital-1"), "medium");

      map.updateCongestion("hospital-1", 20);
      assert.strictEqual(map.getCongestionLevel("hospital-1"), "high");

      map.updateCongestion("hospital-1", 40);
      assert.strictEqual(map.getCongestionLevel("hospital-1"), "critical");
    });

    it("should return 'empty' for unknown buildings", () => {
      assert.strictEqual(map.getCongestionLevel("nonexistent"), "empty");
    });
  });

  // --- A* Pathfinding ---

  describe("findPath() — A* pathfinding", () => {
    beforeEach(() => {
      // Fill entire map with grass (walkable)
      map.fillRect(0, 0, map.width, map.height, TILE_TYPES.GRASS);
    });

    it("should find a direct path on walkable tiles", () => {
      const path = map.findPath(0, 0, 5, 0);
      assert.ok(path, "Path must be found");
      assert.ok(path.length > 0, "Path must not be empty");
      // Start and end should match
      assert.deepStrictEqual(path[0], { x: 0, y: 0 });
      assert.deepStrictEqual(path[path.length - 1], { x: 5, y: 0 });
    });

    it("should return path of length 1 when start equals end", () => {
      const path = map.findPath(3, 3, 3, 3);
      assert.ok(path);
      assert.strictEqual(path.length, 1);
      assert.deepStrictEqual(path[0], { x: 3, y: 3 });
    });

    it("should find shortest path (Manhattan distance for open grid)", () => {
      const path = map.findPath(0, 0, 4, 3);
      assert.ok(path);
      // Manhattan distance = 4 + 3 = 7 steps, path length = 8 (includes start)
      assert.strictEqual(path.length, 8);
    });

    it("should navigate around obstacles", () => {
      // Place a wall of water blocking direct path
      map.fillRect(3, 0, 1, 4, TILE_TYPES.WATER); // vertical wall at x=3
      const path = map.findPath(0, 0, 5, 0);
      assert.ok(path, "Must find path around obstacle");
      // Path should go around the wall
      const crossesWall = path.some((p) => p.x === 3 && p.y < 4);
      assert.strictEqual(crossesWall, false, "Path must not cross water tiles");
    });

    it("should return null when no path exists", () => {
      // Surround destination with water
      map.fillRect(4, 0, 3, 3, TILE_TYPES.WATER);
      map.setTile(5, 1, TILE_TYPES.GRASS); // island at (5,1)
      const path = map.findPath(0, 0, 5, 1);
      assert.strictEqual(path, null, "No path should exist to isolated island");
    });

    it("should treat ROAD tiles as walkable", () => {
      map.fillRect(0, 0, map.width, map.height, TILE_TYPES.WATER); // all water
      map.fillRect(0, 0, 8, 1, TILE_TYPES.ROAD); // road strip
      const path = map.findPath(0, 0, 7, 0);
      assert.ok(path, "Road tiles should be walkable");
      assert.strictEqual(path.length, 8);
    });

    it("should treat PATH tiles as walkable", () => {
      map.fillRect(0, 0, map.width, map.height, TILE_TYPES.WATER);
      map.fillRect(0, 0, 1, 5, TILE_TYPES.PATH);
      const path = map.findPath(0, 0, 0, 4);
      assert.ok(path, "Path tiles should be walkable");
    });

    it("should treat PARK tiles as walkable", () => {
      map.fillRect(0, 0, map.width, map.height, TILE_TYPES.WATER);
      map.fillRect(0, 0, 4, 4, TILE_TYPES.PARK);
      const path = map.findPath(0, 0, 3, 3);
      assert.ok(path, "Park tiles should be walkable");
    });

    it("should return only walkable coordinates in the path", () => {
      const path = map.findPath(0, 0, 10, 8);
      assert.ok(path);
      for (const point of path) {
        const tile = map.getTile(point.x, point.y);
        const walkable = [TILE_TYPES.GRASS, TILE_TYPES.PATH, TILE_TYPES.ROAD, TILE_TYPES.PARK];
        assert.ok(walkable.includes(tile), `Tile at (${point.x},${point.y}) = ${tile} is not walkable`);
      }
    });

    it("should produce contiguous steps (each step differs by 1 in x or y)", () => {
      const path = map.findPath(1, 1, 10, 8);
      assert.ok(path);
      for (let i = 1; i < path.length; i++) {
        const dx = Math.abs(path[i].x - path[i - 1].x);
        const dy = Math.abs(path[i].y - path[i - 1].y);
        assert.strictEqual(dx + dy, 1, `Step ${i} must be exactly 1 tile from previous`);
      }
    });
  });

  // --- Serialization ---

  describe("toRenderData()", () => {
    it("should serialize map for rendering", () => {
      map.placeEntity("e1", 3, 3, "patient");
      const data = map.toRenderData();
      assert.strictEqual(data.width, 16);
      assert.strictEqual(data.height, 12);
      assert.ok(Array.isArray(data.tiles));
      assert.strictEqual(data.tiles.length, 16 * 12);
    });
  });
});

// --- TILE_TYPES Constants ---

describe("TILE_TYPES", () => {
  it("should define expected tile type constants", () => {
    assert.strictEqual(typeof TILE_TYPES.EMPTY, "number");
    assert.strictEqual(typeof TILE_TYPES.GRASS, "number");
    assert.strictEqual(typeof TILE_TYPES.HOSPITAL, "number");
    assert.strictEqual(typeof TILE_TYPES.GP_PRACTICE, "number");
  });
});

// --- PALETTE ---

describe("PALETTE", () => {
  it("should define SNES color palette values", () => {
    assert.ok(PALETTE.grass, "grass color must exist");
    assert.ok(PALETTE.ghostGrey, "ghostGrey color must exist");
    assert.ok(PALETTE.hpRed, "hpRed color must exist");
    assert.ok(PALETTE.speechBubble, "speechBubble color must exist");
  });
});

// --- buildCammelotMap ---

describe("buildCammelotMap()", () => {
  it("should build a 64x48 map with buildings placed", () => {
    const cammelot = buildCammelotMap();
    assert.strictEqual(cammelot.width, 64);
    assert.strictEqual(cammelot.height, 48);
    // Verify hospital is placed
    assert.strictEqual(cammelot.getTile(46, 8), TILE_TYPES.HOSPITAL);
    // Verify GP practice is placed
    assert.strictEqual(cammelot.getTile(10, 18), TILE_TYPES.GP_PRACTICE);
  });
});
