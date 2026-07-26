import React from 'react';
import { ArrowLeft, Play, Zap, Flame, Target, Sparkles, Compass } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface HowToPlayModalProps {
  onClose: () => void;
  onPlayTutorial: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  onClose,
  onPlayTutorial
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative">
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { soundManager.playClick(); onClose(); }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-sm font-semibold border border-slate-700 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span>Voltar</span>
            </button>
            <div>
              <h2 className="text-2xl md:text-3xl font-orbitron font-black text-white flex items-center gap-2">
                <Compass className="w-7 h-7 text-indigo-400" />
                <span>COMO JOGAR CORDA ELÁSTICA</span>
              </h2>
              <p className="text-slate-400 text-xs md:text-sm">
                Domine a física de pêndulo real e os lançamentos de estilingue!
              </p>
            </div>
          </div>
        </div>

        {/* Hero Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-slate-900 border border-indigo-500/30 shadow-xl space-y-4">
          <h3 className="text-xl md:text-2xl font-orbitron font-black text-white">
            O SEGREDO DOS DOIS CONTROLES INSTRUÍDOS
          </h3>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Em <strong className="text-indigo-300">Corda Elástica</strong>, você controla uma bolinha de energia presa a pontos de ancoragem. A jogabilidade combina o melhor de dois mundos: <strong className="text-pink-400">Lançamento por Estilingue</strong> quando enganchado e <strong className="text-cyan-400">Acrobacias Aéreas tipo Spider-Man</strong> no meio do voo!
          </p>
        </div>

        {/* Instructions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box 1: Slingshot */}
          <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Target className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-orbitron font-bold text-white">
                1. O ESTILINGUE ELÁSTICO
              </h4>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                Quando a bolinha estiver parada ou pendurada em um gancho, <strong>toque, segure e arraste para trás</strong>! Um feixe de energia mostrará a trajetória prevista. Ao <strong>soltar</strong>, o elástico dispara a bolinha com enorme velocidade.
              </p>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
              <span>💡</span>
              <span>Quanto mais você puxar para trás, maior será a força do lançamento!</span>
            </div>
          </div>

          {/* Box 2: Mid-Air Hooking */}
          <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Zap className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-orbitron font-bold text-white">
                2. BALANÇO SPIDER-SWING NO AR
              </h4>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                Enquanto estiver voando pelo ar, <strong>toque em qualquer lugar</strong> da tela (ou pressione <strong>ESPAÇO / W / Seta para Cima</strong>). O jogo dispara automaticamente um elástico para o ponto de ancoragem mais próximo, iniciando um balanço de pêndulo real!
              </p>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
              <span>💡</span>
              <span>Solte no ponto mais alto do arco para ser arremessado para longe!</span>
            </div>
          </div>

          {/* Box 3: Pumping & Momentum */}
          <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Flame className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-orbitron font-bold text-white">
                3. IMPULSO E COMBOS AÉREOS
              </h4>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                Enquanto balança no pêndulo, segure a <strong>Seta para Baixo / S</strong> (ou segure um segundo toque na tela) para tensionar o elástico e ganhar super velocidade! Se você enganchar de ponto em ponto sem tocar no chão ou nas paredes, seu <strong>COMBO</strong> aumenta, multiplicando seus pontos!
              </p>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
              <span>💡</span>
              <span>As paredes azuis são elásticas! Rebate nelas para mudar de direção.</span>
            </div>
          </div>

          {/* Box 4: Hazards & Elements */}
          <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-orbitron font-bold text-white">
                4. ELEMENTOS DAS FASES
              </h4>
              <ul className="text-slate-400 text-xs space-y-2">
                <li>🔴 <strong>Pontos Laranja/Vermelhos:</strong> Ganchos frágeis! Quebram após 1.5 segundo.</li>
                <li>🟣 <strong>Pontos Magentas:</strong> Ganchos em movimento orbital.</li>
                <li>⚙️ <strong>Serras e Lasers:</strong> Perigos mortais que destroem a bolinha ao toque!</li>
                <li>🌀 <strong>Portais Quânticos:</strong> Teletransportam mantendo sua velocidade de voo.</li>
              </ul>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
              <span>💡</span>
              <span>Colete todas as estrelas de cada fase para conquistar a classificação máxima!</span>
            </div>
          </div>
        </div>

        {/* Play Tutorial Button */}
        <div className="pt-4 text-center">
          <button
            onClick={() => { soundManager.playClick(); onPlayTutorial(); }}
            className="px-10 py-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-orbitron font-black text-base tracking-wider uppercase shadow-xl shadow-indigo-500/30 hover:scale-105 transition-all active:scale-95 inline-flex items-center gap-3"
          >
            <Play className="w-6 h-6 fill-white" />
            <span>TESTAR AGORA NA FASE 1 (TUTORIAL)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
