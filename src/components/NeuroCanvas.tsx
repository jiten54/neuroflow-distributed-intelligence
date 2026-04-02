import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Text, Float, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';

const NodeMesh = ({ node }: { node: any }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const color = useMemo(() => {
    if (node.status === 'failed') return '#ef4444';
    if (node.status === 'busy') return '#3b82f6';
    return '#10b981';
  }, [node.status]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime + node.position[0]) * 0.2;
    }
  });

  return (
    <group position={node.position}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Sphere ref={meshRef} args={[0.5, 32, 32]}>
          <MeshDistortMaterial
            color={color}
            speed={node.load * 5}
            distort={node.load * 0.5}
            radius={1}
          />
        </Sphere>
      </Float>
      <Text
        position={[0, -1, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {node.id}
      </Text>
      <Text
        position={[0, -1.4, 0]}
        fontSize={0.2}
        color="#9ca3af"
        anchorX="center"
        anchorY="middle"
      >
        {Math.round(node.load * 100)}% Load
      </Text>
    </group>
  );
};

const Connections = () => {
  const nodes = useStore((state) => state.nodes);
  
  return (
    <group>
      {nodes.map((node, i) => (
        <Line
          key={`line-${i}`}
          points={[[0, 0, 0], node.position]}
          color="#374151"
          lineWidth={1}
          transparent
          opacity={0.3}
        />
      ))}
    </group>
  );
};

export const NeuroCanvas = () => {
  const nodes = useStore((state) => state.nodes);

  return (
    <div className="w-full h-full bg-slate-950">
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} />
        
        <OrbitControls enablePan={false} maxDistance={25} minDistance={5} />
        
        <group>
          {/* Central Coordinator */}
          <Sphere args={[0.8, 32, 32]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
          </Sphere>
          <Text position={[0, 1.2, 0]} fontSize={0.4} color="white">COORDINATOR</Text>
          
          <Connections />
          
          {nodes.map((node) => (
            <NodeMesh key={node.id} node={node} />
          ))}
        </group>
      </Canvas>
    </div>
  );
};
