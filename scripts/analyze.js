const fs = require('fs');
const path = require('path');

function loadResults(resultsDir) {
  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));
  const data = [];
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
    const match = file.match(/n(\d+)_(\w+)\.json/);
    if (match) {
      content.N = parseInt(match[1], 10);
      content.algoName = match[2];
      data.push(content);
    }
  }
  return data;
}

function computeHypervolume(frontier, refPoint) {
  // Simple 2D hypervolume (dist, risk); assume minimization, reference is worst
  if (frontier.length === 0) return 0;
  const sorted = frontier.slice().sort((a, b) => a.dist - b.dist);
  let hv = 0;
  for (let i = 0; i < sorted.length; i++) {
    const width = (i + 1 < sorted.length ? sorted[i + 1].dist : refPoint.dist) - sorted[i].dist;
    const height = refPoint.risk - sorted[i].risk;
    hv += width * height;
  }
  return hv;
}

function diversityMetric(frontier) {
  if (frontier.length < 2) return 0;
  let sumDist = 0;
  let count = 0;
  for (let i = 0; i < frontier.length; i++) {
    for (let j = i + 1; j < frontier.length; j++) {
      const dd = frontier[i].dist - frontier[j].dist;
      const dr = frontier[i].risk - frontier[j].risk;
      sumDist += Math.sqrt(dd * dd + dr * dr);
      count++;
    }
  }
  return count > 0 ? sumDist / count : 0;
}

function aggregateMetrics(results) {
  const byAlgo = {};
  for (const r of results) {
    const key = r.algoName;
    if (!byAlgo[key]) byAlgo[key] = [];
    byAlgo[key].push(r);
  }
  const metrics = [];
  for (const [algo, runs] of Object.entries(byAlgo)) {
    for (const run of runs) {
      const refPoint = { dist: 150, risk: 20 }; 
      const hv = computeHypervolume(run.frontier, refPoint);
      const div = diversityMetric(run.frontier);
      metrics.push({
        algo,
        N: run.N,
        time_avg_ms: run.time_avg_ms,
        hypervolume: hv,
        diversity: div,
        frontierSize: run.frontier.length,
      });
    }
  }
  return metrics;
}

function generatePlotData(metrics) {
  const timeVsN = {};
  const hvVsAlgo = {};
  const divVsAlgo = {};
  for (const m of metrics) {
    if (!timeVsN[m.algo]) timeVsN[m.algo] = [];
    timeVsN[m.algo].push({ N: m.N, time: m.time_avg_ms });
    if (!hvVsAlgo[m.algo]) hvVsAlgo[m.algo] = [];
    hvVsAlgo[m.algo].push({ N: m.N, hv: m.hypervolume });
    if (!divVsAlgo[m.algo]) divVsAlgo[m.algo] = [];
    divVsAlgo[m.algo].push({ N: m.N, div: m.diversity });
  }
  return { timeVsN, hvVsAlgo, divVsAlgo };
}

function generateSVGTimeVsN(data, outPath) {
  const algos = Object.keys(data);
  const colors = { exact_bb: '#1f77b4', geo_heuristic: '#ff7f0e', metaheuristic: '#2ca02c' };
  const width = 600;
  const height = 400;
  const margin = { top: 40, right: 150, bottom: 60, left: 80 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const allN = [10, 15, 20, 25];
  const maxTime = Math.max(...algos.flatMap((a) => data[a].map((d) => d.time)));
  const maxLog = Math.log10(maxTime + 1);

  const scaleX = (n) => margin.left + ((n - 10) / 15) * plotWidth;
  const scaleY = (t) => margin.top + plotHeight - (Math.log10(t + 1) / maxLog) * plotHeight;

  let lines = '';
  let legend = '';
  let offsetY = 20;
  for (const algo of algos) {
    const pts = data[algo].sort((a, b) => a.N - b.N);
    const pathData = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.N).toFixed(1)},${scaleY(p.time).toFixed(1)}`).join(' ');
    lines += `<path d="${pathData}" stroke="${colors[algo] || '#999'}" stroke-width="2" fill="none" />\n`;
    pts.forEach((p) => {
      lines += `<circle cx="${scaleX(p.N).toFixed(1)}" cy="${scaleY(p.time).toFixed(1)}" r="4" fill="${colors[algo] || '#999'}" />\n`;
    });
    legend += `<rect x="${width - margin.right + 10}" y="${margin.top + offsetY}" width="15" height="15" fill="${colors[algo] || '#999'}" />\n`;
    legend += `<text x="${width - margin.right + 30}" y="${margin.top + offsetY + 12}" font-size="12">${algo}</text>\n`;
    offsetY += 25;
  }

  const xAxis = allN.map((n) => `<text x="${scaleX(n)}" y="${height - margin.bottom + 20}" text-anchor="middle" font-size="12">${n}</text>`).join('\n');
  const yTicks = [1, 10, 100, 1000, 10000].filter((t) => t <= maxTime);
  const yAxis = yTicks.map((t) => `<text x="${margin.left - 10}" y="${scaleY(t)}" text-anchor="end" font-size="12">${t}</text>`).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#fff">
  <text x="${width / 2}" y="20" text-anchor="middle" font-size="16" font-weight="bold">Tiempo promedio vs N (log scale)</text>
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="14">N (nodos)</text>
  <text x="15" y="${height / 2}" text-anchor="middle" font-size="14" transform="rotate(-90 15 ${height / 2})">Tiempo (ms, log)</text>
  ${lines}
  ${xAxis}
  ${yAxis}
  ${legend}
</svg>`;
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`Generado: ${outPath}`);
}

function generateSVGHypervolume(data, outPath) {
  const algos = Object.keys(data);
  const colors = { exact_bb: '#1f77b4', geo_heuristic: '#ff7f0e', metaheuristic: '#2ca02c' };
  const width = 600;
  const height = 400;
  const margin = { top: 40, right: 150, bottom: 60, left: 80 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const allN = [10, 15, 20, 25];
  const maxHV = Math.max(...algos.flatMap((a) => data[a].map((d) => d.hv)));

  const scaleX = (n) => margin.left + ((n - 10) / 15) * plotWidth;
  const scaleY = (hv) => margin.top + plotHeight - (hv / (maxHV + 1)) * plotHeight;

  let bars = '';
  const barWidth = plotWidth / (allN.length * algos.length + allN.length);
  let idx = 0;
  for (const n of allN) {
    for (const algo of algos) {
      const pt = data[algo].find((d) => d.N === n);
      const hv = pt ? pt.hv : 0;
      const x = scaleX(n) + idx * barWidth - (algos.length * barWidth) / 2;
      const y = scaleY(hv);
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth - 2}" height="${(plotHeight - (y - margin.top)).toFixed(1)}" fill="${colors[algo] || '#999'}" />\n`;
      idx++;
    }
    idx = 0;
  }

  const xAxis = allN.map((n) => `<text x="${scaleX(n)}" y="${height - margin.bottom + 20}" text-anchor="middle" font-size="12">${n}</text>`).join('\n');
  let legend = '';
  let offsetY = 20;
  for (const algo of algos) {
    legend += `<rect x="${width - margin.right + 10}" y="${margin.top + offsetY}" width="15" height="15" fill="${colors[algo] || '#999'}" />\n`;
    legend += `<text x="${width - margin.right + 30}" y="${margin.top + offsetY + 12}" font-size="12">${algo}</text>\n`;
    offsetY += 25;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#fff">
  <text x="${width / 2}" y="20" text-anchor="middle" font-size="16" font-weight="bold">Hipervolumen por algoritmo y N</text>
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="14">N (nodos)</text>
  <text x="15" y="${height / 2}" text-anchor="middle" font-size="14" transform="rotate(-90 15 ${height / 2})">Hipervolumen</text>
  ${bars}
  ${xAxis}
  ${legend}
</svg>`;
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`Generado: ${outPath}`);
}

function generateSVGDiversity(data, outPath) {
  const algos = Object.keys(data);
  const colors = { exact_bb: '#1f77b4', geo_heuristic: '#ff7f0e', metaheuristic: '#2ca02c' };
  const width = 600;
  const height = 400;
  const margin = { top: 40, right: 150, bottom: 60, left: 80 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const allN = [10, 15, 20, 25];
  const maxDiv = Math.max(...algos.flatMap((a) => data[a].map((d) => d.div)), 1);

  const scaleX = (n) => margin.left + ((n - 10) / 15) * plotWidth;
  const scaleY = (div) => margin.top + plotHeight - (div / maxDiv) * plotHeight;

  let lines = '';
  let legend = '';
  let offsetY = 20;
  for (const algo of algos) {
    const pts = data[algo].sort((a, b) => a.N - b.N);
    const pathData = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.N).toFixed(1)},${scaleY(p.div).toFixed(1)}`).join(' ');
    lines += `<path d="${pathData}" stroke="${colors[algo] || '#999'}" stroke-width="2" fill="none" />\n`;
    pts.forEach((p) => {
      lines += `<circle cx="${scaleX(p.N).toFixed(1)}" cy="${scaleY(p.div).toFixed(1)}" r="4" fill="${colors[algo] || '#999'}" />\n`;
    });
    legend += `<rect x="${width - margin.right + 10}" y="${margin.top + offsetY}" width="15" height="15" fill="${colors[algo] || '#999'}" />\n`;
    legend += `<text x="${width - margin.right + 30}" y="${margin.top + offsetY + 12}" font-size="12">${algo}</text>\n`;
    offsetY += 25;
  }

  const xAxis = allN.map((n) => `<text x="${scaleX(n)}" y="${height - margin.bottom + 20}" text-anchor="middle" font-size="12">${n}</text>`).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#fff">
  <text x="${width / 2}" y="20" text-anchor="middle" font-size="16" font-weight="bold">Diversidad de frontera vs N</text>
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="14">N (nodos)</text>
  <text x="15" y="${height / 2}" text-anchor="middle" font-size="14" transform="rotate(-90 15 ${height / 2})">Diversidad (dist. media)</text>
  ${lines}
  ${xAxis}
  ${legend}
</svg>`;
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`Generado: ${outPath}`);
}

function main() {
  const resultsDir = path.join(__dirname, '..', 'data', 'results');
  const results = loadResults(resultsDir);
  const metrics = aggregateMetrics(results);
  const plotData = generatePlotData(metrics);

  const figDir = path.join(__dirname, '..', 'report', 'figs');
  if (!fs.existsSync(figDir)) fs.mkdirSync(figDir, { recursive: true });

  generateSVGTimeVsN(plotData.timeVsN, path.join(figDir, 'time_vs_n.svg'));
  generateSVGHypervolume(plotData.hvVsAlgo, path.join(figDir, 'hypervolume.svg'));
  generateSVGDiversity(plotData.divVsAlgo, path.join(figDir, 'diversity.svg'));

  console.log('\nMétricas agregadas guardadas en report/figs/');
  console.log(JSON.stringify(metrics, null, 2));
}

main();
