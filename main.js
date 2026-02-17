import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ——— 씬·카메라·렌더러 ———
const canvas = document.getElementById('bg-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);

// ===== 기준 시점 설정 (이 부분을 수정하면 카메라의 기준 시점이 변경됩니다) =====
// 타겟 위치 (카메라가 바라보는 중심점)
const target = new THREE.Vector3(10, 0, -16); // (x, y, z) 좌표

// 카메라와 타겟 사이의 거리
const initialDistance = 15; // 값이 클수록 멀리서 봄

// 위아래 각도 (수직 각도)
const initialPolar = Math.acos(2 / initialDistance); // 0~π, 작을수록 위에서 내려다봄

// 좌우 각도 (수평 각도)
const initialAzimuth = 0.2; // 라디안, 양수=오른쪽, 음수=왼쪽, 0=정면

// 구면 좌표계로 카메라 위치 계산
const spherical = new THREE.Spherical();
spherical.set(initialDistance, initialPolar, initialAzimuth);
camera.position.copy(
  target.clone().add(new THREE.Vector3().setFromSpherical(spherical)),
);
camera.lookAt(target); // 카메라가 타겟을 바라보도록 설정
// ===== 기준 시점 설정 끝 =====

const controls = new OrbitControls(camera, canvas);
controls.enabled = true;
controls.enableZoom = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.copy(target);
controls.minDistance = 16;
controls.maxDistance = 35;

// 시점 고정: 위아래 각도 제한 (초기 각도 기준 ±0.1 라디안, 약 ±5.7도)
const initialPolarAngle = initialPolar;
controls.minPolarAngle = initialPolarAngle - 0.1;
controls.maxPolarAngle = initialPolarAngle + 0.1;

// 시점 고정: 좌우 각도 제한 (초기 각도 기준 ±0.3 라디안, 약 ±17도)
controls.minAzimuthAngle = initialAzimuth - 0.3;
controls.maxAzimuthAngle = initialAzimuth + 0.3;

controls.autoRotate = false;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85; // 약간 어둡게 조정
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ——— 대기 원근법 (안개) - 올리브 그린 계열 (뒷부분 흐리게) ———
// 셰이더에서 노이즈 기반 안개를 처리하므로 씬 안개는 약하게 설정
scene.fog = new THREE.FogExp2(0x2a2801, 0.012); // 통일된 배경 색상
// 배경에 그라데이션 적용 (하늘과 통일)
scene.background = new THREE.Color(0x5a6201); // 중간 올리브 그린 (그라데이션 중간값)

// ——— 올리브 그린 그라데이션 하늘 (통일된 그라데이션) ———
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 512;
skyCanvas.height = 512;
const ctx = skyCanvas.getContext('2d');
const gradient = ctx.createLinearGradient(0, 0, 0, 512);
gradient.addColorStop(0, '#7e8701'); // 밝은 황록색 (상단)
gradient.addColorStop(0.2, '#6b7501');
gradient.addColorStop(0.4, '#5a6201'); // 중간 올리브 그린
gradient.addColorStop(0.6, '#4a5001');
gradient.addColorStop(0.8, '#3a3f01'); // 어두운 올리브 그린
gradient.addColorStop(1, '#2a2801'); // 매우 어두운 하단
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 512, 512);

const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.wrapS = THREE.ClampToEdgeWrapping;
skyTexture.wrapT = THREE.ClampToEdgeWrapping;

const skyGeo = new THREE.PlaneGeometry(120, 80, 1, 1);
const skyMat = new THREE.MeshBasicMaterial({
  map: skyTexture,
  depthWrite: false,
  side: THREE.BackSide,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
sky.position.z = -60;
sky.position.y = 0;
scene.add(sky);

// ——— createGround(): heightmap.png 디스플레이스맵 (참고 코드 방식) ———
// PLANE (width, depth, width segments, depth segments)
// displacementMap: 흰색=높음, 검정=낮음 / displacementScale: 디스플레이스 강도
function createFallbackHeightmap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(
    size / 2,
    size * 0.4,
    0,
    size / 2,
    size * 0.4,
    size * 0.5,
  );
  g.addColorStop(0, '#fff');
  g.addColorStop(0.5, '#888');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createGround() {
  const widthSeg = 120;
  const heightSeg = 80;
  const planeWidth = 80;
  const planeDepth = 50;

  const groundGeo = new THREE.PlaneGeometry(
    planeWidth,
    planeDepth,
    widthSeg,
    heightSeg,
  );

  const loader = new THREE.TextureLoader();
  // GitHub Pages 호환: 여러 경로 순차 시도
  const tryLoadImage = (paths, index = 0) => {
    if (index >= paths.length) {
      // 모든 경로 실패 시 대체 heightmap 사용
      console.warn('h2.png를 모든 경로에서 찾을 수 없음, 대체 heightmap 사용');
      const disMap = createFallbackHeightmap();
      addGroundMesh(groundGeo, disMap);
      return;
    }
    
    loader.load(
      paths[index],
      (disMap) => {
        disMap.wrapS = disMap.wrapT = THREE.ClampToEdgeWrapping;
        disMap.repeat.set(1, 1);
        addGroundMesh(groundGeo, disMap);
      },
      undefined,
      () => {
        // 현재 경로 실패, 다음 경로 시도
        tryLoadImage(paths, index + 1);
      }
    );
  };
  
  // 여러 경로 시도 (GitHub Pages 호환)
  const imagePaths = [
    'h2.png',           // 루트 기준
    './h2.png',         // 상대 경로
    '/h2.png',          // 절대 경로
  ];
  
  tryLoadImage(imagePaths);
}

function addGroundMesh(groundGeo, displacementMap) {
  const dispScale = 5.5;
  const groundMat = new THREE.ShaderMaterial({
    vertexShader: `
      uniform sampler2D displacementMap;
      uniform float displacementScale;
      uniform float displacementBias;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        float h = texture2D(displacementMap, uv).r * displacementScale + displacementBias;
        vec3 pos = position + normal * h;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }

    `,
    fragmentShader: `
      uniform sampler2D displacementMap;
      uniform float uTime;
      // cameraPosition은 Three.js가 자동으로 제공하므로 선언 불필요
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        float f = 1.0;
        for (int i = 0; i < 5; i++) {
          v += a * noise2(p * f);
          f *= 2.0;
          a *= 0.5;
        }
        return v;
      }
      float turbulence(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        float f = 1.0;
        for (int i = 0; i < 4; i++) {
          v += a * abs(noise2(p * f) - 0.5);
          f *= 2.0;
          a *= 0.5;
        }
        return v * 2.0;
      }

      float sampleMarbleTriplanar(vec3 p, vec3 n, float scale) {
        vec3 absN = abs(n);
        absN = pow(absN, vec3(4.0));
        float total = absN.x + absN.y + absN.z;
        absN /= total;
        vec2 xz = p.xz * scale;
        vec2 xy = p.xy * scale;
        vec2 yz = p.yz * scale;
        vec2 qXZ = vec2(fbm(xz * 1.8), fbm(xz * 1.8 + vec2(1.3, 0.2)));
        vec2 qXY = vec2(fbm(xy * 1.8), fbm(xy * 1.8 + vec2(1.3, 0.2)));
        vec2 qYZ = vec2(fbm(yz * 1.8), fbm(yz * 1.8 + vec2(1.3, 0.2)));
        vec2 rXZ = xz * 4.2 + 2.0 * qXZ;
        vec2 rXY = xy * 4.2 + 2.0 * qXY;
        vec2 rYZ = yz * 4.2 + 2.0 * qYZ;
        float turbXZ = turbulence(xz * 3.0 + 0.5 * qXZ);
        float turbXY = turbulence(xy * 3.0 + 0.5 * qXY);
        float turbYZ = turbulence(yz * 3.0 + 0.5 * qYZ);
        float sXZ = fbm(rXZ) + 0.2 * turbXZ;
        float sXY = fbm(rXY) + 0.2 * turbXY;
        float sYZ = fbm(rYZ) + 0.2 * turbYZ;
        return sXZ * absN.y + sXY * absN.z + sYZ * absN.x;
      }

      void main() {
        float h = texture2D(displacementMap, vUv).r;
        float hL = texture2D(displacementMap, vUv - vec2(0.004, 0.0)).r;
        float hR = texture2D(displacementMap, vUv + vec2(0.004, 0.0)).r;
        float hU = texture2D(displacementMap, vUv + vec2(0.0, 0.004)).r;
        float hD = texture2D(displacementMap, vUv - vec2(0.0, 0.004)).r;

        vec3 N = normalize(vWorldNormal);
        vec3 absN = abs(N);
        float slope = 1.0 - absN.y;
        
        // 산의 선 일렁거림 효과 (강화)
        float shimmerTime = uTime * 0.3;
        vec3 shimmerNoise = vec3(
          noise2(vWorldPos.xz * 0.8 + vec2(shimmerTime, 0.0)),
          noise2(vWorldPos.xz * 0.8 + vec2(shimmerTime + 5.0, 2.5)),
          noise2(vWorldPos.xz * 0.8 + vec2(shimmerTime + 10.0, 5.0))
        );
        shimmerNoise = (shimmerNoise - 0.5) * 0.08; // 변동 강화
        N = normalize(N + shimmerNoise); // 노말을 변동시켜 경계선 일렁거림
        
        float splotch = sampleMarbleTriplanar(vWorldPos, N, 0.08);
        splotch = clamp(splotch, 0.0, 1.0);

        float turb = turbulence(vWorldPos.xz * 0.12 + vWorldPos.xy * 0.08 * absN.x + vWorldPos.yz * 0.08 * absN.y);
        float slopeBreak = slope * slope;
        splotch = splotch + turb * (0.12 + 0.18 * slopeBreak);
        splotch = mix(splotch, splotch * 0.7 + 0.3 * turb, slopeBreak * 0.4);
        splotch = clamp(splotch, 0.0, 1.0);

        float baseDark = 0.05 + 0.15 * (1.0 - h);
        float baseLight = 0.82 + 0.18 * h;
        float t = mix(baseDark, baseLight, splotch);
        t = mix(t, t * 0.26, (1.0 - smoothstep(0.35, 0.58, splotch)) * (0.55 + 0.45 * (1.0 - h)));
        t = mix(t, t * 1.22, smoothstep(0.58, 0.82, splotch) * (0.3 + 0.4 * h));
        t = clamp(t, 0.0, 1.0);

        float ridgeX = smoothstep(0.0, 0.02, h - max(hL, hR));
        float ridgeY = smoothstep(0.0, 0.02, h - max(hU, hD));
        float ridgeMask = max(ridgeX, ridgeY) * smoothstep(0.12, 0.4, h) * (1.0 - smoothstep(0.88, 0.98, h));

        float splatterZone = fbm(vWorldPos.xz * 0.15 + vec2(7.1, 13.2));
        float scatterZone = fbm(vWorldPos.xz * 0.25 + vec2(0.5, 2.0));

        vec2 dotUV1 = vWorldPos.xz * 0.8 + vec2(hash(vWorldPos.xz) * 0.3, hash(vWorldPos.xz + 0.3) * 0.3);
        vec2 dotF1 = fract(dotUV1) - 0.5;
        float dotR1 = 0.04 + 0.06 * hash(floor(dotUV1));
        float dotRand1 = hash(floor(dotUV1) + 0.1);
        float dot1 = (1.0 - smoothstep(dotR1 - 0.01, dotR1, length(dotF1))) * step(0.88, dotRand1);

        float ridgeDots = dot1 * (ridgeMask * 0.95 + (1.0 - ridgeMask) * 0.15);
        float splatterOnWhite = dot1 * step(0.78, dotRand1 + 0.1) * smoothstep(0.5, 0.85, h) * smoothstep(0.45, 0.7, splatterZone);

        t = mix(t, 0.04, ridgeDots * 0.88);
        t = mix(t, 0.05, splatterOnWhite * 0.9);
        t = clamp(t, 0.0, 1.0);

        float grain = noise2(vWorldPos.xz * 1.2) * 0.5 + noise2(vWorldPos.xz * 2.5 + 1.5) * 0.5;
        t = t + (grain - 0.5) * 0.08;
        t = clamp(t, 0.0, 1.0);

        // 거리 계산
        float dist = distance(vWorldPos, cameraPosition);
        
        // 1. 산은 흰색~검정 그레이스케일로 먼저 계산
        vec3 lightDir = normalize(vec3(-0.5, 1.0, 0.3)); // 조명 방향
        float ndotl = max(dot(N, lightDir), 0.0);
        float shadow = 1.0 - ndotl;
        shadow = pow(shadow, 1.5);
        
        // 그레이스케일 밝기: t(마블) + 그림자 → 0(검정) ~ 1(흰색)
        float gray = t;
        gray = gray * (1.0 - shadow * 0.7); // 그림자로 어둡게
        gray = gray * (1.0 - slope * shadow * 0.25);
        float deepShadow = pow(shadow, 2.5);
        gray = gray * (1.0 - deepShadow * 0.5);
        gray = clamp(gray, 0.0, 1.0);
        
        // 2. 대기 원근법: 앞은 진하게, 뒤는 완전히 흐리게 (그레이스케일 유지)
        float atmosphericFade = smoothstep(12.0, 45.0, dist);
        float nearBoost = 1.0 - smoothstep(0.0, 25.0, dist);
        gray = gray * (1.0 + nearBoost * 0.4); // 앞의 산 밝게
        gray = gray * (1.0 - atmosphericFade * 0.9); // 뒤의 산 어둡게
        gray = mix(gray, 0.0, atmosphericFade * 0.85); // 뒤는 검정으로 페이드
        gray = clamp(gray, 0.0, 1.0);
        
        // 3. 그레이스케일 산 (흰색~검정)
        vec3 baseColor = vec3(gray, gray, gray);
        
        // 4. 오버레이: 녹색을 덮는 느낌 (그린 틴트)
        vec3 greenOverlayDark = vec3(0.15, 0.22, 0.08);   // 어두운 녹색
        vec3 greenOverlayLight = vec3(0.45, 0.55, 0.2);   // 밝은 녹색
        vec3 greenTint = mix(greenOverlayDark, greenOverlayLight, gray);
        // 오버레이 블렌드: 그레이 위에 녹색을 덮음
        baseColor = mix(baseColor, greenTint, 0.75); // 75% 녹색 오버레이
        
        vec3 fogColor = vec3(0.184, 0.224, 0.051); // 배경 안개 색상
        
        // 5. 노이즈 기반 안개 레이어 (저주파 노이즈 + 부드러운 페이드)
        float fogNoise = fbm(vWorldPos.xz * 0.08);
        fogNoise = smoothstep(0.3, 0.7, fogNoise);
        float fogFactor = smoothstep(25.0, 70.0, dist);
        fogFactor = fogFactor * (0.7 + fogNoise * 0.3);
        fogFactor = clamp(fogFactor, 0.0, 0.65);
        
        vec3 fogColorVaried = fogColor + vec3(fogNoise - 0.5) * 0.02;
        vec3 col = mix(baseColor, fogColorVaried, fogFactor);
        
        // 3. 톤매핑/컬러 그레이딩 (감마 + 톤매핑 + 필름 그레인)
        // ACES 톤매핑 (간단 버전)
        col = col / (col + vec3(1.0));
        col = pow(col, vec3(1.0 / 2.2)); // 감마 보정
        
        // Color Noise Modulation - 색상 자체가 노이즈에 의해 미세하게 변동 (숨 쉬는 배경)
        float colorNoiseTime = uTime * 0.3;
        vec3 colorNoise = vec3(
          noise2(vWorldPos.xz * 0.15 + vec2(colorNoiseTime, 0.0)),
          noise2(vWorldPos.xz * 0.15 + vec2(colorNoiseTime + 10.0, 5.0)),
          noise2(vWorldPos.xz * 0.15 + vec2(colorNoiseTime + 20.0, 10.0))
        );
        colorNoise = (colorNoise - 0.5) * 0.08; // 미세한 변동
        col = col + colorNoise; // 색상이 숨 쉬는 느낌
        
        // 컬러 그레이딩 (매우 미세하게만)
        vec3 colorGrade = vec3(1.0);
        colorGrade.r = 1.0 + (col.g - col.r) * 0.02;
        colorGrade.b = 1.0 + (col.g - col.b) * 0.015;
        col = col * colorGrade;
        
        // 색상 클램핑
        col = clamp(col, vec3(0.0), vec3(1.0));
        
        // Subtle Film Grain Overlay - 미세한 필름 그레인 (전체 화면에 얇게 깔림)
        float grainTime = uTime * 0.1;
        float filmGrain = noise2(vWorldPos.xz * 3.0 + vec2(grainTime * 5.0, grainTime * 3.0));
        filmGrain = (filmGrain - 0.5) * 0.015; // 매우 미세한 그레인
        col = col + vec3(filmGrain); // 전체 화면에 얇게 깔림
        
        // Gradient Dithering - 안개/대기 표현에 디더링 적용
        float ditherNoise = noise2(vWorldPos.xz * 2.0 + vec2(grainTime * 2.0, grainTime * 1.5));
        ditherNoise = (ditherNoise - 0.5) * 0.01; // 그라데이션이 살아 움직이는 느낌
        col = col + vec3(ditherNoise);
        
        // 색상 클램핑
        col = clamp(col, vec3(0.0), vec3(1.0));
        
        // 최소 밝기 보장
        col = max(col, vec3(0.05));
        
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    uniforms: {
      displacementMap: { value: displacementMap },
      displacementScale: { value: dispScale },
      displacementBias: { value: 0.0 },
      uTime: { value: 0.0 }, // Color noise modulation & film grain 애니메이션용 시간
      // cameraPosition은 Three.js가 자동으로 제공하므로 uniform에 추가 불필요
    },
    wireframe: false,
  });

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.5;
  groundMesh.position.z = -18;
  groundMesh.scale.setScalar(1.35);
  groundMesh.rotation.y = 0;
  groundMesh.receiveShadow = true;
  groundMesh.castShadow = true;
  scene.add(groundMesh);

  // 셰이더 참조 저장 (시간 업데이트용)
  window.groundMaterial = groundMat;
}

createGround();

// ——— 물/지면 (안개/그라데이션에 섞이도록 셰이더 사용) ———
const groundPlaneSize = 1200;
const waterGeo = new THREE.PlaneGeometry(
  groundPlaneSize,
  groundPlaneSize,
  1,
  1,
);
waterGeo.rotateX(-Math.PI / 2);

const waterMat = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vWorldPos;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vWorldPos;
    
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      float f = 1.0;
      for (int i = 0; i < 4; i++) {
        v += a * noise2(p * f);
        f *= 2.0;
        a *= 0.5;
      }
      return v;
    }
    
    void main() {
      // 물 기본 색상 (어두운 올리브 그린/갈색)
      vec3 waterBase = vec3(0.165, 0.157, 0.055); // #2a280e
      vec3 fogColor = vec3(0.184, 0.224, 0.051); // #2f390d
      
      // 거리 계산
      float dist = distance(vWorldPos, cameraPosition);
      
      // 바닥 일렁거림 효과 (물 파도) - 강화
      float rippleTime = uTime * 0.8;
      vec2 rippleOffset = vec2(
        sin(vWorldPos.x * 0.5 + rippleTime) * 0.3,
        cos(vWorldPos.z * 0.5 + rippleTime * 0.9) * 0.3
      );
      vec2 rippledUV = vWorldPos.xz + rippleOffset;
      
      // 산의 위치 추정 (지형 높이 시뮬레이션)
      float mountainHeight = fbm(rippledUV * 0.1) * 5.0;
      float mountainDistance = length(vWorldPos.xz - vec2(0.0, -18.0)); // 산의 대략적 위치
      float mountainProximity = 1.0 - smoothstep(0.0, 25.0, mountainDistance);
      
      // 산에 부딪치는 영역에 빛의 색감 표현 (강화)
      vec3 lightColor = vec3(0.95, 0.9, 0.7); // 따뜻한 빛 색상
      float lightIntensity = mountainProximity * smoothstep(0.0, 20.0, mountainDistance);
      lightIntensity *= (1.0 + sin(rippleTime * 2.5) * 0.5); // 빛이 더 강하게 깜빡임
      waterBase = mix(waterBase, lightColor, lightIntensity * 0.4); // 빛 효과 강화
      
      // 산의 음영이 비치도록 물 반사 효과 (산의 그림자 반사) - 강화
      float shadowReflection = fbm(rippledUV * 0.2 + vec2(10.0, 5.0));
      shadowReflection = smoothstep(0.3, 0.8, shadowReflection);
      vec3 shadowColor = vec3(0.0, 0.0, 0.0); // 검은색 그림자
      waterBase = mix(waterBase, shadowColor, shadowReflection * mountainProximity * 0.5); // 반사 강화
      
      // 물에 비친 산 일렁거림 (반사 왜곡) - 강화
      vec2 reflectionUV = rippledUV;
      reflectionUV += vec2(
        sin(rippleTime * 2.0 + reflectionUV.x * 0.3) * 1.0,
        cos(rippleTime * 1.8 + reflectionUV.y * 0.3) * 1.0
      );
      float reflectedMountain = fbm(reflectionUV * 0.15);
      vec3 mountainReflection = vec3(0.15, 0.18, 0.12) * reflectedMountain;
      waterBase = mix(waterBase, mountainReflection, mountainProximity * 0.4); // 반사 강화
      
      // 대기 원근법 적용 (멀수록 명도↑ 채도↓)
      float atmosphericFade = smoothstep(10.0, 60.0, dist);
      float brightnessBoost = atmosphericFade * 0.25;
      waterBase = waterBase + vec3(brightnessBoost);
      
      // 채도 감소
      float luminance = dot(waterBase, vec3(0.299, 0.587, 0.114));
      vec3 desaturated = mix(waterBase, vec3(luminance), atmosphericFade * 0.5);
      waterBase = mix(waterBase, desaturated, atmosphericFade);
      
      // 노이즈 기반 안개 레이어
      float fogNoise = fbm(vWorldPos.xz * 0.08);
      fogNoise = smoothstep(0.3, 0.7, fogNoise);
      float fogFactor = smoothstep(15.0, 70.0, dist);
      fogFactor = fogFactor * (0.7 + fogNoise * 0.3);
      fogFactor = clamp(fogFactor, 0.0, 0.7);
      
      // 안개 색상 변동
      vec3 fogColorVaried = fogColor + vec3(fogNoise - 0.5) * 0.02;
      vec3 col = mix(waterBase, fogColorVaried, fogFactor);
      
      // 톤매핑
      col = col / (col + vec3(1.0));
      col = pow(col, vec3(1.0 / 2.2));
      
      // Color Noise Modulation
      float colorNoiseTime = uTime * 0.3;
      vec3 colorNoise = vec3(
        noise2(vWorldPos.xz * 0.15 + vec2(colorNoiseTime, 0.0)),
        noise2(vWorldPos.xz * 0.15 + vec2(colorNoiseTime + 10.0, 5.0)),
        noise2(vWorldPos.xz * 0.15 + vec2(colorNoiseTime + 20.0, 10.0))
      );
      colorNoise = (colorNoise - 0.5) * 0.06;
      col = col + colorNoise;
      
      // 컬러 그레이딩
      vec3 colorGrade = vec3(1.0);
      colorGrade.r = 1.0 + (col.g - col.r) * 0.015;
      colorGrade.b = 1.0 + (col.g - col.b) * 0.01;
      col = col * colorGrade;
      
      // 색상 클램핑
      col = clamp(col, vec3(0.0), vec3(1.0));
      
      // Subtle Film Grain Overlay
      float grainTime = uTime * 0.1;
      float filmGrain = noise2(vWorldPos.xz * 3.0 + vec2(grainTime * 5.0, grainTime * 3.0));
      filmGrain = (filmGrain - 0.5) * 0.012;
      col = col + vec3(filmGrain);
      
      // Gradient Dithering
      float ditherNoise = noise2(vWorldPos.xz * 2.0 + vec2(grainTime * 2.0, grainTime * 1.5));
      ditherNoise = (ditherNoise - 0.5) * 0.008;
      col = col + vec3(ditherNoise);
      
      // 색상 클램핑
      col = clamp(col, vec3(0.0), vec3(1.0));
      
      // 최소 밝기 보장
      col = max(col, vec3(0.06));
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  uniforms: {
    uTime: { value: 0.0 }, // Color noise modulation & film grain 애니메이션용 시간
  },
});

const water = new THREE.Mesh(waterGeo, waterMat);
water.position.set(0, -0.2, -8);
water.receiveShadow = true;
scene.add(water);

// ——— 조명 (올리브 그린 계열 조명) ———
const sunLight = new THREE.DirectionalLight(0x8fa85a, 0.9); // 부드러운 황록색 조명
sunLight.position.set(-12, 22, 8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 120;
sunLight.shadow.camera.left = -45;
sunLight.shadow.camera.right = 45;
sunLight.shadow.camera.top = 35;
sunLight.shadow.camera.bottom = -35;
sunLight.shadow.bias = -0.0002;
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight(0x5d7311, 0x2f390d, 0.6); // 황록색, 짙은 올리브 그린
scene.add(hemiLight);

const ambient = new THREE.AmbientLight(0x4a5a0f, 0.3); // 중간 올리브 그린
scene.add(ambient);

// ——— 윈도우 리사이즈 ———
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ——— 렌더 루프 ———
let time = 0;
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // 시간 업데이트 (Color noise modulation & film grain 애니메이션용)
  time += 0.016; // 약 60fps 기준
  if (window.groundMaterial) {
    window.groundMaterial.uniforms.uTime.value = time;
  }
  if (waterMat) {
    waterMat.uniforms.uTime.value = time;
  }

  renderer.render(scene, camera);
}
animate();
