const fs = require('fs');
const path = require('path');
const { Graph, paretoFront } = require('../common/graph');
const exactBB = require('../exact_bb/solver');
const geoHeuristic = require('../geo_heuristic/solver');
const metaHeuristic = require('../metaheuristic/solver');

function normalizeOrigin(nodes, polygons) {
  let minX = Infinity;
  let minY = Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  });
  polygons.forEach((poly) => {
    poly.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    });
  });
  if (minX >= 0 && minY >= 0) return { nodes, polygons, shift: { dx: 0, dy: 0 } };
  const dx = minX < 0 ? -minX : 0;
  const dy = minY < 0 ? -minY : 0;
  const shiftedNodes = nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  const shiftedPolygons = polygons.map((poly) => poly.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  return { nodes: shiftedNodes, polygons: shiftedPolygons, shift: { dx, dy } };
}

function loadInstance(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const nodes = data.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    type: n.type || 'delivery',
    is_charger: Boolean(n.is_charger),
  }));
  const polygons = (data.no_fly || []).map((p) => p.vertices.map((v) => ({ x: v[0], y: v[1] })));
  const { nodes: normNodes, polygons: normPolys } = normalizeOrigin(nodes, polygons);
  return { nodes: normNodes, polygons: normPolys, batteryCapacity: data.battery_capacity || 100 };
}

function dedupFront(solutions) {
  const seen = new Set();
  const out = [];
  for (const s of solutions) {
    const key = `${s.path.join('-')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function selectSolver(name) {
  if (name === 'exact_bb') return exactBB.run;
  if (name === 'geo_heuristic') return geoHeuristic.run;
  if (name === 'metaheuristic') return metaHeuristic.run;
  throw new Error(`Unknown algo ${name}`);
}

function main() {
  const instDir = path.join(__dirname, '..', 'data', 'instances');
  const instances = fs.readdirSync(instDir).filter((f) => f.endsWith('.json'));
  const algos = ['exact_bb', 'geo_heuristic', 'metaheuristic'];
  const outDir = path.join(__dirname, '..', 'data', 'results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const instFile of instances) {
    const instPath = path.join(instDir, instFile);
    const { nodes, polygons, batteryCapacity } = loadInstance(instPath);
    const graph = new Graph(nodes, polygons, batteryCapacity);
    for (const algoName of algos) {
      const solver = selectSolver(algoName);
      const fronts = [];
      const times = [];
      const reps = algoName === 'exact_bb' ? 1 : 5;
      for (let r = 0; r < reps; r++) {
        const t0 = Date.now();
        const res = solver(graph, { start: 0, timeLimitMs: 30000 });
        const timeMs = res.timeMs != null ? res.timeMs : Date.now() - t0;
        times.push(timeMs);
        fronts.push(...(res.front || []));
      }
      const merged = dedupFront(paretoFront(fronts));
      const summary = {
        algo: algoName,
        instance: instFile,
        reps,
        time_avg_ms: times.reduce((a, b) => a + b, 0) / times.length,
        time_all_ms: times,
        frontier: merged.map((s) => ({ dist: s.dist, risk: s.risk, recharges: s.recharges })),
      };
      const outFile = path.join(outDir, `${path.parse(instFile).name}_${algoName}.json`);
      fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
      console.log(`Saved ${outFile}`);
    }
  }
}

main();
