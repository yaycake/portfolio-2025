import { useRef } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Shader for the water effect
const WaterMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uAudioLevel: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uAudioLevel;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      
      // Create ripple effect
      float rippleStrength = uAudioLevel * 0.1;
      float rippleSpeed = 3.0;
      float rippleFreq = 6.0;
      
      // Multiple overlapping ripples
      float ripple1 = sin(length(uv - 0.5) * rippleFreq - uTime * rippleSpeed) * rippleStrength;
      float ripple2 = sin(length(uv - vec2(0.7, 0.3)) * rippleFreq - uTime * rippleSpeed) * rippleStrength;
      float ripple3 = sin(length(uv - vec2(0.3, 0.7)) * rippleFreq - uTime * rippleSpeed) * rippleStrength;
      
      // Combine ripples with decay based on audio level
      float decay = exp(-uAudioLevel * 2.0);
      float ripple = (ripple1 + ripple2 + ripple3) * decay;
      
      // Apply color with transparency
      vec3 color = vec3(0.1, 0.4, 1.0); // Base blue color
      float alpha = max(0.1, min(0.3, ripple + 0.1)); // Control transparency
      
      gl_FragColor = vec4(color, alpha);
    }
  `
};

extend({ WaterMaterial });

function WaterText({ audioLevel }) {
  const materialRef = useRef();
  const time = useRef(0);

  useFrame((state, delta) => {
    time.current += delta;
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time.current;
      materialRef.current.uniforms.uAudioLevel.value = audioLevel;
    }
  });

  return (
    <mesh position={[0, 0, -1]}>
      <planeGeometry args={[5, 5, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={WaterMaterial.uniforms}
        vertexShader={WaterMaterial.vertexShader}
        fragmentShader={WaterMaterial.fragmentShader}
        transparent={true}
        opacity={0.5}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export default WaterText; 