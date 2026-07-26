import React, { useState } from 'react';
import { ShoppingBag, Star, Check, Lock, ArrowLeft, Sparkles } from 'lucide-react';
import { SkinItem, GameSettings } from '../types/game';
import { soundManager } from '../utils/sound';

export const INITIAL_SKINS: SkinItem[] = [
  // BALLS
  { id: 'plasma', name: 'Esfera Plasma', type: 'ball', price: 0, unlocked: true, color: '#38bdf8', description: 'Esfera de energia cian padrão dos laboratórios.' },
  { id: 'cyber-ninja', name: 'Ciber-Ninja', type: 'ball', price: 150, unlocked: false, color: '#f43f5e', description: 'Esfera rubi furtiva com aerodinâmica agressiva.' },
  { id: 'dragon-egg', name: 'Ovo de Dragão', type: 'ball', price: 300, unlocked: false, color: '#10b981', description: 'Esfera esmeralda escamosa resistente a grandes impactos.' },
  { id: 'gold-sun', name: 'Sol de Ouro', type: 'ball', price: 500, unlocked: false, color: '#facc15', description: 'O ícone supremo do campeão dos pêndulos.' },
  { id: 'void-eye', name: 'Olho do Vazio', type: 'ball', price: 800, unlocked: false, color: '#a855f7', description: 'Esfera quântica pulsante que distorce a gravidade visual.' },
  { id: 'retro-8bit', name: 'Retro 8-Bit', type: 'ball', price: 1200, unlocked: false, color: '#ec4899', description: 'Homenagem aos fliperamas clássicos dos anos 80.' }
];

interface ShopModalProps {
  onClose: () => void;
  coins: number;
  onSpendCoins: (amount: number) => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  unlockedSkins: string[];
  onUnlockSkin: (skinId: string) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  onClose,
  coins,
  onSpendCoins,
  settings,
  onUpdateSettings,
  unlockedSkins,
  onUnlockSkin
}) => {
  const [activeTab, setActiveTab] = useState<'ball' | 'trail' | 'rope'>('ball');

  const handleEquip = (item: SkinItem) => {
    soundManager.playClick();
    if (item.type === 'ball') {
      onUpdateSettings({ ...settings, equippedBall: item.id });
    } else if (item.type === 'trail') {
      onUpdateSettings({ ...settings, equippedTrail: item.id });
    } else {
      onUpdateSettings({ ...settings, equippedRope: item.id });
    }
  };

  const handleBuy = (item: SkinItem) => {
    if (coins >= item.price) {
      soundManager.playWin();
      onSpendCoins(item.price);
      onUnlockSkin(item.id);
      handleEquip(item);
    } else {
      soundManager.playBounce();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative">
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { soundManager.playClick(); onClose(); }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-sm font-semibold border border-slate-700 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-pink-400" />
              <span>Voltar</span>
            </button>
            <div>
              <h2 className="text-2xl md:text-3xl font-orbitron font-black text-white flex items-center gap-2">
                <ShoppingBag className="w-7 h-7 text-pink-400" />
                <span>LOJA E VESTIÁRIO</span>
              </h2>
              <p className="text-slate-400 text-xs md:text-sm">
                Desbloqueie novas aparências com suas estrelas coletadas nas fases!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 border border-amber-500/30 px-4 py-2 rounded-full shadow-inner">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400 animate-pulse" />
            <span className="font-orbitron font-bold text-amber-400 text-lg">{coins}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit">
          <button
            onClick={() => { soundManager.playClick(); setActiveTab('ball'); }}
            className={`px-5 py-2.5 rounded-xl font-orbitron font-bold text-xs md:text-sm transition-all flex items-center gap-2 active:scale-95 ${
              activeTab === 'ball'
                ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Esferas (Skins)</span>
          </button>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {INITIAL_SKINS.filter(item => item.type === activeTab).map((item) => {
            const isUnlocked = item.unlocked || unlockedSkins.includes(item.id);
            const isEquipped = settings.equippedBall === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                  isEquipped
                    ? 'bg-slate-900/90 border-pink-500 shadow-xl shadow-pink-500/10 scale-[1.02]'
                    : isUnlocked
                    ? 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-80'
                }`}
              >
                <div>
                  {/* Top Preview Box */}
                  <div className="w-full aspect-video rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center relative overflow-hidden mb-4 group">
                    <div
                      className="w-16 h-16 rounded-full shadow-2xl transition-transform duration-300 group-hover:scale-110 flex items-center justify-center relative"
                      style={{ backgroundColor: item.color, boxShadow: `0 0 30px ${item.color}80` }}
                    >
                      <div className="w-6 h-6 rounded-full bg-white opacity-40 absolute -top-2 -left-2"></div>
                    </div>

                    {isEquipped && (
                      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 font-orbitron font-bold text-[10px] uppercase">
                        Equipado
                      </span>
                    )}
                  </div>

                  <h3 className="font-orbitron font-bold text-white text-lg">{item.name}</h3>
                  <p className="text-slate-400 text-xs mt-1 min-h-[32px] leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-5 mt-4 border-t border-slate-800/80">
                  {isEquipped ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-pink-600/20 border border-pink-500/40 text-pink-300 font-orbitron font-bold text-xs flex items-center justify-center gap-2 cursor-default"
                    >
                      <Check className="w-4 h-4" />
                      <span>EM USO</span>
                    </button>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => handleEquip(item)}
                      className="w-full py-3 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white font-orbitron font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span>EQUIPAR</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={coins < item.price}
                      className={`w-full py-3 rounded-xl font-orbitron font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        coins >= item.price
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/20 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                      <span>DESBLOQUEAR POR {item.price} ★</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
