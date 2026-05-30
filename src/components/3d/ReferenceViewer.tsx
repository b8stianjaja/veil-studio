import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { TransformControls, OrbitControls, Edges, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { StudioEngine } from '../../core/StudioEngine';
import { SceneNode } from '../../types';

let globalDragEnd = 0;
let globalIsDragging = false;

const EngineBridge = () => {
  const { scene, camera } = useThree();
  useEffect(() => {
    StudioEngine.getInstance().setThreeScene(scene, camera as THREE.PerspectiveCamera);
  }, [scene, camera]);
  return null;
};

// Replaces the old static handler with a robust dynamic Camera Rig
// Replaces the old static handler with a robust declarative Camera Rig
const CameraRig: React.FC = () => {
  const { camera: cameraState, cameraResetTick, cameraSaveTick, updateCamera } = useSceneStore();
  const { workspace, tool } = useCanvasStore();
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // 1. Explicit Restore Trigger (Ensures exact coordinates & projection properties)
  useEffect(() => {
    if (cameraResetTick > 0 && !cameraState.locked) {
      camera.position.set(cameraState.position[0], cameraState.position[1], cameraState.position[2]);
      
      // If we are in Isometric/Orthographic, we must restore the scale/zoom
      if (cameraState.type === 'ORTHOGRAPHIC') {
         (camera as THREE.OrthographicCamera).zoom = cameraState.zoom || 50;
         camera.updateProjectionMatrix();
      }

      if (controlsRef.current) {
        controlsRef.current.target.set(cameraState.target[0], cameraState.target[1], cameraState.target[2]);
        controlsRef.current.update();
      }
    }
  }, [cameraResetTick, cameraState.type]);

  // 2. High-Fidelity State Save
  useEffect(() => {
    if (cameraSaveTick > 0) {
      const pos: [number, number, number] = [
        camera.position.x, 
        camera.position.y, 
        camera.position.z
      ];
      
      let target: [number, number, number] = [0, 0, 0];
      if (controlsRef.current && controlsRef.current.target) {
        target = [
          controlsRef.current.target.x,
          controlsRef.current.target.y,
          controlsRef.current.target.z
        ];
      }
      
      // Capture the physical zoom level if Orthographic is active
      const currentZoom = (camera as any).zoom || 50;
      updateCamera({ position: pos, target, zoom: currentZoom });
    }
  }, [cameraSaveTick, updateCamera, camera]);

  const isOrbitTool = tool === 'ORBIT';

  return (
    <>
      {cameraState.type === 'PERSPECTIVE' ? (
        <PerspectiveCamera 
          makeDefault 
          position={cameraState.position}
          fov={cameraState.fov}
          near={cameraState.near}
          far={cameraState.far}
        />
      ) : (
        <OrthographicCamera 
          makeDefault 
          position={cameraState.position}
          zoom={cameraState.zoom || 50}
          near={cameraState.near}
          far={cameraState.far}
        />
      )}

      {workspace === 'MODELING' && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={cameraState.target}
          enabled={!cameraState.locked}
          enableRotate={isOrbitTool && !cameraState.locked}
          enablePan={isOrbitTool && !cameraState.locked}
          enableZoom={!cameraState.locked}
          enableDamping={true} 
          dampingFactor={0.08}
          rotateSpeed={0.8}
          panSpeed={0.8}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN 
          }}
        />
      )}
    </>
  );
};

const NodeMesh: React.FC<{ node: SceneNode }> = ({ node }) => {
  const { selectedNodeId, selectNode, updateNode, environment } = useSceneStore();
  const isSelected = selectedNodeId === node.id;
  const { workspace, tool } = useCanvasStore();
  
  const [meshTarget, setMeshTarget] = useState<THREE.Mesh | null>(null);
  const transformRef = useRef<any>(null);

  const showTransform = isSelected && workspace === 'MODELING' && ['SELECT', 'ROTATE', 'SCALE'].includes(tool);
  const transformMode = tool === 'ROTATE' ? 'rotate' : tool === 'SCALE' ? 'scale' : 'translate';

  useLayoutEffect(() => {
    if (meshTarget && !globalIsDragging) {
      meshTarget.position.set(node.position[0], node.position[1], node.position[2]);
      meshTarget.rotation.set(node.rotation[0], node.rotation[1], node.rotation[2]);
      meshTarget.scale.set(node.scale[0], node.scale[1], node.scale[2]);
    }
  }, [meshTarget, node.position, node.rotation, node.scale]);

  useEffect(() => {
    const controls = transformRef.current;
    if (controls) {
      const onDragChange = (e: any) => {
        const isDragging = e.value;
        globalIsDragging = isDragging;
        
        if (!isDragging) {
          globalDragEnd = Date.now();
          
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
  }, [meshTarget, node.id, updateNode, showTransform]); 

  if (node.visible === false) return null;

  return (
    <>
      <mesh
        ref={setMeshTarget} 
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
          object={meshTarget}
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
      {/* Removed the hardcoded camera fallback to enforce CameraRig usage */}
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        resize={{ offsetSize: true }}
        onPointerMissed={(e) => {
          if (e.type === 'click' && useCanvasStore.getState().workspace === 'MODELING') {
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
        
        <CameraRig />
      </Canvas>
    </div>
  );
};