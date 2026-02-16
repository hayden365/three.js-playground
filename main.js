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

// 처음 렌더될 때부터 오른쪽으로 수평 회전한 각도로 보이도록 초기 위치 설정
const target = new THREE.Vector3(0, 1, -20);
const initialDistance = 36; // 타깃 ~ 카메라 거리
const initialPolar = Math.acos(4 / initialDistance); // 위아래 각도 (기존과 비슷하게)
const initialAzimuth = 0.3; // 수평 회전 (라디안). 양수=오른쪽, 0=정면
const spherical = new THREE.Spherical();
spherical.set(initialDistance, initialPolar, initialAzimuth);
camera.position.copy(target.clone().add(new THREE.Vector3().setFromSpherical(spherical)));
camera.lookAt(target);

const controls = new OrbitControls(camera, canvas);
controls.enabled = true;
controls.enableZoom = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.copy(target);
controls.minDistance = 20;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI * 0.4;
controls.minAzimuthAngle = -0.45;
controls.maxAzimuthAngle = 0.6;
controls.autoRotate = false;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ——— 대기 원근법 (안개) ———
scene.fog = new THREE.FogExp2(0x8b3a2a, 0.028);
scene.background = new THREE.Color(0x8b3a2a);

// ——— 오렌지 그라데이션 하늘 ———
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 512;
skyCanvas.height = 512;
const ctx = skyCanvas.getContext('2d');
const gradient = ctx.createLinearGradient(0, 0, 0, 512);
gradient.addColorStop(0, '#e8a855');
gradient.addColorStop(0.35, '#d9753a');
gradient.addColorStop(0.7, '#b84a28');
gradient.addColorStop(1, '#6b2a1f');
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
  loader.load(
    './heightmap.png',
    (disMap) => {
      disMap.wrapS = disMap.wrapT = THREE.ClampToEdgeWrapping;
      disMap.repeat.set(1, 1);
      addGroundMesh(groundGeo, disMap);
    },
    undefined,
    () => {
      const disMap = createFallbackHeightmap();
      addGroundMesh(groundGeo, disMap);
    },
  );
}

function addGroundMesh(groundGeo, displacementMap) {
  const dispScale = 5.5;
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2d1814,
    wireframe: false,
    displacementMap: displacementMap,
    displacementScale: dispScale,
    displacementBias: 0,
    roughness: 0.92,
    metalness: 0.04,
  });

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.5;
  groundMesh.position.z = -18;
  groundMesh.scale.setScalar(1.35);
  groundMesh.rotation.y = 0.38;
  groundMesh.receiveShadow = true;
  groundMesh.castShadow = true;
  scene.add(groundMesh);
}

createGround();

// ——— 붉은 수면/지면 ———
const waterGeo = new THREE.PlaneGeometry(140, 50, 1, 1);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x5c1f1a,
  roughness: 0.4,
  metalness: 0.15,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.set(0, -0.2, -8);
water.receiveShadow = true;
scene.add(water);

// ——— 조명 (튜토리얼 스타일: 방향광 + 헤미스피어로 경사면 강조) ———
const sunLight = new THREE.DirectionalLight(0xffb366, 1.0);
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

const hemiLight = new THREE.HemisphereLight(0xd9753a, 0x4a2520, 0.5);
scene.add(hemiLight);

const ambient = new THREE.AmbientLight(0x8b5a45, 0.25);
scene.add(ambient);

// ——— 윈도우 리사이즈 ———
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ——— 렌더 루프 ———
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
