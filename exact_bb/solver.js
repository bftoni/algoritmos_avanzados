const { performance } = require('perf_hooks');
const { evaluate, paretoFront } = require('../common/graph');

function solve(graph, opts = {}) {
  const start = opts.start || 0; // hub 
  const n = graph.nodes.length;
  const timeLimitMs = opts.timeLimitMs || 30000;
  const t0 = performance.now();

  const visited = Array(n).fill(false);
  visited[start] = true;
  const path = [start];
  let best = [];

  function dfs() {
    if (performance.now() - t0 > timeLimitMs) return;
    if (path.length === n) {
      path.push(start);
      const evalRes = evaluate(path, graph);
      path.pop();
      if (evalRes.ok) {
        best.push({ path: [...path, start], ...evalRes });
        best = paretoFront(best);
      }
      return;
    }
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      const u = path[path.length - 1];
      if (!graph.edgeFeasible(graph.nodes[u], graph.nodes[v])) continue;
      path.push(v);
      visited[v] = true;
      dfs();
      visited[v] = false;
      path.pop();
    }
  }

  dfs();
  return { front: paretoFront(best), timeMs: performance.now() - t0 };
}

module.exports = { run: solve };
