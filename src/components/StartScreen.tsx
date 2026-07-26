import React, { useState } from 'react';
import { Play, Star, Clock, Zap, ShieldAlert, Sparkles, Compass, Plus, Flame } from 'lucide-react';
import { LevelData, LevelProgress, GameMode } from '../types/game';
import { WORLDS, CAMPAIGN_LEVELS, COMMUNITY_LEVELS } from '../game/levels';
import { soundManager } from '../utils/sound';

interface StartScreenProps {
  onSelectLevel: (level: LevelData, isEndless?: boolean) => void;
  onNavigate: (mode: GameMode) => void;
  progress: LevelProgress[];
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onSelectLevel,
  onNavigate,
  progress
}) => {
  const [activeTab, setActiveTab] = useState<number>(1); // 1, 2, 3 for worlds, 4 for community

  const handleLevelClick = (level: LevelData) => {
    soundManager.playClick();
    onSelectLevel(level, false);
  };

  const handleEndlessClick = () => {
    soundManager.playClick();
    // Start endless mode!
    onSelectLevel(CAMPAIGN_LEVELS[0], true);
  };

  const getLevelProgress = (levelId: number): LevelProgress => {
    return progress.find(p => p.levelId === levelId) || {
      levelId,
      completed: false,
      stars: 0
    };
  };

  const currentLevels = activeTab <= 3 
    ? CAMPAIGN_LEVELS.filter(l => l.world === activeTab)
    : COMMUNITY_LEVELS;

  const activeWorldInfo = WORLDS.find(w => w.id === activeTab) || {
    name: 'Níveis da Comunidade',
    subtitle: 'Criados no Editor de Níveis e Compartilhados',
    color: '#38bdf8',
    description: 'Teste sua habilidade nos percursos personalizados do Sandbox!'
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative">
      {/* Background ambient glow circles */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Top Hero Banner / Endless Mode Launcher */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-pink-900/80 border border-indigo-500/30 p-6 md:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-400/20 via-pink-500/10 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-bold tracking-wider uppercase">
                <Flame className="w-3.5 h-3.5 text-pink-400 animate-bounce" />
                Modo Infinito Procedural
              </div>
              <h2 className="text-2xl md:text-4xl font-orbitron font-black text-white tracking-wide">
                ESCALADA SPIDER-SWING
              </h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                Suba o mais alto que puder escapando da grade de plasma ascendente! Ganhe multiplicadores de combo balançando no ar sem tocar nas paredes ou no chão.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleEndlessClick}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-orbitron font-black text-base uppercase tracking-wider shadow-lg shadow-pink-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 group"
              >
                <Play className="w-6 h-6 fill-white group-hover:translate-x-1 transition-transform" />
                <span>JOGAR INFINITO</span>
              </button>

              <button
                onClick={() => { soundManager.playClick(); onNavigate('how-to-play'); }}
                className="w-full sm:w-auto px-5 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-700 hover:border-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Compass className="w-5 h-5 text-indigo-400" />
                <span>Como Jogar</span>
              </button>
            </div>
          </div>
        </div>

        {/* World Selection Tabs */}
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl md:text-2xl font-orbitron font-extrabold text-white">
                MODO AVENTURA
              </h3>
              <p className="text-slate-400 text-xs md:text-sm">
                Selecione um mundo para explorar fases desafiadoras e conquistar estrelas.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto w-full md:w-auto">
              {WORLDS.map(w => (
                <button
                  key={w.id}
                  onClick={() => { soundManager.playClick(); setActiveTab(w.id); }}
                  className={`px-4 py-2 rounded-xl font-orbitron font-bold text-xs md:text-sm whitespace-nowrap transition-all flex items-center gap-2 active:scale-95 ${
                    activeTab === w.id
                      ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: w.color }}></span>
                  <span>Mundo {w.id}</span>
                </button>
              ))}

              <button
                onClick={() => { soundManager.playClick(); setActiveTab(4); }}
                className={`px-4 py-2 rounded-xl font-orbitron font-bold text-xs md:text-sm whitespace-nowrap transition-all flex items-center gap-2 active:scale-95 ${
                  activeTab === 4
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sandbox</span>
              </button>
            </div>
          </div>

          {/* Active World Banner */}
          <div 
            className="p-5 md:p-6 rounded-2xl border bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            style={{ borderColor: `${activeWorldInfo.color}40` }}
          >
            <div className="space-y-1 z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  {activeWorldInfo.subtitle}
                </span>
              </div>
              <h4 className="text-xl md:text-2xl font-orbitron font-black text-white">
                {activeWorldInfo.name}
              </h4>
              <p className="text-slate-300 text-sm max-w-2xl">
                {activeWorldInfo.description}
              </p>
            </div>

            {activeTab === 4 && (
              <button
                onClick={() => { soundManager.playClick(); onNavigate('editor'); }}
                className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap z-10"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Nível</span>
              </button>
            )}
          </div>

          {/* Level Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {currentLevels.map((lvl, index) => {
              const prog = getLevelProgress(lvl.id);
              const isLocked = activeTab <= 3 && lvl.id > 1 && !progress.some(p => p.levelId === lvl.id - 1 && p.completed);

              return (
                <div
                  key={lvl.id}
                  onClick={() => !isLocked && handleLevelClick(lvl)}
                  className={`group relative rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                    isLocked
                      ? 'bg-slate-950/40 border-slate-800/80 opacity-60 cursor-not-allowed'
                      : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 hover:border-indigo-500/50 cursor-pointer shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1'
                  }`}
                >
                  {/* Top: Level Number & Stars */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-orbitron font-black text-base transition-colors ${
                        prog.completed
                          ? 'bg-gradient-to-tr from-indigo-600 to-pink-500 text-white shadow-md shadow-indigo-500/20'
                          : isLocked
                          ? 'bg-slate-800 text-slate-500'
                          : 'bg-slate-800 group-hover:bg-indigo-600/30 text-indigo-400 group-hover:text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <h5 className="font-orbitron font-bold text-white text-base leading-tight group-hover:text-indigo-300 transition-colors">
                          {lvl.title}
                        </h5>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Nível {lvl.id}
                        </span>
                      </div>
                    </div>

                    {/* Star Badge */}
                    {!isLocked && (
                      <div className="flex items-center gap-1 bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-800">
                        {[1, 2, 3].map(starNum => (
                          <Star
                            key={starNum}
                            className={`w-3.5 h-3.5 ${
                              prog.stars >= starNum
                                ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                                : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-slate-400 text-xs line-clamp-2 mb-4 min-h-[32px]">
                    {lvl.description || 'Atravesse o percurso de pêndulo no tempo limite!'}
                  </p>

                  {/* Bottom: Info & Play button */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1" title="Tempo Alvo para Ouro">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Alvo: {lvl.targetTime}s</span>
                      </span>

                      {prog.bestTime && (
                        <span className="flex items-center gap-1 font-semibold text-amber-400" title="Melhor Tempo">
                          <Zap className="w-3.5 h-3.5" />
                          <span>{prog.bestTime.toFixed(1)}s</span>
                        </span>
                      )}
                    </div>

                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                      isLocked
                        ? 'bg-slate-800 text-slate-600'
                        : 'bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-400 group-hover:text-white shadow-sm'
                    }`}>
                      {isLocked ? <ShieldAlert className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
