import React from 'react';
import { Volume2, VolumeX, Music, Trophy, ShoppingBag, HelpCircle, Edit3, ArrowLeft } from 'lucide-react';
import { GameMode, GameSettings } from '../types/game';
import { soundManager } from '../utils/sound';

interface NavbarProps {
  currentMode: GameMode;
  onNavigate: (mode: GameMode) => void;
  coins: number;
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onNavigate,
  coins,
  settings,
  onUpdateSettings
}) => {
  const toggleSound = () => {
    const next = { ...settings, soundEnabled: !settings.soundEnabled };
    onUpdateSettings(next);
    soundManager.playClick();
  };

  const toggleMusic = () => {
    const next = { ...settings, musicEnabled: !settings.musicEnabled };
    onUpdateSettings(next);
    soundManager.playClick();
  };

  const handleNav = (mode: GameMode) => {
    soundManager.playClick();
    onNavigate(mode);
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-indigo-500/20 px-4 py-3 z-30 relative shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo and Back button */}
        <div className="flex items-center gap-3">
          {currentMode !== 'menu' && currentMode !== 'level-select' && (
            <button
              onClick={() => handleNav('level-select')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-sm font-semibold border border-slate-700 active:scale-95"
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          )}

          <div
            onClick={() => handleNav('level-select')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-pink-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <span className="text-white font-orbitron font-black text-lg drop-shadow">CE</span>
            </div>
            <div>
              <h1 className="font-orbitron font-black text-lg md:text-xl tracking-wider bg-gradient-to-r from-indigo-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                CORDA ELÁSTICA
              </h1>
              <p className="text-[10px] text-slate-400 -mt-1 tracking-widest uppercase hidden md:block">
                Slingshot & Spider-Swing Physics
              </p>
            </div>
          </div>
        </div>

        {/* Right: Currency & Action buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Currency Display */}
          <div 
            onClick={() => handleNav('shop')}
            className="flex items-center gap-2 bg-slate-950/80 border border-amber-500/30 px-3 py-1.5 rounded-full cursor-pointer hover:border-amber-400 transition-colors shadow-inner"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-md shadow-amber-500/30 animate-pulse">
              <span className="text-slate-950 font-black text-xs">★</span>
            </div>
            <span className="font-orbitron font-bold text-amber-400 text-sm md:text-base">
              {coins}
            </span>
          </div>

          {/* Nav Icons */}
          <button
            onClick={() => handleNav('shop')}
            className={`p-2 md:px-3 md:py-1.5 rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 ${
              currentMode === 'shop'
                ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white border-pink-400 shadow-lg shadow-pink-500/25'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
            title="Loja de Skins"
          >
            <ShoppingBag className="w-4 h-4 text-pink-400" />
            <span className="hidden lg:inline text-xs font-bold">Loja</span>
          </button>

          <button
            onClick={() => handleNav('editor')}
            className={`p-2 md:px-3 md:py-1.5 rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 ${
              currentMode === 'editor'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-lg shadow-cyan-500/25'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
            title="Editor de Níveis"
          >
            <Edit3 className="w-4 h-4 text-cyan-400" />
            <span className="hidden lg:inline text-xs font-bold">Editor</span>
          </button>

          <button
            onClick={() => handleNav('high-scores')}
            className={`p-2 md:px-3 md:py-1.5 rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 ${
              currentMode === 'high-scores'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white border-amber-400 shadow-lg shadow-amber-500/25'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
            title="Tabela de Recordes"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden lg:inline text-xs font-bold">Recordes</span>
          </button>

          <button
            onClick={() => handleNav('how-to-play')}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition-all active:scale-95"
            title="Como Jogar"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
          </button>

          {/* Sound Toggles */}
          <div className="h-6 w-px bg-slate-700 mx-0.5 hidden sm:block"></div>

          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              settings.soundEnabled
                ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                : 'bg-slate-800/80 text-slate-500 border-slate-700'
            }`}
            title={settings.soundEnabled ? 'Efeitos de Som Ativados' : 'Efeitos Desativados'}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleMusic}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              settings.musicEnabled
                ? 'bg-pink-600/20 text-pink-400 border-pink-500/30'
                : 'bg-slate-800/80 text-slate-500 border-slate-700'
            }`}
            title={settings.musicEnabled ? 'Música Synthwave Ativada' : 'Música Desativada'}
          >
            <Music className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
