import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// FXAA finds edges by brightness contrast. This canvas is transparent over
// the CSS studio backdrop, so an uncovered pixel reads as black — which
// would hide the silhouette of anything dark (tires, fender flares, the
// black roof) against what is really a light backdrop, leaving exactly
// those edges jagged. Judging brightness as if each pixel were composited
// over the backdrop's color fixes that.
//
// The other three swaps tune FXAA away from texture detail: by default it
// also smooths fine high-frequency texture ("subpixel blending"), which
// visibly blurred the lettering in the AO logo on the door. The truck's
// silhouette and panel edges are high-contrast, so they're still caught by
// the (unchanged) edge pass.
const SHADER_PATCHES: [from: string, to: string][] = [
  [
    'return dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) );',
    'vec4 c = Sample( tex2D, uv ); return dot( c.rgb + ( 1.0 - c.a ) * backdrop, vec3( 0.3, 0.59, 0.11 ) );',
  ],
  ['float _ContrastThreshold = 0.0312;', 'float _ContrastThreshold = 0.0625;'],
  ['float _RelativeThreshold = 0.063;', 'float _RelativeThreshold = 0.125;'],
  ['float _SubpixelBlending = 1.0;', 'float _SubpixelBlending = 0.5;'],
];

function patchedFragmentShader(): string {
  let src = FXAAShader.fragmentShader;
  for (const [from, to] of SHADER_PATCHES) {
    // Pinned to three's own shader source — if an upgrade rewrites it, say
    // so loudly rather than silently shipping untuned (still working) FXAA.
    if (!src.includes(from)) console.warn(`[FxaaOutput] FXAA shader changed upstream; patch not applied: ${from}`);
    src = src.replace(from, to);
  }
  return 'uniform vec3 backdrop;\n' + src;
}

/** CSS hex → raw 0..1 components, deliberately NOT converted to linear: the
 * canvas pixels FXAA compares against are already display-encoded. */
function hexToVec3(hex: string): THREE.Vector3 {
  const n = parseInt(hex.trim().replace('#', ''), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Takes over the canvas's final output on weak GPUs (see IS_WEAK_DEVICE):
 * renders the scene normally — the canvas is created without hardware MSAA
 * there — then copies the finished frame and redraws it through one FXAA
 * pass. Measured on an integrated GPU at 1366x768, 4x MSAA was about half of
 * the entire frame's GPU time; a frame copy plus FXAA is a small fraction of
 * that while still smoothing the stair-stepping on the truck's edges.
 *
 * Deliberately not an EffectComposer chain: rendering into an offscreen
 * target defers tone mapping and sRGB encoding until after alpha blending,
 * which visibly brightens everything semi-transparent over this transparent
 * canvas (the see-through windows, every silhouette edge). Rendering
 * straight to the canvas first keeps colors identical to the MSAA path.
 */
export default function FxaaOutput() {
  const gl = useThree((s) => s.gl);
  const texRef = useRef<THREE.FramebufferTexture | null>(null);
  const bufferSize = useMemo(() => new THREE.Vector2(), []);

  const material = useMemo(() => {
    const backdrop = getComputedStyle(document.documentElement).getPropertyValue('--color-studio-bg') || '#ddd6c1';
    return new THREE.ShaderMaterial({
      name: 'FXAA',
      uniforms: {
        ...THREE.UniformsUtils.clone(FXAAShader.uniforms),
        backdrop: { value: hexToVec3(backdrop) },
      },
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: patchedFragmentShader(),
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
  }, []);
  const quad = useMemo(() => new FullScreenQuad(material), [material]);

  useEffect(
    () => () => {
      quad.dispose();
      material.dispose();
      texRef.current?.dispose();
      texRef.current = null;
    },
    [quad, material],
  );

  // Priority 1: R3F stops doing its own render call and leaves the frame to
  // this one (anything at the default priority 0 — the camera rig, the baked
  // contact shadow — still runs first).
  useFrame(({ scene, camera }) => {
    gl.render(scene, camera);

    gl.getDrawingBufferSize(bufferSize);
    let tex = texRef.current;
    if (!tex || tex.image.width !== bufferSize.x || tex.image.height !== bufferSize.y) {
      tex?.dispose();
      tex = new THREE.FramebufferTexture(bufferSize.x, bufferSize.y);
      // FXAA works by nudging its sample point a fraction of a pixel toward
      // the edge — it needs bilinear filtering, not the Nearest default.
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      texRef.current = tex;
    }
    gl.copyFramebufferToTexture(tex);
    // Imperative three.js uniform update, same escape hatch as the scene's
    // environment map in CarSceneCanvas.tsx.
    // oxlint-disable-next-line react/immutability
    material.uniforms.tDiffuse.value = tex;
    material.uniforms.resolution.value.set(1 / bufferSize.x, 1 / bufferSize.y);
    quad.render(gl);
  }, 1);

  return null;
}
