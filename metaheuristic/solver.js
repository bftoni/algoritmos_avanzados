const { evaluate, paretoFront, dominates } = require('../common/graph');

function greedyFeasible(graph, start) {
  const n = graph.nodes.length;
  const visited = Array(n).fill(false);
  const route = [start];
  visited[start] = true;
  while (route.length < n) {
    const u = route[route.length - 1];
    let bestV = null;
    let bestScore = Infinity;
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      if (!graph.edgeFeasible(graph.nodes[u], graph.nodes[v])) continue;
      const w = graph.weight(graph.nodes[u], graph.nodes[v]);
      const score = w.distance + w.risk;
      if (score < bestScore) {
        bestScore = score;
        bestV = v;
      }
    }
    if (bestV === null) return null;
    route.push(bestV);
    visited[bestV] = true;
  }
  route.push(start);
  return route;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function orderCrossover(p1, p2) {
  const n = p1.length;
  const a = Math.floor(Math.random() * n);
  const b = Math.floor(Math.random() * n);
  const l = Math.min(a, b);
  const r = Math.max(a, b);
  const child = Array(n).fill(null);
  for (let i = l; i <= r; i++) child[i] = p1[i];
  let idx = (r + 1) % n;
  for (let i = 0; i < n; i++) {
    const gene = p2[(r + 1 + i) % n];
    if (!child.includes(gene)) {
      child[idx] = gene;
      idx = (idx + 1) % n;
    }
  }
  return child;
}

function swapMutation(p) {
  const n = p.length;
  const i = Math.floor(Math.random() * n);
  const j = Math.floor(Math.random() * n);
  [p[i], p[j]] = [p[j], p[i]];
  return p;
}

function makeRoute(perm, start) {
  return [start, ...perm.filter((v) => v !== start), start];
}

function tournament(pop) {
  if (pop.length === 0) return null;
  const a = pop[Math.floor(Math.random() * pop.length)];
  const b = pop[Math.floor(Math.random() * pop.length)];
  if (dominates(a, b)) return a;
  if (dominates(b, a)) return b;
  return Math.random() < 0.5 ? a : b;
}

function solve(graph, opts = {}) {
  const start = opts.start || 0;
  const popSize = opts.popSize || 30;
  const gens = opts.generations || 120;
  const mutationRate = opts.mutationRate || 0.2;
  const nodes = graph.nodes.map((n) => n.id);
  const innerNodes = nodes.filter((v) => v !== start);

  let population = [];
  const greedySeed = greedyFeasible(graph, start);
  if (greedySeed) {
    const evalRes = evaluate(greedySeed, graph);
    if (evalRes.ok) population.push({ path: greedySeed, ...evalRes });
  }


  // ajustamos el numero de intentos para encontrar soluciones factibles
  const maxTries = popSize * Math.max(100, graph.nodes.length * 50);
  let tries = 0;
  while (population.length < popSize && tries < maxTries) {
    tries += 1;
    const perm = shuffle([...innerNodes]);
    const route = makeRoute(perm, start);
    const evalRes = evaluate(route, graph);
    if (evalRes.ok) population.push({ path: route, ...evalRes });
  }


  // si no se encontraron individuos factibles, salimos antes
  if (population.length === 0) return { front: [], timeMs: null };

  for (let g = 0; g < gens; g++) {
    const offspring = [];
    while (offspring.length < popSize) {
      const p1 = tournament(population);
      const p2 = tournament(population);
      if (!p1 || !p2) break;
      const perm1 = p1.path.slice(1, -1);
      const perm2 = p2.path.slice(1, -1);
      let childPerm = orderCrossover(perm1, perm2);
      if (Math.random() < mutationRate) childPerm = swapMutation(childPerm);
      const childRoute = makeRoute(childPerm, start);
      const evalRes = evaluate(childRoute, graph);
      if (evalRes.ok) offspring.push({ path: childRoute, ...evalRes });
    }
    if (offspring.length === 0) break;
    const merged = paretoFront(population.concat(offspring));
    // rellenamos si la frontera es menor que el tamaño de la población añadiendo los mejores 
    population = merged;
    while (population.length < popSize && offspring.length > 0) {
      population.push(offspring.pop());
    }
  }
  return { front: paretoFront(population), timeMs: null };
}

module.exports = { run: solve };
