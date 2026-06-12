'use client';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'>;

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
	const { theme } = useTheme();

	const containerRef = useRef<HTMLDivElement>(null);
	const sceneRef = useRef<{
		scene: THREE.Scene;
		camera: THREE.PerspectiveCamera;
		renderer: THREE.WebGLRenderer;
		particles: THREE.Points[];
		animationId: number;
		count: number;
	} | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const SEPARATION = 150;
		const AMOUNTX = 40;
		const AMOUNTY = 60;

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

		containerRef.current.appendChild(renderer.domElement);

		// Create particles
		const particles: THREE.Points[] = [];
		const positions: number[] = [];
		const colors: number[] = [];

		// Warm-to-cool palette (coral → magenta → indigo), normalized 0–1
		const PALETTE: [number, number, number][] = [
			[1.0, 0.45, 0.12],
			[1.0, 0.2, 0.62],
			[0.45, 0.38, 1.0],
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

		// Create geometry for all particles
		const geometry = new THREE.BufferGeometry();

		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
				const y = 0; // Will be animated
				const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

				positions.push(x, y, z);
				if (theme === 'dark') {
					colors.push(200, 200, 200);
				} else {
					const [r, g, b] = lerpPalette(
						(ix / (AMOUNTX - 1) + iy / (AMOUNTY - 1)) / 2,
					);
					colors.push(r, g, b);
				}
			}
		}

		geometry.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(positions, 3),
		);
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

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

		let count = 0;
		let animationId: number = 0;

		// Animation function
		const animate = () => {
			animationId = requestAnimationFrame(animate);

			const positionAttribute = geometry.attributes.position;
			const positions = positionAttribute.array as Float32Array;

			let i = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					const index = i * 3;

					// Animate Y position with sine waves
					positions[index + 1] =
						Math.sin((ix + count) * 0.3) * 50 +
						Math.sin((iy + count) * 0.5) * 50;

					i++;
				}
			}

			positionAttribute.needsUpdate = true;

			// Update point sizes based on wave
			const customMaterial = material as THREE.PointsMaterial & {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				uniforms?: any;
			};
			if (!customMaterial.uniforms) {
				// For dynamic size changes, we'd need a custom shader
				// For now, keeping constant size for performance
			}

			renderer.render(scene, camera);
			count += 0.1;
		};

		// Handle window resize
		const handleResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};

		window.addEventListener('resize', handleResize);

		// Start animation
		animate();

		// Store references
		sceneRef.current = {
			scene,
			camera,
			renderer,
			particles: [points],
			animationId,
			count,
		};

		// Cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);

			if (sceneRef.current) {
				cancelAnimationFrame(sceneRef.current.animationId);

				// Clean up Three.js objects
				sceneRef.current.scene.traverse((object) => {
					if (object instanceof THREE.Points) {
						object.geometry.dispose();
						if (Array.isArray(object.material)) {
							object.material.forEach((material) => material.dispose());
						} else {
							object.material.dispose();
						}
					}
				});

				circleTexture.dispose();
				sceneRef.current.renderer.dispose();

				if (containerRef.current && sceneRef.current.renderer.domElement) {
					containerRef.current.removeChild(
						sceneRef.current.renderer.domElement,
					);
				}
			}
		};
	}, [theme]);

	return (
		<div
			ref={containerRef}
			className={cn('pointer-events-none fixed inset-0 -z-1', className)}
			{...props}
		/>
	);
}
