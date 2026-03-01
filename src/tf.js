// Minimal TF tree utilities for browser.
// Uses latest transforms from /tf and /tf_static (no time interpolation).

export function makeTfStore() {
  // child -> { parent, t:{x,y,z}, q:{x,y,z,w} }
  const map = new Map();
  return {
    setTransform(child, parent, t, q) {
      map.set(child, { parent, t, q });
    },
    getTransform(child) {
      return map.get(child) || null;
    },
    has(child) {
      return map.has(child);
    },
    // Compute transform that maps a point in src frame into dst frame
    // Returns {t,q} meaning: p_dst = R(q) * p_src + t
    lookup(src, dst) {
      if (src === dst) return { t: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } };

      // Build chains to root: src -> ... -> root
      const srcChain = buildChain(map, src);
      const dstChain = buildChain(map, dst);

      // Find lowest common ancestor
      const srcSet = new Set(srcChain.map((n) => n.frame));
      const lca = dstChain.find((n) => srcSet.has(n.frame))?.frame;
      if (!lca) throw new Error(`No TF path between ${src} and ${dst}`);

      // Compose src->lca
      const T_src_lca = composeAlong(map, src, lca);

      // Compose dst->lca, then invert to get lca->dst
      const T_dst_lca = composeAlong(map, dst, lca);
      const T_lca_dst = invertTF(T_dst_lca);

      // src->dst = (lca->dst) ∘ (src->lca)
      return composeTF(T_lca_dst, T_src_lca);
    },
  };
}

function buildChain(map, start) {
  const chain = [];
  let cur = start;
  for (let i = 0; i < 200; i++) {
    chain.push({ frame: cur });
    const tr = map.get(cur);
    if (!tr) break;
    cur = tr.parent;
  }
  return chain;
}

// compose transforms along parent pointers: start -> ... -> end (where end is ancestor)
function composeAlong(map, start, end) {
  let cur = start;
  let T = { t: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } };

  for (let i = 0; i < 200; i++) {
    if (cur === end) return T;
    const tr = map.get(cur);
    if (!tr) throw new Error(`Missing TF for frame ${cur}`);
    // tr maps child(cur) -> parent(tr.parent)
    const step = { t: tr.t, q: tr.q };
    T = composeTF(step, T); // apply step after current
    cur = tr.parent;
  }
  throw new Error(`TF chain too long from ${start} to ${end}`);
}

// TF composition: A∘B meaning first B then A
// p' = R(qA)*(R(qB)*p + tB) + tA
export function composeTF(A, B) {
  const q = quatMul(A.q, B.q);
  const tRot = rotateVec(A.q, B.t);
  const t = { x: tRot.x + A.t.x, y: tRot.y + A.t.y, z: tRot.z + A.t.z };
  return { t, q };
}

export function invertTF(T) {
  const qInv = quatInv(T.q);
  const tInvRot = rotateVec(qInv, { x: -T.t.x, y: -T.t.y, z: -T.t.z });
  return { t: tInvRot, q: qInv };
}

export function transformPoint(T, p) {
  const r = rotateVec(T.q, p);
  return { x: r.x + T.t.x, y: r.y + T.t.y, z: r.z + T.t.z };
}

export function quatMul(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function quatInv(q) {
  // unit quats => inverse is conjugate
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function rotateVec(q, v) {
  // v' = q * (0,v) * q^-1
  const qv = { x: v.x, y: v.y, z: v.z, w: 0 };
  const qi = quatInv(q);
  const r = quatMul(quatMul(q, qv), qi);
  return { x: r.x, y: r.y, z: r.z };
}
