import React, { useState, useRef, useEffect, useCallback } from 'react';
import JsonVisualizer from './components/JsonVisualizer';
import ConnectionsLayer from './components/ConnectionsLayer';
import { Mapping, Point, SavedSession } from './types';
import { getAutoMappings } from './services/geminiService';

// We use a global variable to access jsPDF because of the import style in html
declare const jspdf: any;
declare const html2canvas: any;

const DEFAULT_LEFT = {
  "user": {
    "id": 101,
    "firstName": "John",
    "lastName": "Doe",
    "contact": {
      "email": "john.doe@example.com",
      "phone": "+1-555-0199"
    }
  },
  "status": "active",
  "roles": ["admin", "editor"]
};

const DEFAULT_RIGHT = {
  "userId": "",
  "fullName": "",
  "emailAddress": "",
  "isActive": false,
  "permissions": []
};

const App: React.FC = () => {
  const [leftJsonStr, setLeftJsonStr] = useState(JSON.stringify(DEFAULT_LEFT, null, 2));
  const [rightJsonStr, setRightJsonStr] = useState(JSON.stringify(DEFAULT_RIGHT, null, 2));

  const [leftJson, setLeftJson] = useState<any>(DEFAULT_LEFT);
  const [rightJson, setRightJson] = useState<any>(DEFAULT_RIGHT);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [isExporting, setIsExporting] = useState(false);


  // View modes for panels
  const [leftViewMode, setLeftViewMode] = useState<'tree' | 'code'>('tree');
  const [rightViewMode, setRightViewMode] = useState<'tree' | 'code'>('tree');

  // Sidebar & Sessions
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // File Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layout & Resizing
  const [leftWidthPercent, setLeftWidthPercent] = useState(40);
  const [rightWidthPercent, setRightWidthPercent] = useState(40);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0); // Helper to force updates
  const [dataVersion, setDataVersion] = useState(0); // Helper to force remount of visualizers

  // Layout refs
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState<Point | null>(null);

  // Load sessions from local storage
  useEffect(() => {
    const saved = localStorage.getItem('json-mapper-sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSessions(parsed);
        }
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    }
  }, []);

  // Update JSON objects when strings change
  useEffect(() => {
    try {
      const l = JSON.parse(leftJsonStr);
      const r = JSON.parse(rightJsonStr);
      setLeftJson(l);
      setRightJson(r);
      setJsonError(null);
      // Force visualizers to update when data changes via text edit
      setDataVersion(v => v + 1);
    } catch (e) {
      // Silent fail while typing
    }
  }, [leftJsonStr, rightJsonStr]);

  // Handle Resize of window
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.offsetWidth,
          height: Math.max(containerRef.current.scrollHeight, containerRef.current.offsetHeight)
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();

    // Update when switching views or content changes
    const timeout = setTimeout(updateSize, 100);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timeout);
    };
  }, [leftJson, rightJson, mappings, leftViewMode, rightViewMode, leftWidthPercent, rightWidthPercent, isSidebarOpen]);

  // Handle Panel Resizing
  const handleMouseDownResize = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(side);
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;
    const totalWidth = containerRect.width;

    // Convert to percentage
    let newPercent = (relativeX / totalWidth) * 100;

    if (isResizing === 'left') {
      // Clamp left width (min 20%, max 70% considering right panel)
      newPercent = Math.max(20, Math.min(newPercent, 80 - rightWidthPercent));
      setLeftWidthPercent(newPercent);
    } else {
      // Dragging the right divider. 
      const rightEdgePercent = (relativeX / totalWidth) * 100;
      const newRightWidth = 100 - rightEdgePercent;

      // Clamp (min 20%, max space available)
      const clampedRight = Math.max(20, Math.min(newRightWidth, 80 - leftWidthPercent));
      setRightWidthPercent(clampedRight);
    }
    setLayoutVersion(v => v + 1);
  }, [isResizing, rightWidthPercent, leftWidthPercent]);

  const handleGlobalMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isResizing, handleGlobalMouseMove, handleGlobalMouseUp]);


  const handleNodeSelect = (path: string, side: 'left' | 'right') => {
    if (side === 'left') {
      // Start connection
      setSelectedSource(path);
    } else {
      // Complete connection if source is selected
      if (selectedSource) {
        const newMapping: Mapping = {
          id: `${selectedSource}-${path}-${Date.now()}`,
          sourcePath: selectedSource,
          targetPath: path
        };

        // Check duplicates
        if (!mappings.some(m => m.sourcePath === newMapping.sourcePath && m.targetPath === newMapping.targetPath)) {
          setMappings(prev => [...prev, newMapping]);
        }
        setSelectedSource(null);
      }
    }
  };

  const handleAutoMap = async () => {
    // Ensure we are in tree view to see results
    if (leftViewMode === 'code') setLeftViewMode('tree');
    if (rightViewMode === 'code') setRightViewMode('tree');

    setIsAutoMapping(true);
    try {
      const newMappings = await getAutoMappings(leftJson, rightJson);
      setMappings(prev => {
        const existingIds = new Set(prev.map(p => `${p.sourcePath}->${p.targetPath}`));
        const filteredNew = newMappings.filter(m => !existingIds.has(`${m.sourcePath}->${m.targetPath}`));
        return [...prev, ...filteredNew];
      });
    } catch (err) {
      alert("Auto-map failed. Please check your API Key configuration.");
    } finally {
      setIsAutoMapping(false);
    }
  };

  const handleDeleteMapping = (id: string) => {
    setMappings(prev => prev.filter(m => m.id !== id));
  };

  // --- SAVE / LOAD LOGIC ---
  const handleSaveSession = () => {
    const defaultName = `Mapping ${new Date().toLocaleTimeString()}`;
    const name = prompt("Enter a name for this session (saved to sidebar):", defaultName);

    if (name === null) return; // Cancelled
    const finalName = name.trim() || defaultName;

    const newSession: SavedSession = {
      id: Date.now().toString(),
      name: finalName,
      timestamp: Date.now(),
      leftJson,
      rightJson,
      mappings
    };

    // Save to Sidebar (LocalStorage)
    setSessions(prevSessions => {
      const updated = [newSession, ...prevSessions];
      try {
        localStorage.setItem('json-mapper-sessions', JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save to localStorage", e);
        alert("Warning: Could not save to local sidebar (quota might be exceeded).");
      }
      return updated;
    });

    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
    }
  };

  const handleExportJson = () => {
    const defaultName = `mapping-export-${Date.now()}`;
    const name = prompt("Enter filename for export:", defaultName);
    if (name === null) return;
    const finalName = name.trim() || defaultName;

    const exportData = {
      meta: "JSON Mapper Export",
      version: 1,
      timestamp: Date.now(),
      leftJson,
      rightJson,
      mappings
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Sanitize filename
    link.download = `${finalName.replace(/[^a-z0-9-_]/gi, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadSession = (session: SavedSession) => {
    if (window.confirm(`Load "${session.name}"? Unsaved changes will be lost.`)) {
      setLeftJson(session.leftJson);
      setLeftJsonStr(JSON.stringify(session.leftJson, null, 2));
      setRightJson(session.rightJson);
      setRightJsonStr(JSON.stringify(session.rightJson, null, 2));
      setMappings(session.mappings);

      setLeftViewMode('tree');
      setRightViewMode('tree');

      setDataVersion(v => v + 1); // Force remount
      setTimeout(() => setLayoutVersion(v => v + 1), 200);
    }
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this saved session?")) {
      setSessions(prevSessions => {
        const updated = prevSessions.filter(s => s.id !== id);
        localStorage.setItem('json-mapper-sessions', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // --- EXPORT / IMPORT FILE LOGIC ---
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Basic validation
        if (data.leftJson && data.rightJson) {
          if (window.confirm("Importing file will overwrite current workspace. Continue?")) {
            // 1. Update Objects Directly
            setLeftJson(data.leftJson);
            setRightJson(data.rightJson);

            // 2. Update Strings (Triggers useEffect, ensuring consistency)
            setLeftJsonStr(JSON.stringify(data.leftJson, null, 2));
            setRightJsonStr(JSON.stringify(data.rightJson, null, 2));

            // 3. Update Mappings (Default to empty if missing)
            setMappings(Array.isArray(data.mappings) ? data.mappings : []);

            // 4. Force Tree View
            setLeftViewMode('tree');
            setRightViewMode('tree');

            // 5. Force Visualizers to completely remount
            setDataVersion(v => v + 1);

            // 6. Schedule Layout Updates to draw lines after DOM is ready
            setTimeout(() => setLayoutVersion(v => v + 1), 100);
            setTimeout(() => setLayoutVersion(v => v + 1), 500);
          }
        } else {
          alert("Invalid file format: Missing 'leftJson' or 'rightJson'.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset so same file can be selected again
    event.target.value = '';
  };


  const handleExportPdf = async () => {
    if (!containerRef.current) return;

    setLeftViewMode('tree');
    setRightViewMode('tree');
    setIsExporting(true);

    try {
      await new Promise(r => setTimeout(r, 500));

      const element = containerRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pdf = new jspdf.jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imgWidth, imgHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save('mapping-diagram.pdf');
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (selectedSource && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, [selectedSource]);

  // Derived state for temp line
  let tempConnection = null;
  if (selectedSource && mousePos && containerRef.current && leftViewMode === 'tree') {
    const sourceEl = document.getElementById(`node-left-${selectedSource}`);
    if (sourceEl) {
      const rect = sourceEl.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      tempConnection = {
        startX: rect.right - containerRect.left,
        startY: rect.top + rect.height / 2 - containerRect.top,
        endX: mousePos.x,
        endY: mousePos.y
      };
    }
  }

  const leftMapped = new Set(mappings.map(m => m.sourcePath));
  const rightMapped = new Set(mappings.map(m => m.targetPath));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        className="hidden"
        accept=".json"
      />

      {/* Sidebar */}
      <div
        className={`flex-none bg-white flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64 border-r border-slate-200' : 'w-0 border-none overflow-hidden'
          }`}
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-700 whitespace-nowrap">Saved Sessions</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center text-slate-400 text-sm mt-10">No saved sessions</div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                onClick={() => handleLoadSession(s)}
                className="group p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-slate-700 truncate w-40 block" title={s.name}>{s.name}</span>
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(s.timestamp).toLocaleDateString()} • {s.mappings.length} links
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main App Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex-none h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="text-slate-500 hover:text-blue-600 mr-2 transition-colors"
                title="Open Saved Mappings"
              >
                <i className="fas fa-bars text-lg"></i>
              </button>
            )}
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              <i className="fas fa-project-diagram"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">JSON Mapper <span className="text-blue-600">AI</span></h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">

            <button
              onClick={handleTriggerImport}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              title="Import from file"
            >
              <i className="fas fa-file-upload"></i> <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={handleExportJson}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              title="Export to JSON file"
            >
              <i className="fas fa-file-download"></i> <span className="hidden sm:inline">Export</span>
            </button>

            <div className="h-6 w-px bg-slate-300 mx-1"></div>

            <button
              onClick={handleSaveSession}
              className="px-3 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
              title="Save to Saved Sessions Sidebar"
            >
              <i className="fas fa-save"></i> <span className="hidden sm:inline">Save</span>
            </button>

            <button
              onClick={() => setMappings([])}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Clear Links
            </button>

            <button
              onClick={handleAutoMap}
              disabled={isAutoMapping}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-md border border-purple-200 hover:bg-purple-100 transition-all font-medium disabled:opacity-50 text-sm ml-2"
            >
              {isAutoMapping ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
              <span className="hidden sm:inline">Auto Map</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md transition-all font-medium disabled:opacity-50 text-sm ml-2"
            >
              {isExporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-pdf"></i>}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">

          <div
            className="flex-1 relative overflow-auto bg-slate-50/50"
            onMouseMove={handleMouseMove}
            onClick={() => setSelectedSource(null)}
          >
            <div
              ref={containerRef}
              className="min-h-full w-full flex relative pb-32"
              style={{ minWidth: '800px' }} // prevent too much squishing
            >
              {/* SVG Layer */}
              <ConnectionsLayer
                mappings={mappings}
                containerRef={containerRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onDeleteMapping={handleDeleteMapping}
                tempConnection={tempConnection}
                layoutVersion={layoutVersion}
              />

              {/* Left Panel */}
              <div className="flex flex-col z-10 pl-8 pt-8" style={{ width: `${leftWidthPercent}%` }}>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 flex flex-col h-full min-h-[500px]">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center flex-none">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-700">Source Object</h2>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Input</span>
                    </div>
                    <button
                      onClick={() => setLeftViewMode(prev => prev === 'tree' ? 'code' : 'tree')}
                      className="text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <i className={`fas ${leftViewMode === 'tree' ? 'fa-code' : 'fa-sitemap'}`}></i>
                      {leftViewMode === 'tree' ? 'Edit JSON' : 'View Tree'}
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto bg-white relative">
                    {leftViewMode === 'tree' ? (
                      <div className="p-4">
                        <JsonVisualizer
                          key={`left-${dataVersion}`}
                          data={leftJson}
                          path=""
                          side="left"
                          onSelect={handleNodeSelect}
                          selectedPath={selectedSource}
                          mappedPaths={leftMapped}
                          collapsed={false}
                        />
                      </div>
                    ) : (
                      <textarea
                        className="w-full h-full p-4 font-mono text-xs resize-none focus:outline-none bg-green-50 text-slate-800"
                        value={leftJsonStr}
                        onChange={(e) => setLeftJsonStr(e.target.value)}
                        spellCheck={false}
                        placeholder="Paste Source JSON here..."
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Resizer Left */}
              <div
                className="w-4 hover:bg-blue-100 cursor-col-resize flex items-center justify-center group z-20"
                onMouseDown={handleMouseDownResize('left')}
              >
                <div className="w-1 h-8 bg-slate-300 rounded-full group-hover:bg-blue-400"></div>
              </div>

              {/* Middle Spacer (calculated by flex remaining) */}
              <div className="flex-1"></div>

              {/* Resizer Right */}
              <div
                className="w-4 hover:bg-blue-100 cursor-col-resize flex items-center justify-center group z-20"
                onMouseDown={handleMouseDownResize('right')}
              >
                <div className="w-1 h-8 bg-slate-300 rounded-full group-hover:bg-blue-400"></div>
              </div>

              {/* Right Panel */}
              <div className="flex flex-col z-10 pr-8 pt-8" style={{ width: `${rightWidthPercent}%` }}>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 flex flex-col h-full min-h-[500px]">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center flex-none">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-700">Target Object</h2>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Output</span>
                    </div>
                    <button
                      onClick={() => setRightViewMode(prev => prev === 'tree' ? 'code' : 'tree')}
                      className="text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <i className={`fas ${rightViewMode === 'tree' ? 'fa-code' : 'fa-sitemap'}`}></i>
                      {rightViewMode === 'tree' ? 'Edit JSON' : 'View Tree'}
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto bg-white relative">
                    {rightViewMode === 'tree' ? (
                      <div className="p-4">
                        <JsonVisualizer
                          key={`right-${dataVersion}`}
                          data={rightJson}
                          path=""
                          side="right"
                          onSelect={handleNodeSelect}
                          selectedPath={null}
                          mappedPaths={rightMapped}
                          collapsed={false}
                        />
                      </div>
                    ) : (
                      <textarea
                        className="w-full h-full p-4 font-mono text-xs resize-none focus:outline-none bg-green-50 text-slate-800"
                        value={rightJsonStr}
                        onChange={(e) => setRightJsonStr(e.target.value)}
                        spellCheck={false}
                        placeholder="Paste Target JSON here..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default App;