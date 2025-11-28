import React from 'react';

export interface Mapping {
  id: string;
  sourcePath: string;
  targetPath: string;
}

export interface JsonNodeProps {
  data: any;
  path: string;
  side: 'left' | 'right';
  onSelect: (path: string, side: 'left' | 'right', event?: React.MouseEvent) => void;
  selectedPath: string | null;
  mappedPaths: Set<string>; // Paths that are already part of a connection
  collapsed?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface SavedSession {
  id: string;
  name: string;
  timestamp: number;
  leftJson: any;
  rightJson: any;
  mappings: Mapping[];
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  SELECTING_SOURCE = 'SELECTING_SOURCE',
  SELECTING_TARGET = 'SELECTING_TARGET',
}