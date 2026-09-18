import * as THREE from 'three';

/**
 * Deletes the triangles whose centroids fall inside a world-space box, but
 * only those belonging to small disconnected pieces of an indexed mesh
 * ("islands", found by union-find over shared vertices).
 *
 * Built for one job: the car asset has raised lettering on the door sills
 * baked into the same mesh as the body shell, so it can't be hidden by
 * hiding a mesh the way the hub crest and license plates can. The letters
 * ride on small separate islands of triangles, so cutting just the triangles
 * inside a tight box around them takes the text off.
 *
 * The island-size limit is the safety rail: the big connected surfaces that
 * also pass through the box (the sill, the fender) are far larger than
 * \`maxIslandTriangles\` and are never touched.
 *
 * Returns how many triangles were removed.
 */
export function removeSmallIslandTrianglesInBox(
  mesh: THREE.Mesh,
  worldBox: THREE.Box3,
  maxIslandTriangles: number,
): number {
  const geometry = mesh.geometry;
  const index = geometry.index;
  if (!index) return 0;
  const position = geometry.attributes.position;
  const idx = index.array;
  const vertexCount = position.count;

  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (a: number) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const root = find(idx[t]);
    parent[find(idx[t + 1])] = root;
    parent[find(idx[t + 2])] = find(root);
  }

  const islandSize = new Map<number, number>();
  for (let t = 0; t < idx.length; t += 3) {
    const root = find(idx[t]);
    islandSize.set(root, (islandSize.get(root) ?? 0) + 1);
  }

  mesh.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const kept: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    centroid.set(0, 0, 0);
    for (let j = 0; j < 3; j++) centroid.add(v.fromBufferAttribute(position, idx[t + j]));
    centroid.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
    const doomed = worldBox.containsPoint(centroid) && (islandSize.get(find(idx[t])) ?? 0) <= maxIslandTriangles;
    if (!doomed) kept.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const removed = (idx.length - kept.length) / 3;
  if (removed > 0) geometry.setIndex(kept);
  return removed;
}
