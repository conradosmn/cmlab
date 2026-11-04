"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLATE_SIZE_MM, type PlatePiece } from "@/lib/lab/plateGeometry";

interface Props {
  pieces: PlatePiece[];
  baseColor: string;
  lineColor: string;
}

/** Mesa de 256 mm com as plaquinhas; arraste para girar, role para aproximar. */
export function Plate3DPreview({ pieces, baseColor, lineColor }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    group: THREE.Group;
  } | null>(null);

  // Cena criada uma vez.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
    camera.up.set(0, 0, 1);
    const half = PLATE_SIZE_MM / 2;
    camera.position.set(half, -half * 0.9, half * 1.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(half, half, 0);
    controls.enableDamping = true;
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(half * 0.4, -half, half * 2.5);
    scene.add(sun);

    // Mesa
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(PLATE_SIZE_MM, PLATE_SIZE_MM),
      new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.95 })
    );
    bed.position.set(half, half, -0.05);
    scene.add(bed);
    const grid = new THREE.GridHelper(PLATE_SIZE_MM, 16, 0xb9b09c, 0xd2cbbb);
    grid.rotation.x = Math.PI / 2;
    grid.position.set(half, half, 0);
    scene.add(grid);

    const group = new THREE.Group();
    scene.add(group);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    sceneRef.current = { renderer, scene, camera, controls, group };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Peças atualizadas a cada mudança. As geometrias pertencem a quem chama.
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const { group } = ctx;
    const baseMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.7 });
    const lineMat = new THREE.MeshStandardMaterial({ color: lineColor, roughness: 0.6 });
    for (const p of pieces) {
      const b = new THREE.Mesh(p.base, baseMat);
      const l = new THREE.Mesh(p.lines, lineMat);
      b.position.set(p.x, p.y, 0);
      l.position.set(p.x, p.y, 0);
      group.add(b, l);
    }
    return () => {
      group.clear();
      baseMat.dispose();
      lineMat.dispose();
    };
  }, [pieces, baseColor, lineColor]);

  return <div ref={mountRef} className="w-full h-full min-h-[420px] rounded-2xl overflow-hidden" />;
}
