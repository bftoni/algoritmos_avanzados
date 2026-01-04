const { evaluate, paretoFront } = require('../common/graph');

function nearestFeasibleRoute(graph, start = 0, randomize = false) {
  const n = graph.nodes.length;
  const visited = Array(n).fill(false);
  const route = [start];
  visited[start] = true;

  while (route.length < n) {
    const u = route[route.length - 1];
    const candidates = [];
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      if (!graph.edgeFeasible(graph.nodes[u], graph.nodes[v])) continue;
      const w = graph.weight(graph.nodes[u], graph.nodes[v]);
      const score = w.distance + w.risk;
      candidates.push({ v, score });
    }
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => a.score - b.score);
    let bestV;
    if (randomize && candidates.length > 1) {
      const topK = Math.min(3, candidates.length);
      bestV = candidates[Math.floor(Math.random() * topK)].v;
    } else {
      bestV = candidates[0].v;
    }
    
    route.push(bestV);
    visited[bestV] = true;
  }
  route.push(start);
  return route;
}

function twoOpt(route, graph, maxIter = 50) {
  let improved = true;
  let iter = 0;
  while (improved && iter < maxIter) {
    improved = false;
    iter += 1;
    for (let i = 1; i < route.length - 2; i++) {
      for (let k = i + 1; k < route.length - 1; k++) {
        const a = graph.nodes[route[i - 1]];
        const b = graph.nodes[route[i]];
        const c = graph.nodes[route[k]];
        const d = graph.nodes[route[k + 1]];
        if (!graph.edgeFeasible(a, c) || !graph.edgeFeasible(b, d)) continue;
        const w1 = graph.weight(a, b).distance + graph.weight(c, d).distance;
        const w2 = graph.weight(a, c).distance + graph.weight(b, d).distance;
        if (w2 + 1e-9 < w1) {
          const newRoute = route.slice(0, i).concat(route.slice(i, k + 1).reverse(), route.slice(k + 1));
          route = newRoute;
          improved = true;
        }
      }
    }
  }
  return route;
}

function solve(graph, opts = {}) {
  const start = opts.start || 0;
  const seeds = opts.seeds || 5;
  const sols = [];

  const base = nearestFeasibleRoute(graph, start, false);
  if (base) {
    const route = twoOpt(base, graph, 30);
    const evalRes = evaluate(route, graph);
    if (evalRes.ok) sols.push({ path: route, ...evalRes });
  }
  

  
  for (let s = 1; s < seeds; s++) {
    const randRoute = nearestFeasibleRoute(graph, start, true);
    if (!randRoute) continue;
    const route = twoOpt(randRoute, graph, 30);
    const evalRes = evaluate(route, graph);
    if (evalRes.ok) sols.push({ path: route, ...evalRes });
  }
  
  return { front: paretoFront(sols), timeMs: null };
}

module.exports = { run: solve };
