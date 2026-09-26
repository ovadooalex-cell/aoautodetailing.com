import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

/**
 * The two front doors' main outer skin — found once via mesh-name search on
 * the live scene (see reference-vehicle-asset-pipeline memory for the
 * technique) and hardcoded here, same style as EMBOSSED_LETTERING_TARGETS in
 * CarSceneCanvas.tsx. Stable across the desktop and mobile-LOD glb: the mobile
 * decimation pass only reduces triangle counts on big/repetitive meshes
 * (tire tread, grille frame, body shell panels), it doesn't rename or move
 * anything.
 */
const DOOR_MESH_NAMES = { positiveX: 'door_pside_f024', negativeX: 'door_pside_f001' } as const;

/**
 * The source asset has no side mirrors at all — confirmed by searching all
 * ~210 mesh names in the live scene, nothing matches. Approximated here with
 * plain primitives (arm + housing + glass) rather than left off outright: a
 * mirror is one of the first things a real photo of this truck would show,
 * and there's no 3D-modeling tool on this machine to sculpt real mirror
 * geometry into the source asset itself. Positioned off the front-top corner
 * of each front door — the beltline/A-pillar junction, real mirrors' actual
 * mounting spot — computed from that door's own live bounding box so it
 * tracks whichever glb (desktop or mobile LOD) is loaded rather than a
 * hardcoded world position.
 */
export function addSideMirrors(scene: THREE.Object3D): void {
  const armMat = new THREE.MeshStandardMaterial({ color: '#f6f5f0', metalness: 0.4, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#dfe3e6', metalness: 1, roughness: 0.15 });

  (['positiveX', 'negativeX'] as const).forEach((side) => {
    const door = scene.getObjectByName(DOOR_MESH_NAMES[side]);
    if (!door) return;
    const box = new THREE.Box3().setFromObject(door);
    const doorHeight = box.max.y - box.min.y;
    const outward = side === 'positiveX' ? 1 : -1;
    const baseX = outward > 0 ? box.max.x : box.min.x;
    const y = box.min.y + doorHeight * 0.72;
    const z = box.max.z - 0.1;

    const group = new THREE.Group();
    group.name = `sideMirror_${side}`;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.03), armMat);
    arm.position.set(baseX + outward * 0.05, y, z);
    group.add(arm);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.17), armMat);
    housing.position.set(baseX + outward * 0.13, y - 0.015, z);
    group.add(housing);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.13), glassMat);
    glass.position.set(baseX + outward * 0.158, y - 0.015, z);
    group.add(glass);
    scene.add(group);
  });
}

/**
 * Stamps the AO Auto Detailing logo onto the passenger-side front door as a
 * projected decal (three's DecalGeometry), not baked into the camo texture —
 * keeps the camo pattern independent of branding placement, and a decal
 * projects cleanly onto a curved body panel regardless of that panel's own
 * UV layout (unlike painting it into camoTexture.ts, which would need the
 * logo pre-warped to match each panel's individual unwrap). Only the
 * passenger side gets one: every camera stage's azimuth sits on that side of
 * the truck (see the azimuth notes in carConfig.ts), so a second decal on the
 * far side would never be seen — not worth the extra draw call.
 */
export function addLogoDecal(scene: THREE.Object3D, texture: THREE.Texture, gl: THREE.WebGLRenderer): void {
  const door = scene.getObjectByName(DOOR_MESH_NAMES.positiveX);
  if (!door) return;
  const box = new THREE.Box3().setFromObject(door);
  const center = box.getCenter(new THREE.Vector3());
  const position = new THREE.Vector3(box.max.x, box.min.y + (box.max.y - box.min.y) * 0.28, center.z);

  const projector = new THREE.Object3D();
  projector.position.set(position.x + 0.15, position.y, position.z);
  projector.lookAt(position.x - 0.15, position.y, position.z);

  // The projection comes out mirrored (DecalGeometry projects along the
  // surface normal, which flips U for a panel facing +X) — corrected by
  // flipping the texture's own U rather than fighting the projector's
  // rotation (rotating the projector only changes WHICH edge reads
  // upside-down, it can't undo a mirror — confirmed by testing both).
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  texture.offset.x = 1;
  // Both missing before, and both made the logo read soft/washed-out:
  // colorSpace defaults to no color-space conversion, which is wrong for a
  // regular color image (same fix already applied to every other diffuse
  // texture in vehicleMaterial.ts); anisotropy defaults to 1, which blurs
  // heavily at the oblique angle every camera stage actually views this
  // door from (anisotropic filtering is specifically what sharpens texture
  // sampling at a shallow viewing angle — a flat "sharper" filter alone
  // doesn't fix that).
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;

  const size = new THREE.Vector3(0.4, 0.4, 0.3);
  const geometry = new DecalGeometry(door as THREE.Mesh, position, projector.rotation, size);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    // Standard decal setup: without this the decal's coplanar triangles
    // z-fight with the door panel underneath them (flickering stripes).
    polygonOffset: true,
    polygonOffsetFactor: -4,
    depthTest: true,
  });
  const decal = new THREE.Mesh(geometry, material);
  decal.name = 'brandLogoDecal';
  scene.add(decal);
}
