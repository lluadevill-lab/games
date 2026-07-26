import React, { useState, useRef } from 'react';
import { Play, Plus, Trash2, Check, ArrowLeft, Download, Upload, Target, ShieldAlert, Star, Zap } from 'lucide-react';
import { LevelData, AnchorNode, Obstacle, Collectible } from '../types/game';
import { soundManager } from '../utils/sound';

interface LevelEditorProps {
  onClose: () => void;
  onTestLevel: (level: LevelData) => void;
  onSaveCommunityLevel: (level: LevelData) => void;
}

type ToolType = 'start' | 'goal' | 'node-normal' | 'node-fragile' | 'node-moving' | 'wall' | 'sawblade' | 'laser' | 'star' | 'eraser';

export const LevelEditor: React.FC<LevelEditorProps> = ({
  onClose,
  onTestLevel,
  onSaveCommunityLevel
}) => {
  const [title, setTitle] = useState<string>('Meu Percurso Customizado');
  const [selectedTool, setSelectedTool] = useState<ToolType>('node-normal');
  const [copied, setCopied] = useState<boolean>(false);
  const [importJson, setImportJson] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Level draft state
  const [startX, setStartX] = useState<number>(150);
  const [startY, setStartY] = useState<number>(350);
  const [goalX, setGoalX] = useState<number>(1150);
  const [goalY, setGoalY] = useState<number>(350);
  const [nodes, setNodes] = useState<AnchorNode[]>([
    { id: 'node_1', x: 450, y: 200, radius: 16, type: 'normal' },
    { id: 'node_2', x: 800, y: 200, radius: 16, type: 'normal' }
  ]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([
    { id: 'wall_bottom', type: 'wall', x: 0, y: 650, width: 1300, height: 50 },
    { id: 'wall_top', type: 'wall', x: 0, y: 0, width: 1300, height: 50 }
  ]);
  const [collectibles, setCollectibles] = useState<Collectible[]>([
    { id: 'star_1', type: 'star', x: 625, y: 350, radius: 18 }
  ]);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1300 / rect.width;
    const scaleY = 700 / rect.height;
    const x = Math.round(((e.clientX - rect.left) * scaleX) / 25) * 25; // snap to 25px grid
    const y = Math.round(((e.clientY - rect.top) * scaleY) / 25) * 25;

    soundManager.playClick();

    if (selectedTool === 'start') {
      setStartX(x);
      setStartY(y);
    } else if (selectedTool === 'goal') {
      setGoalX(x);
      setGoalY(y);
    } else if (selectedTool === 'node-normal') {
      setNodes(prev => [...prev, { id: `node_${Date.now()}`, x, y, radius: 16, type: 'normal' }]);
    } else if (selectedTool === 'node-fragile') {
      setNodes(prev => [...prev, { id: `node_${Date.now()}`, x, y, radius: 16, type: 'fragile', maxTimer: 1.5 }]);
    } else if (selectedTool === 'node-moving') {
      setNodes(prev => [
        ...prev,
        {
          id: `node_${Date.now()}`,
          x,
          y,
          radius: 16,
          type: 'moving',
          movePath: [{ x: x - 100, y }, { x: x + 100, y }],
          moveSpeed: 130
        }
      ]);
    } else if (selectedTool === 'wall') {
      setObstacles(prev => [...prev, { id: `obs_${Date.now()}`, type: 'wall', x: x - 60, y: y - 15, width: 120, height: 30 }]);
    } else if (selectedTool === 'sawblade') {
      setObstacles(prev => [...prev, { id: `obs_${Date.now()}`, type: 'sawblade', x, y, radius: 45 }]);
    } else if (selectedTool === 'laser') {
      setObstacles(prev => [...prev, { id: `obs_${Date.now()}`, type: 'laser', x: x - 100, y, endX: x + 100, endY: y }]);
    } else if (selectedTool === 'star') {
      setCollectibles(prev => [...prev, { id: `col_${Date.now()}`, type: 'star', x, y, radius: 18 }]);
    } else if (selectedTool === 'eraser') {
      // Find and remove clicked element within 40px
      setNodes(prev => prev.filter(n => Math.hypot(n.x - x, n.y - y) > 40));
      setObstacles(prev => prev.filter(o => Math.hypot(o.x - x, o.y - y) > 45));
      setCollectibles(prev => prev.filter(c => Math.hypot(c.x - x, c.y - y) > 35));
    }
  };

  const getCurrentLevelData = (): LevelData => ({
    id: Math.floor(Math.random() * 900) + 100,
    title: title.trim() || 'Percurso Customizado',
    world: 4,
    description: 'Criado com o Editor de Níveis Corda Elástica!',
    startX,
    startY,
    goalX,
    goalY,
    goalRadius: 40,
    bounds: { width: 1300, height: 700 },
    nodes,
    obstacles,
    collectibles,
    targetTime: 10
  });

  const handleTest = () => {
    soundManager.playWin();
    const lvl = getCurrentLevelData();
    onSaveCommunityLevel(lvl);
    onTestLevel(lvl);
  };

  const handleExport = () => {
    soundManager.playClick();
    const json = JSON.stringify(getCurrentLevelData(), null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson) as LevelData;
      if (parsed.startX && parsed.goalX && Array.isArray(parsed.nodes)) {
        setTitle(parsed.title || 'Nível Importado');
        setStartX(parsed.startX);
        setStartY(parsed.startY);
        setGoalX(parsed.goalX);
        setGoalY(parsed.goalY);
        setNodes(parsed.nodes || []);
        setObstacles(parsed.obstacles || []);
        setCollectibles(parsed.collectibles || []);
        setShowImportModal(false);
        soundManager.playWin();
      } else {
        alert('Formato de JSON inválido para o nível!');
      }
    } catch {
      alert('Erro ao decodificar JSON. Verifique o código!');
    }
  };

  const tools: { id: ToolType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'node-normal', label: 'Gancho Normal', icon: <Target className="w-4 h-4" />, color: 'bg-cyan-600 text-white' },
    { id: 'node-fragile', label: 'Gancho Frágil', icon: <Target className="w-4 h-4 text-orange-400" />, color: 'bg-orange-600/30 text-orange-300 border-orange-500' },
    { id: 'node-moving', label: 'Gancho Móvel', icon: <Target className="w-4 h-4 text-purple-400" />, color: 'bg-purple-600/30 text-purple-300 border-purple-500' },
    { id: 'star', label: 'Estrela ★', icon: <Star className="w-4 h-4 text-amber-400" />, color: 'bg-amber-500/20 text-amber-300 border-amber-500' },
    { id: 'sawblade', label: 'Serra Giratória', icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, color: 'bg-rose-600/30 text-rose-300 border-rose-500' },
    { id: 'laser', label: 'Feixe Laser', icon: <Zap className="w-4 h-4 text-pink-400" />, color: 'bg-pink-600/30 text-pink-300 border-pink-500' },
    { id: 'wall', label: 'Parede/Plataforma', icon: <Plus className="w-4 h-4 text-blue-400" />, color: 'bg-blue-600/30 text-blue-300 border-blue-500' },
    { id: 'start', label: 'Início (Verde)', icon: <Play className="w-4 h-4 text-emerald-400" />, color: 'bg-emerald-600/30 text-emerald-300 border-emerald-500' },
    { id: 'goal', label: 'Portal Saída (Ouro)', icon: <Target className="w-4 h-4 text-yellow-300" />, color: 'bg-yellow-600/30 text-yellow-200 border-yellow-500' },
    { id: 'eraser', label: 'Borracha / Apagar', icon: <Trash2 className="w-4 h-4 text-red-400" />, color: 'bg-red-600/20 text-red-400 border-red-500' }
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-950 p-3 md:p-6 overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { soundManager.playClick(); onClose(); }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-sm font-semibold border border-slate-700 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Voltar</span>
          </button>
          
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do Nível"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-orbitron font-bold text-base md:text-lg focus:outline-none focus:border-cyan-500 transition-colors w-60 md:w-80"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { soundManager.playClick(); setShowImportModal(true); }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Importar JSON</span>
          </button>

          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4 text-cyan-400" />}
            <span className="hidden sm:inline">{copied ? 'JSON Copiado!' : 'Copiar JSON'}</span>
          </button>

          <button
            onClick={handleTest}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-orbitron font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>TESTAR JOGAR</span>
          </button>
        </div>
      </div>

      {/* Tools Palette Bar */}
      <div className="py-3 flex items-center gap-2 overflow-x-auto border-b border-slate-800/80">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-2">
          🛠️ Ferramentas:
        </span>
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => { soundManager.playClick(); setSelectedTool(tool.id); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border ${
              selectedTool === tool.id
                ? `${tool.color} scale-105 shadow-md ring-2 ring-white/20`
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {tool.icon}
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Grid Canvas Interactive Area */}
      <div className="flex-1 flex items-center justify-center pt-4 overflow-hidden">
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="relative w-full max-w-6xl aspect-[13/7] bg-slate-900 rounded-3xl border-2 border-dashed border-slate-800 cursor-crosshair overflow-hidden shadow-inner"
          style={{
            backgroundImage: 'radial-gradient(rgba(99, 102, 241, 0.15) 1px, transparent 1px)',
            backgroundSize: '25px 25px'
          }}
        >
          {/* Render Start Point */}
          <div
            className="absolute w-8 h-8 rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 font-bold text-xs -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-lg shadow-emerald-500/30"
            style={{ left: `${(startX / 1300) * 100}%`, top: `${(startY / 700) * 100}%` }}
          >
            IN
          </div>

          {/* Render Goal Point */}
          <div
            className="absolute w-12 h-12 rounded-full bg-yellow-500/30 border-2 border-yellow-400 flex items-center justify-center text-yellow-300 font-bold text-xs -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse shadow-lg shadow-yellow-500/30"
            style={{ left: `${(goalX / 1300) * 100}%`, top: `${(goalY / 700) * 100}%` }}
          >
            FIM
          </div>

          {/* Render Nodes */}
          {nodes.map(n => {
            let col = 'bg-cyan-500/40 border-cyan-400';
            if (n.type === 'fragile') col = 'bg-orange-500/40 border-orange-400';
            if (n.type === 'moving') col = 'bg-purple-500/40 border-purple-400';

            return (
              <div
                key={n.id}
                className={`absolute w-8 h-8 rounded-full border-2 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none ${col}`}
                style={{ left: `${(n.x / 1300) * 100}%`, top: `${(n.y / 700) * 100}%` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              </div>
            );
          })}

          {/* Render Obstacles */}
          {obstacles.map(obs => {
            if (obs.type === 'wall') {
              return (
                <div
                  key={obs.id}
                  className="absolute bg-blue-900/60 border border-blue-400 pointer-events-none"
                  style={{
                    left: `${((obs.x || 0) / 1300) * 100}%`,
                    top: `${((obs.y || 0) / 700) * 100}%`,
                    width: `${((obs.width || 100) / 1300) * 100}%`,
                    height: `${((obs.height || 30) / 700) * 100}%`
                  }}
                />
              );
            } else if (obs.type === 'sawblade') {
              return (
                <div
                  key={obs.id}
                  className="absolute w-12 h-12 rounded-full bg-rose-600/40 border-2 border-rose-500 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-spin"
                  style={{ left: `${(obs.x / 1300) * 100}%`, top: `${(obs.y / 700) * 100}%` }}
                >
                  ⚙️
                </div>
              );
            } else if (obs.type === 'laser') {
              return (
                <div
                  key={obs.id}
                  className="absolute h-1.5 bg-pink-500 border border-pink-300 shadow-md shadow-pink-500 -translate-y-1/2 pointer-events-none"
                  style={{
                    left: `${Math.min(obs.x, obs.endX || 0) / 13}%`,
                    top: `${(obs.y / 700) * 100}%`,
                    width: `${Math.abs((obs.endX || 0) - obs.x) / 13}%`
                  }}
                />
              );
            }
            return null;
          })}

          {/* Render Collectibles */}
          {collectibles.map(col => (
            <div
              key={col.id}
              className="absolute w-6 h-6 rounded-full bg-amber-400/80 border border-white flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-md shadow-amber-500/50"
              style={{ left: `${(col.x / 1300) * 100}%`, top: `${(col.y / 700) * 100}%` }}
            >
              ★
            </div>
          ))}

          {/* Bottom hint */}
          <div className="absolute bottom-3 right-4 px-3 py-1 rounded-full bg-slate-950/80 text-[10px] text-slate-400 pointer-events-none">
            ⚡ Clique no grid para posicionar a ferramenta selecionada
          </div>
        </div>
      </div>

      {/* Import JSON Modal */}
      {showImportModal && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4 shadow-2xl">
            <h3 className="text-xl font-orbitron font-bold text-white">Importar Código de Nível JSON</h3>
            <p className="text-slate-400 text-xs">
              Cole abaixo o código JSON copiado de um amigo ou nível exportado para carregá-lo no Editor:
            </p>
            
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={8}
              placeholder='{"title": "Nível Legal", "startX": 150, ...}'
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
            />

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20"
              >
                Carregar Nível
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
