export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm2(vec2 p) {
  float v = 0.0; float a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = r * p * 2.03 + 11.7;
    a *= .5;
  }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0; float a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = r * p * 2.07 + 7.3;
    a *= .5;
  }
  return v;
}
`;

export const FULLSCREEN_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Water                                                              */
/* ------------------------------------------------------------------ */
export const WATER_VERT = /* glsl */`
uniform float uTime;
uniform float uSwell;
uniform float uChop;
uniform float uMirror;
uniform vec2 uFlow;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vHeight;

${GLSL_NOISE}

float waveH(vec2 p) {
  float t = uTime;
  float h = 0.0;
  h += sin(p.x * .52 + t * .48 + 1.3) * .130;
  h += sin(p.y * .41 - t * .38 + 2.1) * .105;
  h += sin((p.x + p.y) * .83 + t * .63) * .062;
  h += sin((p.x - p.y) * 1.47 - t * .87 + .7) * .034;
  h += fbm3(p * .19 + vec2(t * .012, -t * .009) + uFlow) * .46 - .23;
  return h;
}

void main() {
  vUv = uv;
  vec3 p = position;
  float h = waveH(p.xz);
  p.y += h * uSwell;
  float e = .38;
  float hx = waveH(p.xz + vec2(e, 0.0)) - waveH(p.xz - vec2(e, 0.0));
  float hz = waveH(p.xz + vec2(0.0, e)) - waveH(p.xz - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx, 2.0 * e, -hz));
  vNormalW = n;
  vHeight = h;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const WATER_FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uSurface;
uniform vec3 uHorizon;
uniform vec3 uMoonColor;
uniform vec3 uMoonDir;
uniform float uMoonPower;
uniform float uInk;
uniform float uGlitter;
uniform float uFogDensity;
uniform float uStars;
uniform vec3 uStarColor;
uniform float uRipple;
uniform vec2 uRippleCenter;
uniform vec3 uDeepTint;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vHeight;

${GLSL_NOISE}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  float micro1 = vnoise(vWorld.xz * 3.1 + vec2(uTime * .12, -uTime * .08));
  float micro2 = vnoise(vWorld.xz * 8.7 - vec2(uTime * .21, uTime * .13));
  vec3 n = normalize(vNormalW + vec3((micro1 - .5) * .22, 0.0, (micro2 - .5) * .22));
  n = normalize(n);

  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.2);
  vec3 col = mix(uDeep, uSurface, fres * .72 + .06);

  float ink = fbm2(vWorld.xz * .115 + vec2(uTime * .006, 0.0));
  float inkMask = smoothstep(.42, .78, ink) * uInk;
  col = mix(col, uDeepTint, inkMask * .55);

  vec3 h = normalize(viewDir + normalize(uMoonDir));
  float ndh = max(dot(n, h), 0.0);
  float spec = pow(ndh, 110.0) * 1.9 + pow(ndh, 18.0) * .16;
  float glintNoise = vnoise(vWorld.xz * 12.0 + vec2(uTime * .8, uTime * .3));
  float glint = smoothstep(.76, .96, glintNoise) * pow(ndh, 8.0) * uGlitter;
  col += uMoonColor * (spec + glint) * uMoonPower;

  // long, broken moonlight column under the moon
  vec3 moonFlat = normalize(vec3(uMoonDir.x, 0.0, uMoonDir.z));
  float side = abs(dot(normalize(vec3(vWorld.x - cameraPosition.x, 0.0, vWorld.z - cameraPosition.z)), moonFlat));
  float column = exp(-pow((1.0 - side) * 16.0, 2.0)) * smoothstep(1.0, 22.0, dist) * uMoonPower;
  column *= .22 + .28 * vnoise(vWorld.xz * vec2(4.0, 1.0) + uTime * .2);
  col += uMoonColor * column * .20;

  if (uRipple > 0.0) {
    float d = length(vWorld.xz - uRippleCenter);
    float ring = sin(d * 7.4 - uTime * 3.2) * exp(-d * .38);
    ring *= smoothstep(0.0, .45, d) * smoothstep(8.0, .0, d);
    col += uMoonColor * ring * .085 * uRipple;
  }

  if (uStars > 0.0) {
    float st = hash12(floor(vWorld.xz * 7.0));
    float star = smoothstep(.9965, 1.0, st) * (0.55 + 0.45 * sin(uTime * 1.7 + st * 40.0));
    star *= smoothstep(.5, .85, vnoise(vWorld.xz * .8 + uTime * .02));
    col += uStarColor * star * uStars * 2.4;
    col += uStarColor * smoothstep(.72, .95, vnoise(vWorld.xz * 1.7)) * .015 * uStars;
  }

  float foam = smoothstep(.18, .46, vHeight) * smoothstep(.62, .78, vnoise(vWorld.xz * 2.4 + uTime * .1));
  col += uMoonColor * foam * .10 * (1.0 - uStars);

  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  col = mix(col, uHorizon, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Sky                                                                */
/* ------------------------------------------------------------------ */
export const SKY_VERT = /* glsl */`
varying vec3 vDir;
varying vec3 vWorld;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SKY_FRAG = /* glsl */`
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlowColor;
uniform vec3 uMoonDir;
uniform float uGlow;
uniform float uGalaxy;
uniform float uTime;
uniform float uInk;
varying vec3 vDir;
varying vec3 vWorld;

${GLSL_NOISE}

void main() {
  float y = clamp(vDir.y, -1.0, 1.0);
  float h = pow(clamp(1.0 - abs(y), 0.0, 1.0), 2.2);
  vec3 col = mix(uZenith, uHorizon, h);
  col = mix(col, uHorizon * 1.16, smoothstep(-.12, .10, y) * .25);

  float m = max(dot(normalize(vDir), normalize(uMoonDir)), 0.0);
  col += uGlowColor * pow(m, 8.0) * .22 * uGlow;
  col += uGlowColor * pow(m, 1.8) * .035 * uGlow;

  float bandY = y - .22 + sin(vDir.x * 3.4) * .08;
  float galaxy = exp(-pow(bandY / .16, 2.0)) * uGalaxy;
  float dust = fbm2(vec2(atan(vDir.z, vDir.x) * 3.0, y * 8.0) + vec2(1.2, uTime * .002));
  col += vec3(.55, .65, .82) * galaxy * (.08 + .35 * dust) * .75;

  float ink = fbm2(vec2(atan(vDir.z, vDir.x) * 1.8 + uTime * .003, y * 4.2 + .8));
  ink = smoothstep(.54, .86, ink) * smoothstep(-.05, .5, y);
  col = mix(col, uZenith * .72, ink * .35 * uInk);

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Underwater                                                         */
/* ------------------------------------------------------------------ */
export const UNDERWATER_VERT = SKY_VERT;
export const UNDERWATER_FRAG = /* glsl */`
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uGlowColor;
uniform vec3 uMoonDir;
uniform float uTime;
uniform float uCaustic;
varying vec3 vDir;
varying vec3 vWorld;

${GLSL_NOISE}

void main() {
  float y = clamp(vDir.y * .5 + .5, 0.0, 1.0);
  vec3 col = mix(uDeep, uMid, smoothstep(.0, .55, y));
  col = mix(col, uTop, smoothstep(.58, 1.0, y));
  float m = max(dot(normalize(vDir), normalize(uMoonDir)), 0.0);
  col += uGlowColor * pow(m, 6.0) * .30;
  float c = vnoise(vec2(vDir.x * 10.0 + uTime * .12, vDir.z * 10.0 - uTime * .08));
  c *= vnoise(vec2(vDir.x * 23.0 - uTime * .2, vDir.z * 19.0));
  col += uGlowColor * smoothstep(.55, .92, c) * .055 * uCaustic * smoothstep(.4, 1.0, y);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Light shaft                                                        */
/* ------------------------------------------------------------------ */
export const SHAFT_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SHAFT_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uSeed;
uniform float uSoft;
varying vec2 vUv;

${GLSL_NOISE}

void main() {
  float edge = smoothstep(0.0, .22, vUv.x) * smoothstep(1.0, .78, vUv.x);
  float dy = smoothstep(0.0, .18, vUv.y) * smoothstep(1.0, .35, vUv.y);
  float n = fbm2(vec2(vUv.x * 3.0 + uSeed, vUv.y * 2.0 - uTime * .02));
  float a = edge * dy * (.35 + .65 * n) * uOpacity;
  a *= mix(1.0, .35, smoothstep(0.0, 1.0, vUv.y) * uSoft);
  gl_FragColor = vec4(uColor * (0.8 + n * .7), a);
}
`;

/* ------------------------------------------------------------------ */
/* Red thread                                                         */
/* ------------------------------------------------------------------ */
export const THREAD_VERT = /* glsl */`
attribute float aAlong;
attribute float aPhase;
attribute vec3 aDir;
uniform float uTime;
uniform float uEnergy;
uniform float uPulse;
varying float vAlong;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vPhase;

void main() {
  vAlong = aAlong;
  vPhase = aPhase;
  float taper = sin(3.14159265 * clamp(aAlong, 0.0, 1.0));
  float sway = sin(uTime * (1.1 + aPhase * .7) + aAlong * 8.0 + aPhase * 6.2831);
  vec3 p = position + aDir * sway * taper * (.0035 + uEnergy * .009);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const THREAD_FRAG = /* glsl */`
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uGlowColor;
uniform vec3 uCameraPos;
uniform float uPulse;
uniform float uTime;
uniform float uEnergy;
varying float vAlong;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vPhase;

void main() {
  vec3 V = normalize(uCameraPos - vWorld);
  float fres = pow(1.0 - abs(dot(normalize(vNormalW), V)), 2.0);
  vec3 col = mix(uColorA, uColorB, vAlong);
  float pulsePos = mod(uPulse, 1.0);
  float pulse = exp(-pow((vAlong - pulsePos) * 7.0, 2.0));
  float pulse2 = exp(-pow((vAlong - (1.0 - pulsePos)) * 11.0, 2.0));
  col += uGlowColor * (pulse * .45 + pulse2 * .18) * (0.3 + uEnergy * .7);
  col += uGlowColor * fres * .12;
  float fade = smoothstep(0.0, .16, vAlong) * smoothstep(1.0, .8, vAlong);
  float nearFade = smoothstep(.14, 1.25, distance(uCameraPos, vWorld));
  gl_FragColor = vec4(col, (.40 + fade * .60) * nearFade);
}
`;

/* ------------------------------------------------------------------ */
/* Particles                                                          */
/* ------------------------------------------------------------------ */
export const DUST_VERT = /* glsl */`
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uEnergy;
uniform float uDrift;
uniform float uRise;
varying float vAlpha;
varying float vSeed;

void main() {
  vec3 p = position;
  float s = aSeed;
  float ph = s * 6.28318;
  p.x += sin(uTime * (.08 + s * .11) + ph) * uDrift;
  p.y += sin(uTime * (.13 + s * .09) + ph * 1.7) * uDrift * .55 + mod(uTime * uRise * (.2 + s * .8) + s * 9.0, 12.0) * 0.0;
  p.z += cos(uTime * (.07 + s * .1) + ph * 2.1) * uDrift * .8;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = .55 + .45 * sin(uTime * (1.0 + s * 2.0) + ph);
  vAlpha = tw * (.35 + .65 * smoothstep(.0, .6, s));
  vSeed = s;
  gl_PointSize = aSize * uSizeScale * uPixelRatio / max(.4, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const BUBBLE_VERT = /* glsl */`
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uRise;
uniform float uSpread;
varying float vAlpha;
varying float vSeed;

void main() {
  vec3 p = position;
  float s = aSeed;
  float ph = s * 6.28318;
  p.y = mod(p.y + uTime * uRise * (.4 + s * .9), uSpread) - uSpread * .5;
  p.x += sin(uTime * (.8 + s * .7) + ph) * .16;
  p.z += cos(uTime * (.7 + s * .5) + ph * 1.3) * .14;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAlpha = .25 + .6 * smoothstep(.0, .35, s);
  vSeed = s;
  gl_PointSize = aSize * uSizeScale * uPixelRatio / max(.35, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const SNOW_VERT = DUST_VERT;

export const PARTICLE_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSoft;
uniform float uTime;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - .5;
  float d = length(c);
  float core = smoothstep(.5, .0, d);
  float halo = smoothstep(.5, .18, d) * .38;
  float a = (core * .85 + halo) * vAlpha * uOpacity * uSoft;
  vec3 col = uColor * (0.85 + .4 * vSeed);
  gl_FragColor = vec4(col, a);
}
`;

export const STAR_VERT = /* glsl */`
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeScale;
varying float vAlpha;
varying float vSeed;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = .6 + .4 * sin(uTime * (.7 + aSeed * 2.2) + aSeed * 31.0);
  vAlpha = tw;
  vSeed = aSeed;
  gl_PointSize = aSize * uSizeScale * uPixelRatio * (1.0 + aSeed * .8) / max(80.0, -mv.z) * 700.0;
  gl_Position = projectionMatrix * mv;
}
`;

/* ------------------------------------------------------------------ */
/* Final grade + transition                                           */
/* ------------------------------------------------------------------ */
export const FINAL_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uFade;
uniform int uTransType;
uniform float uTransProgress;
uniform vec3 uTransColor;
uniform vec2 uTransCenter;
varying vec2 vUv;

${GLSL_NOISE}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0.0, 1.0);
}
vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - .055, step(vec3(.0031308), c));
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - .5;
  float r2 = dot(centered, centered);
  vec2 ca = centered * (uAberration * .0026) * r2;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - ca).b;

  col *= uExposure;
  col = aces(col);
  col = linearToSRGB(col);

  float l = dot(col, vec3(.2126, .7152, .0722));
  col = mix(col, col * vec3(.82, .91, 1.10), (1.0 - l) * .30);
  col = mix(col, col * vec3(1.055, 1.015, .955), l * .26);
  col = mix(vec3(l), col, uSaturation);
  col = (col - .5) * uContrast + .5;

  float cover = 0.0;
  float rim = 0.0;
  if (uTransType == 1) {
    vec2 q = (uv - uTransCenter) * vec2(uResolution.x / uResolution.y, 1.0);
    float n = fbm2(q * 2.3 + vec2(uTime * .013, -uTime * .009) + 3.1);
    n = n * .72 + fbm3(q * 5.1 - uTime * .016) * .28;
    float sweep = uTransProgress < .5 ? uTransProgress * 2.0 : (1.0 - uTransProgress) * 2.0;
    float th = 1.0 - sweep * 1.38;
    cover = smoothstep(th, th + .13, n);
    rim = exp(-pow((n - th - .06) / .025, 2.0)) * smoothstep(.08, .3, sweep) * .75;
  } else if (uTransType == 2) {
    vec2 q = (uv - uTransCenter) * vec2(uResolution.x / uResolution.y, 1.0);
    float bell = max(0.0, 1.0 - abs(uTransProgress * 2.0 - 1.0));
    float rad = (1.0 - bell) * 1.75;
    float d = length(q);
    cover = smoothstep(rad - .004, rad + .004, d);
    rim = exp(-pow((d - rad) / .012, 2.0)) * .85;
  } else if (uTransType == 3) {
    float bell = max(0.0, 1.0 - abs(uTransProgress * 2.0 - 1.0));
    cover = pow(bell, 1.65);
    rim = pow(bell, 5.0) * .35;
  } else if (uTransType == 4) {
    float bell = max(0.0, 1.0 - abs(uTransProgress * 2.0 - 1.0));
    cover = smoothstep(.0, .55, bell);
  } else if (uTransType == 5) {
    // letterbox shutter
    float bell = max(0.0, 1.0 - abs(uTransProgress * 2.0 - 1.0));
    float y = abs(uv.y - .5) * 2.0;
    cover = smoothstep(1.0 - bell * 1.15, .9 - bell * 1.15, y);
    rim = smoothstep(.01, .0, abs(y - (1.0 - bell * 1.15))) * .35;
  }

  col = mix(col, uTransColor, clamp(cover, 0.0, 1.0));
  col += vec3(rim) * (uTransType == 3 ? uTransColor : vec3(.26, .08, .045));

  float vig = smoothstep(.34, .92, length(centered * vec2(1.0, 1.12)));
  col *= 1.0 - uVignette * vig;
  float grain = hash12(floor(uv * uResolution * 1.18) + fract(uTime * 7.0) * 57.0) - .5;
  col += grain * uGrain * (.45 + (1.0 - l) * .55);
  col *= uFade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Portal / magic                                                     */
/* ------------------------------------------------------------------ */
export const PORTAL_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PORTAL_FRAG = /* glsl */`
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;

${GLSL_NOISE}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float n = fbm2(vec2(a * 2.1 + uTime * .08, r * 4.0 - uTime * .12));
  float spiral = sin(a * 5.0 + r * 16.0 - uTime * .9 + n * 4.0) * .5 + .5;
  float body = smoothstep(1.0, .2, r) * smoothstep(0.0, .35, r);
  float ring = exp(-pow((r - .82) / .035, 2.0));
  vec3 col = mix(uColorA, uColorB, spiral * .6 + n * .4);
  float alpha = body * (.12 + spiral * .26) + ring * .5;
  alpha *= uOpacity;
  gl_FragColor = vec4(col * (1.0 + spiral * .8), alpha);
}
`;
