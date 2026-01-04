// Utilidades geométricas básicas del tema 7 

function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 2 : 1; // 2: antihorario, 1: horario
}

function onSegment(p, q, r) {
  return (
    Math.min(p.x, r.x) - 1e-9 <= q.x &&
    q.x <= Math.max(p.x, r.x) + 1e-9 &&
    Math.min(p.y, r.y) - 1e-9 <= q.y &&
    q.y <= Math.max(p.y, r.y) + 1e-9
  );
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function pointInPolygon(pt, polygon) {
  let cnt = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const condY = (a.y > pt.y) !== (b.y > pt.y);
    if (!condY) continue;
    const xInt = ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + 1e-12) + a.x;
    if (pt.x < xInt) cnt++;
  }
  return cnt % 2 === 1;
}

function segmentIntersectsPolygon(p, q, polygon) {
  if (pointInPolygon(p, polygon) || pointInPolygon(q, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (segmentsIntersect(p, q, a, b)) return true;
  }
  return false;
}

module.exports = {
  orientation,
  onSegment,
  segmentsIntersect,
  pointInPolygon,
  segmentIntersectsPolygon,
};
