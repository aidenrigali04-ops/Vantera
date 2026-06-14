'use client';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'> & {
	/** Force the particle colouring regardless of the active app theme. */
	colorTheme?: 'light' | 'dark';
	/** Contain to the nearest positioned ancestor (absolute) instead of the
	 *  viewport (fixed) — used to scope the field to a single section. */
	contained?: boolean;
};

const SEPARATION = 150;
const AMOUNTX = 40;
const AMOUNTY = 60;

type SharedScene = {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	geometry: THREE.BufferGeometry;
	count: number;
};

// Browsers cap active WebGL contexts (~8-16) and a per-mount renderer leaks
// one per client navigation until the browser evicts them ("too many active
// WebGL contexts" console errors). The background lives on every page, so one
// app-lifetime renderer is created lazily and re-attached on each mount.
let shared: SharedScene | null = null;

function createShared(): SharedScene {
	// Scene setup
	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0xffffff, 6000, 10000);

	const camera = new THREE.PerspectiveCamera(
		60,
		window.innerWidth / window.innerHeight,
		1,
		10000,
	);
	camera.position.set(0, 355, 1220);

	const renderer = new THREE.WebGLRenderer({
		alpha: true,
		antialias: true,
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(scene.fog.color, 0);

	// Create geometry for all particles
	const geometry = new THREE.BufferGeometry();
	const positions: number[] = [];

	for (let ix = 0; ix < AMOUNTX; ix++) {
		for (let iy = 0; iy < AMOUNTY; iy++) {
			const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
			const y = 0; // Will be animated
			const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

			positions.push(x, y, z);
		}
	}

	geometry.setAttribute(
		'position',
		new THREE.Float32BufferAttribute(positions, 3),
	);

	// Round sprite with a solid core and soft falloff so points render
	// as gently glowing circles instead of squares
	const spriteCanvas = document.createElement('canvas');
	spriteCanvas.width = 64;
	spriteCanvas.height = 64;
	const spriteCtx = spriteCanvas.getContext('2d')!;
	const glow = spriteCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
	glow.addColorStop(0, 'rgba(255,255,255,1)');
	glow.addColorStop(0.45, 'rgba(255,255,255,0.95)');
	glow.addColorStop(0.7, 'rgba(255,255,255,0.35)');
	glow.addColorStop(1, 'rgba(255,255,255,0)');
	spriteCtx.fillStyle = glow;
	spriteCtx.fillRect(0, 0, 64, 64);
	const circleTexture = new THREE.CanvasTexture(spriteCanvas);

	// Create material
	const material = new THREE.PointsMaterial({
		size: 20,
		vertexColors: true,
		transparent: true,
		opacity: 1,
		sizeAttenuation: true,
		map: circleTexture,
		depthWrite: false,
	});

	// Create points object
	const points = new THREE.Points(geometry, material);
	scene.add(points);

	return { scene, camera, renderer, geometry, count: 0 };
}

function applyThemeColors(geometry: THREE.BufferGeometry, theme?: string) {
	const colors: number[] = [];

	// Warm sunset palette from the brand gradient (yellow → orange → red), normalized 0–1
	const PALETTE: [number, number, number][] = [
		[1.0, 0.8, 0.1],
		[1.0, 0.45, 0.05],
		[0.92, 0.16, 0.11],
	];
	const lerpPalette = (t: number): [number, number, number] => {
		const scaled = t * (PALETTE.length - 1);
		const i = Math.min(Math.floor(scaled), PALETTE.length - 2);
		const f = scaled - i;
		return [
			PALETTE[i][0] + (PALETTE[i + 1][0] - PALETTE[i][0]) * f,
			PALETTE[i][1] + (PALETTE[i + 1][1] - PALETTE[i][1]) * f,
			PALETTE[i][2] + (PALETTE[i + 1][2] - PALETTE[i][2]) * f,
		];
	};

	for (let ix = 0; ix < AMOUNTX; ix++) {
		for (let iy = 0; iy < AMOUNTY; iy++) {
			if (theme === 'dark') {
				colors.push(200, 200, 200);
			} else {
				// Compress the gradient into the camera's visible band so all
				// three palette stops actually show on screen
				const tx = ix / (AMOUNTX - 1);
				const t = Math.min(1, Math.max(0, (tx - 0.25) * 2));
				const [r, g, b] = lerpPalette(t);
				colors.push(r, g, b);
			}
		}
	}

	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

export function DottedSurface({ className, colorTheme, contained = false, ...props }: DottedSurfaceProps) {
	const { theme } = useTheme();
	const activeTheme = colorTheme ?? theme;

	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) return;
		if (!shared) shared = createShared();
		const s = shared;

		applyThemeColors(s.geometry, activeTheme);

		// Handle window resize (also restores size if it changed while detached)
		const handleResize = () => {
			s.camera.aspect = window.innerWidth / window.innerHeight;
			s.camera.updateProjectionMatrix();
			s.renderer.setSize(window.innerWidth, window.innerHeight);
		};
		handleResize();
		window.addEventListener('resize', handleResize);

		const container = containerRef.current;
		container.replaceChildren(s.renderer.domElement);

		let animationId = 0;

		// Animation function
		const animate = () => {
			animationId = requestAnimationFrame(animate);

			const positionAttribute = s.geometry.attributes.position;
			const positions = positionAttribute.array as Float32Array;

			let i = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					const index = i * 3;

					// Animate Y position with sine waves
					positions[index + 1] =
						Math.sin((ix + s.count) * 0.3) * 50 +
						Math.sin((iy + s.count) * 0.5) * 50;

					i++;
				}
			}

			positionAttribute.needsUpdate = true;

			s.renderer.render(s.scene, s.camera);
			s.count += 0.1;
		};

		// Start animation
		animate();

		// Cleanup: stop this mount's loop and detach the shared canvas —
		// never dispose the renderer; it is reused by the next mount
		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener('resize', handleResize);
			if (s.renderer.domElement.parentElement === container) {
				s.renderer.domElement.remove();
			}
		};
	}, [activeTheme]);

	return (
		<div
			ref={containerRef}
			className={cn(
				contained
					? 'pointer-events-none absolute inset-0'
					: 'pointer-events-none fixed inset-0 -z-1',
				className,
			)}
			{...props}
		/>
	);
}
