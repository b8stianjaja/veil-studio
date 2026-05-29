import { LayerConfig } from '../types';

export const getFlattenedRenderLayers = (layers: LayerConfig[]): (LayerConfig & { absoluteZIndex: number })[] => {
  let absoluteIndex = 0;
  
  const buildTree = (parentId: string | null): (LayerConfig & { absoluteZIndex: number })[] => {
    const children = layers.filter(l => l.parentId === parentId).sort((a, b) => a.order - b.order);
    let result: (LayerConfig & { absoluteZIndex: number })[] = [];
    
    for (const child of children) {
      if (child.type === 'FOLDER') {
        result = [...result, ...buildTree(child.id)];
      } else {
        result.push({ ...child, absoluteZIndex: absoluteIndex++ });
      }
    }
    
    return result;
  };

  return buildTree(null);
};
