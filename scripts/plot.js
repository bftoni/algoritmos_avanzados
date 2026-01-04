#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { program } = require('commander');

program
  .requiredOption('-i, --inst <path>', 'instance .json')
  .option('-o, --out <path>', 'output svg path', 'plot.svg')
  .option('--size <n>', 'canvas size (px)', '800');

program.parse();
const opts = program.opts();

function loadInstance(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const nodes = data.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, type: n.type || 'delivery', is_charger: !!n.is_charger }));
  const polys = (data.no_fly || []).map((p) => p.vertices.map((v) => ({ x: v[0], y: v[1] })));
  return { nodes, polys };
}

function bbox(nodes, polys) {
  let xs = nodes.map((n) => n.x);
  let ys = nodes.map((n) => n.y);
  polys.forEach((poly) => {
    poly.forEach((p) => {
      xs.push(p.x);
      ys.push(p.y);
    });
  });
  const minX = Math.min(...xs) - 1;
  const maxX = Math.max(...xs) + 1;
  const minY = Math.min(...ys) - 1;
  const maxY = Math.max(...ys) + 1;
  return { minX, maxX, minY, maxY };
}

function toSvgCoords(x, y, box, size) {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const scale = size / Math.max(width, height);
  const sx = (x - box.minX) * scale;
  const sy = size - (y - box.minY) * scale; // invert y for svg
  return { sx, sy, scale };
}

function colorFor(node) {
  if (node.type === 'hub') return '#1f77b4';
  if (node.is_charger) return '#2ca02c';
  return '#ff7f0e';
}

function main() {
  const size = parseInt(opts.size, 10);
  const instPath = path.resolve(opts.inst);
  const { nodes, polys } = loadInstance(instPath);
  const box = bbox(nodes, polys);

  const polySvg = polys
    .map((poly, idx) => {
      const pts = poly
        .map((p) => {
          const { sx, sy } = toSvgCoords(p.x, p.y, box, size);
          return `${sx.toFixed(1)},${sy.toFixed(1)}`;
        })
        .join(' ');
      return `<polygon points="${pts}" fill="rgba(255,0,0,0.15)" stroke="red" stroke-width="1" id="nf-${idx}" />`;
    })
    .join('\n');

  const nodeSvg = nodes
    .map((n) => {
      const { sx, sy } = toSvgCoords(n.x, n.y, box, size);
      return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="${colorFor(n)}" stroke="#111" stroke-width="1" />` +
        `<text x="${(sx + 7).toFixed(1)}" y="${(sy - 7).toFixed(1)}" font-size="12" fill="#111">${n.id}</text>`;
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background:#fafafa">
  <g id="polygons">${polySvg}</g>
  <g id="nodes">${nodeSvg}</g>
  <g id="legend" transform="translate(20,20)">
    <rect x="0" y="0" width="140" height="70" fill="white" stroke="#ccc" />
    <circle cx="10" cy="15" r="5" fill="#1f77b4" stroke="#111" stroke-width="1" />
    <text x="22" y="19" font-size="12">Hub</text>
    <circle cx="10" cy="35" r="5" fill="#2ca02c" stroke="#111" stroke-width="1" />
    <text x="22" y="39" font-size="12">Cargador</text>
    <circle cx="10" cy="55" r="5" fill="#ff7f0e" stroke="#111" stroke-width="1" />
    <text x="22" y="59" font-size="12">Entrega</text>
  </g>
</svg>`;

  const outPath = path.resolve(opts.out);
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`SVG guardado en ${outPath}`);
}

main();
