// Grid Engine — 16-bit SNES Tile Map for Cammelot
// Manages the 2D world grid, pathfinding, and congestion visualization

import { SIMULATION_CONFIG } from "../../config/simulation.js";

// Tile types for the Cammelot map
export const TILE_TYPES = {
  EMPTY:       0x00,
  GRASS:       0x01,
  PATH:        0x02,
  ROAD:        0x03,
  WATER:       0x04,
  TREE:        0x05,
  HOUSE:       0x10,
  GP_PRACTICE: 0x20,
  HOSPITAL:    0x30,
  PHARMACY:    0x40,
  NURSING_HOME:0x50,
  TOWN_HALL:   0x60,
  PARK:        0x70,
  CHURCH:      0x80,
};

// SNES color palette (saturated 16-bit style)
export const PALETTE = {
  grass:       "#3B8C2A",
  grassAlt:    "#4DA63A",
  path:        "#D4A564",
  road:        "#7C7C7C",
  water:       "#2878B8",
  roof:        "#C83030",
  wall:        "#F0E0C0",
  hospital:    "#F8F8F8",
  hospitalRed: "#E83030",
  gpGreen:     "#30A830",
  pharmacy:    "#3070C0",
  tree:        "#1E6B18",
  treeDark:    "#145210",
  shadow:      "#282828",
  uiBg:        "#1C1C3C",
  uiBorder:    "#A0A0D0",
  hpGreen:     "#30E830",
  hpYellow:    "#E8E830",
  hpRed:       "#E83030",
  ghostGrey:   "#808080",
  ghostWhite:  "#C0C0C0",
  speechBubble:"#F8F8E8",
  speechBorder:"#383838",
};

/**
 * 2D Tile Map — the world of Cammelot
 */
export class TileMap {
  constructor(width, height) {
    this.width = width || SIMULATION_CONFIG.grid.width;
    this.height = height || SIMULATION_CONFIG.grid.height;
    this.tileSize = SIMULATION_CONFIG.grid.tileSize;
    this.tiles = new Uint8Array(this.width * this.height);
    this.metadata = new Map(); // tile index → metadata

    // Entity positions
    this.entities = new Map(); // entityId → { x, y, type, spriteState }
    this.congestionZones = new Map(); // buildingId → queue count
  }

  // --- Map Building ---

  setTile(x, y, type) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.tiles[y * this.width + x] = type;
    }
  }

  getTile(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.tiles[y * this.width + x];
    }
    return TILE_TYPES.EMPTY;
  }

  setTileMetadata(x, y, data) {
    this.metadata.set(y * this.width + x, data);
  }

  getTileMetadata(x, y) {
    return this.metadata.get(y * this.width + x) || null;
  }

  /** Fill a rectangular region with a tile type */
  fillRect(x, y, w, h, type) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setTile(x + dx, y + dy, type);
      }
    }
  }

  // --- Entity Management ---

  placeEntity(id, x, y, type, spriteState = "healthy") {
    this.entities.set(id, { x, y, type, spriteState });
  }

  moveEntity(id, newX, newY) {
    const entity = this.entities.get(id);
    if (entity) {
      entity.x = newX;
      entity.y = newY;
    }
  }

  updateEntitySprite(id, spriteState) {
    const entity = this.entities.get(id);
    if (entity) {
      entity.spriteState = spriteState;
    }
  }

  removeEntity(id) {
    this.entities.delete(id);
  }

  getEntitiesAt(x, y) {
    return [...this.entities.entries()]
      .filter(([, e]) => e.x === x && e.y === y)
      .map(([id, e]) => ({ id, ...e }));
  }

  // --- Congestion Visualization ---

  updateCongestion(buildingId, queueSize) {
    this.congestionZones.set(buildingId, queueSize);
  }

  getCongestionLevel(buildingId) {
    const size = this.congestionZones.get(buildingId) || 0;
    if (size === 0) return "empty";
    if (size <= 5) return "low";
    if (size <= 15) return "medium";
    if (size <= 30) return "high";
    return "critical";
  }

  // --- Pathfinding (A* simplified) ---

  findPath(startX, startY, endX, endY) {
    const key = (x, y) => `${x},${y}`;
    const walkable = (x, y) => {
      const tile = this.getTile(x, y);
      return (
        tile === TILE_TYPES.GRASS ||
        tile === TILE_TYPES.PATH ||
        tile === TILE_TYPES.ROAD ||
        tile === TILE_TYPES.PARK
      );
    };

    const open = [{ x: startX, y: startY, g: 0, h: 0, parent: null }];
    const closed = new Set();

    const heuristic = (x, y) =>
      Math.abs(x - endX) + Math.abs(y - endY);

    while (open.length > 0) {
      open.sort((a, b) => a.g + a.h - (b.g + b.h));
      const current = open.shift();

      if (current.x === endX && current.y === endY) {
        // Reconstruct path
        const path = [];
        let node = current;
        while (node) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }

      closed.add(key(current.x, current.y));

      // Neighbors (4-directional)
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (closed.has(key(nx, ny)) || !walkable(nx, ny)) continue;

        const g = current.g + 1;
        const existing = open.find((n) => n.x === nx && n.y === ny);
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.parent = current;
          }
        } else {
          open.push({ x: nx, y: ny, g, h: heuristic(nx, ny), parent: current });
        }
      }

      // Safety: limit search space
      if (closed.size > 2000) return null;
    }

    return null; // no path found
  }

  // --- Serialization for rendering ---

  toRenderData() {
    return {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      tiles: Array.from(this.tiles),
      entities: Object.fromEntries(this.entities),
      congestion: Object.fromEntries(this.congestionZones),
    };
  }
}

/**
 * Build the default Cammelot town map
 */
export function buildCammelotMap() {
  const map = new TileMap();

  // Fill base with grass
  map.fillRect(0, 0, map.width, map.height, TILE_TYPES.GRASS);

  // Main roads
  map.fillRect(0, 23, map.width, 2, TILE_TYPES.ROAD);  // Horizontal main road
  map.fillRect(31, 0, 2, map.height, TILE_TYPES.ROAD);  // Vertical main road

  // Paths connecting buildings
  map.fillRect(10, 18, 1, 5, TILE_TYPES.PATH);
  map.fillRect(22, 30, 1, 5, TILE_TYPES.PATH);
  map.fillRect(34, 14, 1, 9, TILE_TYPES.PATH);
  map.fillRect(48, 10, 1, 13, TILE_TYPES.PATH);

  // River
  map.fillRect(0, 40, map.width, 3, TILE_TYPES.WATER);

  // GP Practices (3)
  map.fillRect(10, 18, 4, 4, TILE_TYPES.GP_PRACTICE);
  map.setTileMetadata(10, 18, { id: "gp-de-jong", name: "GP De Jong", type: "gp_practice" });

  map.fillRect(22, 30, 4, 4, TILE_TYPES.GP_PRACTICE);
  map.setTileMetadata(22, 30, { id: "gp-bakker", name: "GP Bakker", type: "gp_practice" });

  map.fillRect(34, 16, 4, 4, TILE_TYPES.GP_PRACTICE);
  map.setTileMetadata(34, 16, { id: "gp-visser", name: "GP Visser", type: "gp_practice" });

  // Hospital (larger building)
  map.fillRect(46, 8, 10, 8, TILE_TYPES.HOSPITAL);
  map.setTileMetadata(46, 8, { id: "hospital-cammelot", name: "Cammelot Hospital", type: "hospital" });

  // Pharmacies
  map.fillRect(16, 22, 3, 3, TILE_TYPES.PHARMACY);
  map.fillRect(40, 22, 3, 3, TILE_TYPES.PHARMACY);

  // Nursing Home
  map.fillRect(8, 32, 6, 5, TILE_TYPES.NURSING_HOME);
  map.setTileMetadata(8, 32, { id: "nursing-cammelot", name: "Huize Cammelot", type: "nursing_home" });

  // Town Hall
  map.fillRect(28, 10, 6, 5, TILE_TYPES.TOWN_HALL);

  // Park
  map.fillRect(18, 6, 8, 6, TILE_TYPES.PARK);

  // Trees (scattered)
  const treePositions = [
    [2, 2], [4, 5], [7, 3], [15, 4], [38, 4], [42, 6],
    [5, 28], [14, 36], [30, 38], [45, 36], [55, 30],
    [60, 10], [58, 20], [3, 44], [20, 44], [40, 44],
  ];
  for (const [tx, ty] of treePositions) {
    map.setTile(tx, ty, TILE_TYPES.TREE);
  }

  // Houses (residential areas)
  const housePositions = [
    [4, 12], [6, 12], [8, 12], [4, 15], [6, 15],
    [38, 28], [40, 28], [42, 28], [38, 32], [40, 32],
    [14, 28], [16, 28], [50, 28], [52, 28], [54, 28],
    [20, 36], [22, 36], [24, 36], [26, 36],
  ];
  for (const [hx, hy] of housePositions) {
    map.fillRect(hx, hy, 2, 2, TILE_TYPES.HOUSE);
  }

  return map;
}

export default { TileMap, buildCammelotMap, TILE_TYPES, PALETTE };
