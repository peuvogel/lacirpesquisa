import { useDraggable } from '@dnd-kit/core';
import { MapGeoPath, type MapGeoPathProps } from './MapGeoPath';

export const UF_SHAPE_DRAG_PREFIX = 'uf-shape:';

export interface DraggableUfPathProps extends Omit<
  MapGeoPathProps,
  'pathRef' | 'dragListeners' | 'dragAttributes' | 'isDragging'
> {
  /** When true, the path shape itself is the drag source into group drop zones. */
  enableShapeDrag: boolean;
  /** All ungrouped selected siglas moved together when any selected shape is dragged. */
  dragSiglas: readonly string[];
}

export function DraggableUfPath({
  enableShapeDrag,
  dragSiglas,
  territoryId,
  ...pathProps
}: DraggableUfPathProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${UF_SHAPE_DRAG_PREFIX}${territoryId}`,
    disabled: !enableShapeDrag,
    data: {
      kind: 'uf-shapes' as const,
      siglas: dragSiglas.length > 0 ? [...dragSiglas] : [territoryId],
      primarySigla: territoryId,
    },
  });

  return (
    <MapGeoPath
      {...pathProps}
      territoryId={territoryId}
      pathRef={
        enableShapeDrag
          ? (node) => setNodeRef(node as unknown as HTMLElement | null)
          : undefined
      }
      dragListeners={enableShapeDrag ? listeners : undefined}
      dragAttributes={enableShapeDrag ? attributes : undefined}
      isDragging={isDragging}
    />
  );
}
