import React, { useEffect, useState } from 'react';
import { Mapping } from '../types';

interface ConnectionsLayerProps {
  mappings: Mapping[];
  containerRef: React.RefObject<HTMLDivElement>;
  width: number;
  height: number;
  onDeleteMapping: (id: string) => void;
  tempConnection?: { startX: number; startY: number; endX: number; endY: number } | null;
  layoutVersion?: number; // Prop to force update on drag
}

const ConnectionsLayer: React.FC<ConnectionsLayerProps> = ({ 
  mappings, 
  containerRef, 
  width, 
  height,
  onDeleteMapping,
  tempConnection,
  layoutVersion
}) => {
  const [lines, setLines] = useState<{id: string, path: string}[]>([]);

  const calculatePaths = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: {id: string, path: string}[] = [];

    mappings.forEach(m => {
      const sourceEl = document.getElementById(`node-left-${m.sourcePath}`);
      const targetEl = document.getElementById(`node-right-${m.targetPath}`);

      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // Calculate relative coordinates within the SVG container
        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
        const x2 = targetRect.left - containerRect.left;
        const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

        // Bezier Curve
        const controlOffset = Math.abs(x2 - x1) / 2;
        const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
        
        newLines.push({ id: m.id, path: d });
      }
    });
    setLines(newLines);
  };

  useEffect(() => {
    // Recalculate initially and on mapping change or resize
    calculatePaths();

    // Use a faster interval for smoother updates during UI interactions
    const interval = setInterval(calculatePaths, 30); 
    
    window.addEventListener('resize', calculatePaths);
    return () => {
        clearInterval(interval);
        window.removeEventListener('resize', calculatePaths);
    };
  }, [mappings, width, height, layoutVersion]);

  return (
    <svg 
      className="absolute top-0 left-0 pointer-events-none z-10"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
        </defs>

      {lines.map((line) => (
        <g key={line.id} className="pointer-events-auto group">
          <path
            d={line.path}
            stroke="#cbd5e1"
            strokeWidth="3"
            fill="none"
            className="transition-colors group-hover:stroke-red-300"
          />
          <path
            d={line.path}
            stroke="#94a3b8"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead)"
            className="transition-colors group-hover:stroke-red-500 cursor-pointer"
            onClick={() => onDeleteMapping(line.id)}
          />
          {/* Invisible wide path for easier clicking */}
          <path
             d={line.path}
             stroke="transparent"
             strokeWidth="15"
             fill="none"
             className="cursor-pointer"
             onClick={() => onDeleteMapping(line.id)}
          >
             <title>Click to delete mapping</title>
          </path>
        </g>
      ))}

      {tempConnection && (
           <path
           d={`M ${tempConnection.startX} ${tempConnection.startY} C ${tempConnection.startX + 50} ${tempConnection.startY}, ${tempConnection.endX - 50} ${tempConnection.endY}, ${tempConnection.endX} ${tempConnection.endY}`}
           stroke="#3b82f6"
           strokeWidth="2"
           fill="none"
           strokeDasharray="5,5"
           markerEnd="url(#arrowhead)"
         />
      )}
    </svg>
  );
};

export default ConnectionsLayer;