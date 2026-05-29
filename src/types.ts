export type WorkspaceMode = 'MODELING' | 'PAINTING';

export type ToolType = 
  // Painting Suite
  | 'BRUSH' | 'ERASER' | 'PAN' | 'EYEDROPPER' | 'BUCKET' | 'SHAPE_LINE' | 'SHAPE_RECT' | 'SHAPE_CIRCLE' | 'SELECT_2D'
  // Modeling Suite
  | 'ORBIT' | 'SELECT' | 'ROTATE' | 'SCALE' | 'TRANSFORM_GIZMO' | 'CREATE_PRIMITIVE';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export interface SceneNode {
  id: string;
  type: 'CUBE' | 'SPHERE' | 'PLANE' | 'CYLINDER' | 'CONE';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  wireframe?: boolean;
  roughness?: number;
  metalness?: number;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface LightingConfig {
  intensity: number;
  color: string;
  angle: [number, number, number];
  ambientIntensity: number;
}

export interface EnvironmentConfig {
  gridVisible: boolean;
  gridSize: number;
  backgroundColor: string;
  axesVisible: boolean;
  snapToGrid?: boolean;
}

export interface LayerConfig {
  id: string;
  order: number;
  visible: boolean;
  opacity: number;
  buffer?: string;
  name: string;
  locked?: boolean;
  blendMode?: BlendMode;
  type?: 'LAYER' | 'FOLDER';
  parentId?: string | null;
  expanded?: boolean;
}

export interface VeilProject {
  metadata: {
    version: string;
    timestamp: string;
  };
  canvas: {
    width: number;
    height: number;
    backgroundColor?: string;
  };
  scene: {
    nodes: SceneNode[];
    lights: LightingConfig;
  };
  animation: {
    rows: number;
    columns: number;
    activeFrame: number;
  };
  layers: LayerConfig[];
}