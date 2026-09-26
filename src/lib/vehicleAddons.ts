import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

/**
 * The passenger-side front door's main outer skin — found once via
 * mesh-name search on the live scene (see reference-vehicle-asset-pipeline
 * memory for the technique) and hardcoded here, same style as
 * EMBOSSED_LETTERING_TARGETS in CarSceneCanvas.tsx. Stable across the
 * desktop and mobile-LOD glb: the mobile decimation pass only reduces
 * triangle counts on big/repetitive meshes (tire tread, grille frame, body
 * shell panels), it doesn't rename or move anything.
 */
const DECAL_TARGET_MESH_NAME = 'door_pside_f024';

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
  const door = scene.getObjectByName(DECAL_TARGET_MESH_NAME);
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
