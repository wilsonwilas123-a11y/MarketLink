import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type SceneKind = 'farm' | 'admin';

const green = ['#45d49b', '#79e4a6', '#1f8c60', '#b1ed85'];

function makeLeaf(color: string) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.7, 0.16, -0.88, 0.72, 0, 1.45);
  shape.bezierCurveTo(0.88, 0.72, 0.7, 0.16, 0, 0);

  const leaf = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 16),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.38,
      metalness: 0.04,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
    }),
  );
  leaf.castShadow = false;
  return leaf;
}

function addFarmScene(scene: THREE.Scene, root: THREE.Group) {
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.5, 0),
    new THREE.Vector3(0.08, -0.65, 0),
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(-0.08, 1.05, 0),
    new THREE.Vector3(0.05, 1.75, 0),
  ]);
  root.add(new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 24, 0.035, 6, false),
    new THREE.MeshStandardMaterial({ color: '#247853', roughness: 0.7 }),
  ));

  for (let i = 0; i < 7; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const leaf = makeLeaf(green[i % green.length] ?? '#45d49b');
    const height = -0.98 + i * 0.43;
    leaf.position.set(side * 0.02, height, 0);
    leaf.rotation.set(0.14 * side, 0.22 * side, side * (0.38 + (i % 3) * 0.16));
    leaf.scale.setScalar(0.62 + (i % 3) * 0.09);
    root.add(leaf);
  }

  const fruits = [
    { x: 0.85, y: -0.75, z: 0.28, size: 0.36, color: '#f29c43' },
    { x: -0.86, y: 0.25, z: 0.3, size: 0.29, color: '#e45c4a' },
    { x: 0.8, y: 1.06, z: 0.32, size: 0.24, color: '#f3c94c' },
  ];
  for (const fruit of fruits) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(fruit.size, 20, 16),
      new THREE.MeshStandardMaterial({ color: fruit.color, roughness: 0.34 }),
    );
    mesh.position.set(fruit.x, fruit.y, fruit.z);
    root.add(mesh);
  }

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(2.45, 24, 18),
    new THREE.MeshBasicMaterial({ color: '#37cb91', transparent: true, opacity: 0.055 }),
  );
  glow.position.set(0, 0, -0.7);
  scene.add(glow);
}

function addAdminScene(root: THREE.Group) {
  const values = [0.72, 1.12, 0.92, 1.48, 1.02, 1.72, 1.26];
  const bars = new THREE.Group();
  root.add(bars);

  values.forEach((height, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: green[index % green.length],
      roughness: 0.38,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, height, 0.3), material);
    bar.position.set((index - 3) * 0.48, height / 2 - 0.9, 0);
    bar.userData.baseHeight = height;
    bar.userData.offset = index * 0.6;
    bars.add(bar);
  });

  const orbit = new THREE.Group();
  root.add(orbit);
  for (let index = 0; index < 4; index += 1) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + (index % 2) * 0.04, 16, 12),
      new THREE.MeshStandardMaterial({ color: green[index], emissive: green[index], emissiveIntensity: 0.2 }),
    );
    const angle = (Math.PI * 2 * index) / 4;
    dot.position.set(Math.cos(angle) * 1.9, Math.sin(angle) * 0.95, 0.5);
    orbit.add(dot);
  }
  return { bars, orbit };
}

export function MarketLinkScene({ kind, className = '' }: { kind: SceneKind; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 0, kind === 'farm' ? 8 : 7.5);
    const root = new THREE.Group();
    scene.add(root);
    scene.add(new THREE.HemisphereLight('#e8fff3', '#183c32', 2.1));
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.2);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight('#4ae0a0', 15, 12);
    fillLight.position.set(3, 1, 3);
    scene.add(fillLight);

    const adminParts = kind === 'admin' ? addAdminScene(root) : null;
    if (kind === 'farm') addFarmScene(scene, root);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setClearColor('#000000', 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.className = 'ml-three-canvas';
    host.appendChild(renderer.domElement);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true;
    let frame = 0;
    let previous = 0;
    const draw = (time: number) => {
      if (!visible) return;
      if (reduceMotion || time - previous > 32) {
        const seconds = time / 1000;
        root.rotation.y = reduceMotion ? -0.14 : Math.sin(seconds * 0.42) * 0.16 - 0.14;
        root.rotation.x = reduceMotion ? -0.04 : Math.sin(seconds * 0.55) * 0.045;
        root.position.y = reduceMotion ? 0 : Math.sin(seconds * 0.9) * 0.09;
        if (adminParts) {
          adminParts.bars.children.forEach((bar) => {
            const baseHeight = bar.userData.baseHeight as number;
            const offset = bar.userData.offset as number;
            const nextHeight = baseHeight * (0.96 + Math.sin(seconds * 1.35 + offset) * 0.04);
            bar.scale.y = nextHeight / baseHeight;
            bar.position.y = nextHeight / 2 - 0.9;
          });
          adminParts.orbit.rotation.z = reduceMotion ? 0.12 : seconds * 0.16;
        }
        renderer.render(scene, camera);
        previous = time;
      }
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      visible = entry.isIntersecting;
      if (visible) {
        if (reduceMotion) renderer.render(scene, camera);
        else {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(draw);
        }
      } else {
        cancelAnimationFrame(frame);
      }
    }, { threshold: 0.01 });
    observer.observe(host);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [kind]);

  return <div ref={hostRef} aria-hidden="true" className={`ml-three-scene ${className}`} />;
}
