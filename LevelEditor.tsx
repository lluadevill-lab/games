import React, { useState } from 'react';
import { Trophy, Medal, Flame, Trash2, ArrowLeft } from 'lucide-react';
import { HighScoreEntry, LevelProgress } from '../types/game';
import { soundManager } from '../utils/sound';

interface HighScoresModalProps {
  onClose: () => void;
  scores: HighScoreEntry[];
  onClearScores: () => void;
  progress: LevelProgress[];
}

export const HighScoresModal: React.FC<HighScoresModalProps> = ({
  onClose,
  scores,
  onClearScores,
  progress
}) => {
  const [activeTab] = useState<'endless' | 'adventure'>('endless');

  const totalStars = progress.reduce((acc, p) => acc + (p.stars || 0), 0);
  const completedCount = progress.filter(p => p.completed).length;

  const sortedScores = [...scores].filter(s => s.mode === activeTab).sort((a, b) => {
    if (activeTab === 'endless') return b.height - a.height || b.score - a.score;
    return b.score - a.score;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { soundManager.playClick(); onClose(); }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-sm font-semibold border border-slate-700 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>Voltar</span>
            </button>
            <div>
              <h2 className="text-2xl md:text-3xl font-orbitron font-black text-white flex items-center gap-2">
                <Trophy className="w-7 h-7 text-amber-400" />
                <span>TABELA DE RECORDES LOCAIS</span>
              </h2>
              <p className="text-slate-400 text-xs md:text-sm">
                Confira seus melhores desempenhos na escalada infinita de plasma!
              </p>
            </div>
          </div>

          {scores.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Tem certeza que deseja limpar todo o histórico de recordes?')) {
                  soundManager.playDeath();
                  onClearScores();
                }
              }}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpar Tabela</span>
            </button>
          )}
        </div>

        {/* Campaign Mini-Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
              ★
            </div>
            <div>
              <span className="text-slate-400 text-xs uppercase block font-medium">Estrelas Total</span>
              <span className="font-orbitron font-black text-white text-xl">{totalStars} / 45</span>
            </div>
          </div>

          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
              ✔
            </div>
            <div>
              <span className="text-slate-400 text-xs uppercase block font-medium">Fases Concluídas</span>
              <span className="font-orbitron font-black text-white text-xl">{completedCount} / 15</span>
            </div>
          </div>

          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex items-center gap-4 col-span-2 sm:col-span-1">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-lg">
              🔥
            </div>
            <div>
              <span className="text-slate-400 text-xs uppercase block font-medium">Melhor Altura</span>
              <span className="font-orbitron font-black text-cyan-400 text-xl">
                {sortedScores.length > 0 ? `${sortedScores[0].height} m` : '0 m'}
              </span>
            </div>
          </div>
        </div>

        {/* Scores List */}
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800/80 overflow-hidden shadow-xl">
          <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <div className="flex items-center gap-6">
              <span className="w-8 text-center">Pos.</span>
              <span>Jogador</span>
            </div>
            <div className="flex items-center gap-8 md:gap-16">
              <span>Altura</span>
              <span>Pontos</span>
              <span className="hidden sm:inline">Data</span>
            </div>
          </div>

          {sortedScores.length === 0 ? (
            <div className="p-12 text-center space-y-3 text-slate-400">
              <Flame className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="font-orbitron font-bold text-slate-300">Nenhum recorde registrado ainda!</p>
              <p className="text-xs">Jogue o Modo Escalada Spider-Swing para gravar seu nome no ranking.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {sortedScores.map((entry, idx) => {
                const isTop3 = idx < 3;
                let medalColor = 'text-slate-500 bg-slate-800/80';
                if (idx === 0) medalColor = 'text-amber-400 bg-amber-500/20 border border-amber-500/40 shadow-sm';
                if (idx === 1) medalColor = 'text-slate-300 bg-slate-300/20 border border-slate-400/40';
                if (idx === 2) medalColor = 'text-amber-600 bg-amber-700/20 border border-amber-600/40';

                return (
                  <div
                    key={entry.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-orbitron font-black text-sm ${medalColor}`}>
                        {isTop3 ? <Medal className="w-4 h-4 fill-current" /> : idx + 1}
                      </div>
                      <div>
                        <span className="font-orbitron font-bold text-white block text-sm md:text-base">
                          {entry.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block sm:hidden">{entry.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 md:gap-16 font-orbitron font-extrabold text-sm md:text-base">
                      <span className="text-cyan-400 min-w-[60px] text-right">{entry.height} m</span>
                      <span className="text-pink-400 min-w-[70px] text-right">{entry.score} pts</span>
                      <span className="text-slate-500 font-normal text-xs min-w-[80px] text-right hidden sm:inline">
                        {entry.date}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
