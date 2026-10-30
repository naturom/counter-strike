import * as THREE from 'three';

// Blend randomly offset/rotated samples on a triangular lattice. World coordinates
// keep the pattern continuous where separate floor slabs meet (including ramps).
const sandSampling = /* glsl */`
varying vec2 vSandWorld;
vec2 sandHash(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
float sandNoise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sandHash(cell).x, sandHash(cell + vec2(1, 0)).x, f.x),
             mix(sandHash(cell + vec2(0, 1)).x, sandHash(cell + vec2(1, 1)).x, f.x), f.y);
}
vec4 sandPatch(sampler2D tex, vec2 uv, vec2 cell, bool isNormal) {
  vec2 random = sandHash(cell);
  float angle = floor(random.x * 4.0) * 1.570796327;
  float c = cos(angle), s = sin(angle);
  mat2 rotation = mat2(c, s, -s, c);
  // Explicit derivatives avoid mip seams at the random offsets and rotations.
  vec4 value = textureGrad(tex, rotation * uv + random * 17.0,
                          rotation * dFdx(uv), rotation * dFdy(uv));
  if (isNormal) {
    vec2 xy = value.xy * 2.0 - 1.0;
    value.xy = (vec2(c * xy.x + s * xy.y, -s * xy.x + c * xy.y) + 1.0) * 0.5;
  }
  return value;
}
vec4 sandSample(sampler2D tex, bool isNormal) {
  vec2 uv = vSandWorld / 1.8;
  vec2 grid = mat2(1.0, 0.0, -0.577350269, 1.154700538) * (uv * 1.3);
  vec2 cell = floor(grid), f = fract(grid);
  vec2 a, b, c;
  vec3 weights;
  if (f.x + f.y < 1.0) {
    a = cell; b = cell + vec2(1, 0); c = cell + vec2(0, 1);
    weights = vec3(1.0 - f.x - f.y, f.x, f.y);
  } else {
    a = cell + vec2(1, 1); b = cell + vec2(0, 1); c = cell + vec2(1, 0);
    weights = vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y);
  }
  // Preserve fine grain while the zero-slope edges hide patch boundaries.
  weights *= weights;
  weights /= dot(weights, vec3(1.0));
  return sandPatch(tex, uv, a, isNormal) * weights.x
       + sandPatch(tex, uv, b, isNormal) * weights.y
       + sandPatch(tex, uv, c, isNormal) * weights.z;
}
`;

export function naturalSand(material:THREE.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSandWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSandWorld = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${sandSampling}`)
      .replace('#include <map_fragment>', /* glsl */`
        #ifdef USE_MAP
          vec4 sandColor = sandSample(map, false);
          sandColor.rgb = mix(vec3(0.35, 0.28, 0.22), sandColor.rgb, 0.78);
          float weathering = 0.96 + sandNoise(vSandWorld * 0.075) * 0.08;
          diffuseColor *= vec4(sandColor.rgb * weathering, sandColor.a);
        #endif
      `)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps
        .replace('texture2D( normalMap, vNormalMapUv )', 'sandSample(normalMap, true)'));
  };
  material.customProgramCacheKey = () => 'natural-sand-world-v1';
  return material;
}
