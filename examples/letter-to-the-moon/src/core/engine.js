import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FINAL_FRAG, FULLSCREEN_VERT } from './shaders.js';

const TRANS_TYPES = {
  none: 0, cut: 0, ink: 1, iris: 2, flash: 3, dip: 4, fade: 4, shutter: 5
};

const FINAL_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uExposure: { value: 1.04 },
    uContrast: { value: 1.035 },
    uSaturation: { value: 1.02 },
    uVignette: { value: .34 },
    uGrain: { value: .022 },
    uAberration: { value: .22 },
    uFade: { value: 1 },
    uTransType: { value: 0 },
    uTransProgress: { value: 0 },
    uTransColor: { value: new THREE.Color('#040811') },
    uTransCenter: { value: new THREE.Vector2(.5, .5) }
  },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: FINAL_FRAG
};

export class Engine {
  constructor(outputCanvas, { width = 1920, height = 804, samples = 2 } = {}) {
    this.width = width;
    this.height = height;
    this.output = outputCanvas;
    this.output.width = width;
    this.output.height = height;
    this.ctx = outputCanvas.getContext('2d', { alpha: false });

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      stencil: false
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x02040a, 1);
    this.renderer.autoClear = true;

    this.camera = new THREE.PerspectiveCamera(36, width / height, .03, 1200);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(width, height);
    if (this.composer.renderTarget1) this.composer.renderTarget1.samples = samples;
    if (this.composer.renderTarget2) this.composer.renderTarget2.samples = samples;

    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), .62, .72, .76);
    this.composer.addPass(this.bloom);

    this.final = new ShaderPass(FINAL_SHADER);
    this.final.renderToScreen = true;
    const u = this.final.material.uniforms;
    u.uResolution.value = new THREE.Vector2(width, height);
    u.uExposure.value = 1.04;
    u.uContrast.value = 1.035;
    u.uSaturation.value = 1.02;
    u.uVignette.value = .34;
    u.uGrain.value = .022;
    u.uAberration.value = .22;
    u.uFade.value = 1;
    u.uTransType.value = 0;
    u.uTransProgress.value = 0;
    u.uTransColor.value = new THREE.Color('#040811');
    u.uTransCenter.value = new THREE.Vector2(.5, .5);
    this.composer.addPass(this.final);

    this.params = {
      bloom: .62, bloomRadius: .72, bloomThreshold: .76,
      exposure: 1.04, contrast: 1.035, saturation: 1.02,
      vignette: .34, grain: .022, aberration: .22,
      fade: 1, transition: null
    };
    this._lastScene = null;
  }

  setOutputSize(width, height) {
    // internal composition stays fixed; overlay scales itself
    this.width = width; this.height = height;
  }

  render(scene, camera, time, params = {}) {
    const p = this.params;
    Object.assign(p, params);
    if (this.renderPass.scene !== scene) this.renderPass.scene = scene;
    if (this.renderPass.camera !== camera) this.renderPass.camera = camera;

    this.renderer.setClearColor(0x02040a, 1);
    this.bloom.strength = p.bloom;
    this.bloom.radius = p.bloomRadius;
    this.bloom.threshold = p.bloomThreshold;

    const u = this.final.material.uniforms;
    u.uTime.value = time;
    u.uExposure.value = p.exposure;
    u.uContrast.value = p.contrast;
    u.uSaturation.value = p.saturation;
    u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain;
    u.uAberration.value = p.aberration;
    u.uFade.value = p.fade;

    const tr = p.transition;
    if (tr && tr.progress > 0.0001 && tr.progress < .9999) {
      u.uTransType.value = TRANS_TYPES[tr.type] ?? 0;
      u.uTransProgress.value = tr.progress;
      u.uTransColor.value.set(tr.color || '#040811');
      u.uTransCenter.value.set(tr.center?.[0] ?? .5, tr.center?.[1] ?? .5);
    } else {
      u.uTransType.value = 0;
      u.uTransProgress.value = 0;
    }

    this.composer.render();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.renderer.domElement, 0, 0, this.width, this.height);
  }

  drawOverlay(fn) {
    this.ctx.save();
    fn(this.ctx, this.width, this.height);
    this.ctx.restore();
  }

  captureFrame(type = 'image/png', quality = 1) {
    return this.output.toDataURL(type, quality);
  }

  dispose() {
    this.composer.dispose?.();
    this.renderer.dispose();
  }
}
