#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { program } = require('commander');
const { Graph, paretoFront } = require('./common/graph');
const exactBB = require('./exact_bb/solver');
const geoHeuristic = require('./geo_heuristic/solver');
const metaHeuristic = require('./metaheuristic/solver');

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
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const nodes = data.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    type: n.type || 'delivery',
    is_charger: Boolean(n.is_charger),
  }));
  const polygons = (data.no_fly || []).map((p) =>
    p.vertices.map((v) => ({ x: v[0], y: v[1] }))
  );
  const batteryCapacity = data.battery_capacity || 100;
  const { nodes: normNodes, polygons: normPolys } = normalizeOrigin(nodes, polygons);
  return { nodes: normNodes, polygons: normPolys, batteryCapacity };
}

function selectSolver(name) {
  if (name === 'exact_bb') return exactBB.run;
  if (name === 'geo_heuristic') return geoHeuristic.run;
  if (name === 'metaheuristic') return metaHeuristic.run;
  throw new Error(`Unknown algo ${name}`);
}

function runOnce(graph, algo, opts) {
  const t0 = performance.now();
  const res = algo(graph, opts) || {};
  const timeMs = res.timeMs != null ? res.timeMs : performance.now() - t0;
  return { front: res.front || [], timeMs };
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

program
  .requiredOption('-i, --inst <path>', 'instance .json')
  .option('-a, --algo <name>', 'algorithm (exact_bb|geo_heuristic|metaheuristic)', 'geo_heuristic')
  .option('-r, --reps <n>', 'replicas', '1')
  .option('--start <id>', 'hub id (node index)', '0')
  .option('--time-limit <ms>', 'time limit for exact_bb (ms)', '10000')
  .option('--generations <n>', 'generations (metaheuristic)', '60')
  .option('--out <path>', 'output results file (json)');

program.parse();
const opts = program.opts();

(function main() {
  const { nodes, polygons, batteryCapacity } = loadInstance(path.resolve(opts.inst));
  const graph = new Graph(nodes, polygons, batteryCapacity);
  const solver = selectSolver(opts.algo);
  const reps = parseInt(opts.reps, 10) || 1;
  const fronts = [];
  const times = [];
  let peakMem = 0;

  for (let i = 0; i < reps; i++) {
    const { front, timeMs } = runOnce(graph, solver, {
      start: parseInt(opts.start, 10),
      timeLimitMs: parseInt(opts.timeLimit, 10),
      generations: parseInt(opts.generations, 10),
    });
    fronts.push(...front);
    times.push(timeMs);
    peakMem = Math.max(peakMem, process.memoryUsage().rss);
  }

  const merged = dedupFront(paretoFront(fronts));
  const summary = {
    algo: opts.algo,
    instance: opts.inst,
    reps,
    time_avg_ms: times.reduce((a, b) => a + b, 0) / (times.length || 1),
    time_all_ms: times,
    peak_mem_mb: peakMem / (1024 * 1024),
    frontier: merged.map((s) => ({
      dist: s.dist,
      risk: s.risk,
      recharges: s.recharges,
      path: s.path,
    })),
  };

  if (opts.out) {
    fs.writeFileSync(opts.out, JSON.stringify(summary, null, 2));
    console.log(`Saved results to ${opts.out}`);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
})();
