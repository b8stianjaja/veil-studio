import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { TransformControls, OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { StudioEngine } from '../../core/StudioEngine';
import { SceneNode } from '../../types';

// Global variables outside the component tree to guarantee survival across React renders
let globalDragEnd = 0;
let globalIsDragging = false;

// Bridge to connect R3F context with our vanilla StudioEngine
const EngineBridge = () => {
  const { scene, camera } = useThree();
  useEffect(() => {
    StudioEngine.getInstance().setThreeScene(scene, camera as THREE.PerspectiveCamera);
  }, [scene, camera]);
  return null;
};

const OrbitAndCameraHandler: React.FC = () => {
  const { camera } = useThree();
  const resetTick = useSceneStore(state => state.cameraResetTick);
  const { workspace, tool } = useCanvasStore();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (resetTick > 0) {
      if (controlsRef.current) {
        controlsRef.current.reset();
      }
      camera.position.set(5, 5, 5);
      camera.lookAt(0, 0, 0);
      
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [resetTick, camera]);

  return workspace === 'MODELING' ? (
    <OrbitControls 
      ref={controlsRef} 
      makeDefault 
      enableRotate={tool === 'ORBIT'}
      enablePan={tool === 'ORBIT'}
      enableZoom={true}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE
      }}
    />
  ) : null;
};

const NodeMesh: React.FC<{ node: SceneNode }> = ({ node }) => {
  const { selectedNodeId, selectNode, updateNode, environment } = useSceneStore();
  const isSelected = selectedNodeId === node.id;
  const { workspace, tool } = useCanvasStore();
  
  // CRITICAL FIX 1: Use state for the mesh target to guarantee TransformControls binds correctly
  const [meshTarget, setMeshTarget] = useState<THREE.Mesh | null>(null);
  const transformRef = useRef<any>(null);

  const showTransform = isSelected && workspace === 'MODELING' && ['SELECT', 'ROTATE', 'SCALE'].includes(tool);
  const transformMode = tool === 'ROTATE' ? 'rotate' : tool === 'SCALE' ? 'scale' : 'translate';

  // CRITICAL FIX 2: Layout effect ensures the UI strictly matches the store ONLY when we aren't dragging
  useLayoutEffect(() => {
    if (meshTarget && !globalIsDragging) {
      meshTarget.position.set(node.position[0], node.position[1], node.position[2]);
      meshTarget.rotation.set(node.rotation[0], node.rotation[1], node.rotation[2]);
      meshTarget.scale.set(node.scale[0], node.scale[1], node.scale[2]);
    }
  }, [meshTarget, node.position, node.rotation, node.scale]);

  // CRITICAL FIX 3: Bind to the native Three.js event, not React's synthetic mouse events
  useEffect(() => {
    const controls = transformRef.current;
    if (controls) {
      const onDragChange = (e: any) => {
        const isDragging = e.value;
        globalIsDragging = isDragging;
        
        if (!isDragging) {
          globalDragEnd = Date.now(); // Record exactly when drag stopped
          
          if (meshTarget) {
            const p = meshTarget.position;
            const r = meshTarget.rotation;
            const s = meshTarget.scale;
            updateNode(node.id, {
              position: [p.x, p.y, p.z],
              rotation: [r.x, r.y, r.z],
              scale: [s.x, s.y, s.z]
            });
          }
        }
      };
      
      controls.addEventListener('dragging-changed', onDragChange);
      return () => controls.removeEventListener('dragging-changed', onDragChange);
    }
  }, [meshTarget, node.id, updateNode, showTransform]); // Re-bind if tools switch

  if (node.visible === false) return null;

  return (
    <>
      <mesh
        ref={setMeshTarget} // Populates state instantly once ThreeJS creates the mesh
        castShadow={node.castShadow ?? true}
        receiveShadow={node.receiveShadow ?? true}
        onClick={(e) => {
          e.stopPropagation();
          if (workspace === 'MODELING') selectNode(node.id);
        }}
      >
        {node.type === 'CUBE' && <boxGeometry />}
        {node.type === 'SPHERE' && <sphereGeometry args={[0.5, 32, 32]} />}
        {node.type === 'PLANE' && <planeGeometry args={[1, 1]} />}
        {node.type === 'CYLINDER' && <cylinderGeometry args={[0.5, 0.5, 1, 32]} />}
        {node.type === 'CONE' && <coneGeometry args={[0.5, 1, 32]} />}
        <meshStandardMaterial 
          color={node.color} 
          wireframe={node.wireframe}
          roughness={node.roughness ?? 0.5}
          metalness={node.metalness ?? 0.1}
          transparent={true}
          opacity={isSelected && workspace === 'MODELING' ? 0.8 : 1.0}
        />
        {isSelected && workspace === 'MODELING' && (
          <Edges scale={1.05} threshold={15} color="#4488FF" />
        )}
      </mesh>
      
      {showTransform && meshTarget && (
        <TransformControls 
          ref={transformRef}
          object={meshTarget} // Guaranteed to be a valid mesh now
          mode={transformMode}
          size={0.6}
          translationSnap={environment?.snapToGrid ? 1 : null}
          rotationSnap={environment?.snapToGrid ? Math.PI / 8 : null}
          scaleSnap={environment?.snapToGrid ? 0.5 : null}
        />
      )}
    </>
  );
};

export const ReferenceViewer: React.FC = () => {
  const { nodes, lights, environment } = useSceneStore();
  const { workspace } = useCanvasStore();

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        resize={{ offsetSize: true }}
        onPointerMissed={(e) => {
          if (e.type === 'click' && useCanvasStore.getState().workspace === 'MODELING') {
            // CRITICAL FIX 4: Ignore the "miss" if it happened within 250ms of letting go of a gizmo handle
            if (!globalIsDragging && Date.now() - globalDragEnd > 250) {
              useSceneStore.getState().selectNode(null);
            }
          }
        }}
      >
        <EngineBridge />
        <ambientLight intensity={lights.ambientIntensity ?? lights.intensity} color={lights.color} />
        <directionalLight 
          position={lights.angle as [number, number, number]} 
          intensity={lights.intensity} 
          castShadow 
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        
        {nodes.map(node => (
          <NodeMesh key={node.id} node={node} />
        ))}
        
        {environment?.gridVisible && <gridHelper args={[environment.gridSize, environment.gridSize]} />}
        {environment?.axesVisible && <axesHelper args={[environment.gridSize / 2]} />}
        
        <OrbitAndCameraHandler />
      </Canvas>
    </div>
  );
};