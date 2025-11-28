import React, { useState } from 'react';
import { JsonNodeProps } from '../types';

const JsonVisualizer: React.FC<JsonNodeProps> = ({ data, path, side, onSelect, selectedPath, mappedPaths, collapsed = false }) => {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleClick = (e: React.MouseEvent, currentPath: string) => {
    e.stopPropagation();
    onSelect(currentPath, side);
  };

  const isObject = (val: any) => typeof val === 'object' && val !== null && !Array.isArray(val);
  const isArray = (val: any) => Array.isArray(val);

  if (isObject(data)) {
    return (
      <div className="ml-4 font-mono text-sm">
        <div 
          className="flex items-center hover:bg-slate-100 rounded px-1 cursor-pointer select-none"
          onClick={handleToggle}
        >
          <span className="w-4 text-slate-400 text-xs mr-1">
            <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
          </span>
          <span className="text-purple-600 font-semibold">{path.split('.').pop() || 'Root'}</span>
          <span className="text-slate-400 ml-2 text-xs">{'{ }'}</span>
        </div>
        {isExpanded && (
          <div className="border-l border-slate-200 ml-2 pl-2">
            {Object.keys(data).map((key) => (
              <JsonVisualizer
                key={key}
                data={data[key]}
                path={path ? `${path}.${key}` : key}
                side={side}
                onSelect={onSelect}
                selectedPath={selectedPath}
                mappedPaths={mappedPaths}
                collapsed={collapsed}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isArray(data)) {
    return (
      <div className="ml-4 font-mono text-sm">
        <div 
           className="flex items-center hover:bg-slate-100 rounded px-1 cursor-pointer select-none"
           onClick={handleToggle}
        >
          <span className="w-4 text-slate-400 text-xs mr-1">
            <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
          </span>
          <span className="text-orange-600 font-semibold">{path.split('.').pop()}</span>
          <span className="text-slate-400 ml-2 text-xs">[{data.length}]</span>
        </div>
        {isExpanded && (
           <div className="border-l border-slate-200 ml-2 pl-2">
             {data.map((item: any, index: number) => (
               <JsonVisualizer
                 key={index}
                 data={item}
                 path={`${path}[${index}]`}
                 side={side}
                 onSelect={onSelect}
                 selectedPath={selectedPath}
                 mappedPaths={mappedPaths}
                 collapsed={false} // Always expand array items by default now
               />
             ))}
           </div>
        )}
      </div>
    );
  }

  // Primitive value (Leaf Node)
  const isSelected = selectedPath === path;
  const isMapped = mappedPaths.has(path);
  const nodeKey = path.split('.').pop();
  
  // Clean ID for DOM queries
  const domId = `node-${side}-${path}`;

  return (
    <div 
      id={domId}
      className={`ml-6 flex items-center justify-between px-2 py-1 my-0.5 rounded border transition-colors duration-200 cursor-pointer text-sm font-mono
        ${isSelected ? 'bg-blue-100 border-blue-500 shadow-sm' : 'bg-white border-transparent hover:border-slate-300'}
        ${isMapped && !isSelected ? 'bg-green-50 border-green-200' : ''}
      `}
      onClick={(e) => handleClick(e, path)}
      data-path={path}
    >
      <div className="flex items-center overflow-hidden">
        <span className="text-slate-700 mr-2 font-medium">{nodeKey}</span>
        <span className="text-slate-400 text-xs truncate max-w-[100px]">{String(data)}</span>
      </div>
      {/* Anchor Point Indicator */}
      <div className={`w-2 h-2 rounded-full ${isMapped ? 'bg-green-500' : 'bg-slate-300'} ${isSelected ? 'bg-blue-600' : ''}`}></div>
    </div>
  );
};

export default JsonVisualizer;