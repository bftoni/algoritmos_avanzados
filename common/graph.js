const { segmentIntersectsPolygon } = require('./geometry');

class Graph {
  constructor(nodes, polygons, batteryCapacity = 100) {
    this.nodes = nodes; // array of {id, x, y, type?, is_charger?}
    this.polygons = polygons; // array of arrays of {x,y}
    this.batteryCapacity = batteryCapacity;
    this.edgeCache = new Map();
  }

  distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  weight(a, b) {
    const d = this.distance(a, b);
    const risk = 0.05 * d + 0.5; // simple deterministic risk proxy
    const battery = d; // assume 1 distance = 1 battery unit
    return { distance: d, risk, battery };
  }

  edgeFeasible(a, b) {
    const key = `${a.id}-${b.id}`;
    if (this.edgeCache.has(key)) return this.edgeCache.get(key);
    for (const poly of this.polygons) {
      if (segmentIntersectsPolygon(a, b, poly)) {
        this.edgeCache.set(key, false);
        return false;
      }
    }
    this.edgeCache.set(key, true);
    return true;
  }

  completeWeights() {
    const n = this.nodes.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(null));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const u = this.nodes[i];
        const v = this.nodes[j];
        const feasible = this.edgeFeasible(u, v);
        if (!feasible) continue;
        const w = this.weight(u, v);
        matrix[i][j] = w;
        matrix[j][i] = w;
      }
    }
    return matrix;
  }
}

function routeFeasible(path, graph) {
  let battery = graph.batteryCapacity;
  let recharges = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const u = graph.nodes[path[i]];
    const v = graph.nodes[path[i + 1]];
    if (!graph.edgeFeasible(u, v)) return { ok: false };
    const { battery: cost } = graph.weight(u, v);
    if (cost > graph.batteryCapacity + 1e-9) return { ok: false };
    if (battery < cost) {
      // need recharge at u
      if (!u.is_charger && u.type !== 'hub') return { ok: false };
      battery = graph.batteryCapacity;
      recharges += 1;
    }
    battery -= cost;
  }
  return { ok: true, recharges };
}

function evaluate(path, graph) {
  const weights = graph.completeWeights();
  let dist = 0;
  let risk = 0;
  let battery = graph.batteryCapacity;
  let recharges = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i];
    const v = path[i + 1];
    const w = weights[u][v];
    if (!w) return { ok: false };
    if (w.battery > graph.batteryCapacity + 1e-9) return { ok: false };
    if (battery < w.battery) {
      const node = graph.nodes[u];
      if (!node.is_charger && node.type !== 'hub') return { ok: false };
      battery = graph.batteryCapacity;
      recharges += 1;
    }
    battery -= w.battery;
    dist += w.distance;
    risk += w.risk;
  }
  return { ok: true, dist, risk, recharges };
}

function dominates(a, b) {
  const betterOrEqual = a.dist <= b.dist + 1e-9 && a.risk <= b.risk + 1e-9 && a.recharges <= b.recharges;
  const strictlyBetter = a.dist < b.dist - 1e-9 || a.risk < b.risk - 1e-9 || a.recharges < b.recharges;
  return betterOrEqual && strictlyBetter;
}

function paretoFront(solutions) {
  const front = [];
  for (const sol of solutions) {
    if (front.some((f) => dominates(f, sol))) continue;
    const filtered = front.filter((f) => !dominates(sol, f));
    filtered.push(sol);
    front.length = 0;
    front.push(...filtered);
  }
  return front;
}

module.exports = {
  Graph,
  routeFeasible,
  evaluate,
  dominates,
  paretoFront,
};
