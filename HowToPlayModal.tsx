import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Pause, Home, Star, Trophy, Clock, Zap, ShieldAlert, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { LevelData, GameSettings, LevelProgress, HighScoreEntry } from '../types/game';
import { GameEngine } from '../game/engine';
import { soundManager } from '../utils/sound';

interface GameCanvasProps {
  level: LevelData;
  isEndless: boolean;
  settings: GameSettings;
  onLevelComplete: (progress: LevelProgress) => void;
  onSaveHighScore: (entry: HighScoreEntry) => void;
  onNavigateMenu: () => void;
  onNextLevel?: () => void;
  totalCoins: number;
  onAddCoins: (amount: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  level,
  isEndless,
  settings,
  onLevelComplete,
  onSaveHighScore,
  onNavigateMenu,
  onNextLevel,
  onAddCoins
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // HUD state
  const [score, setScore] = useState<number>(0);
  const [coinsInSession, setCoinsInSession] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [heightReached, setHeightReached] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<number>(0);

  // Modals state
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gameOverInfo, setGameOverInfo] = useState<{ reason: string; score: number; height: number } | null>(null);
  const [winInfo, setWinInfo] = useState<{ stars: number; time: number } | null>(null);
  const [playerName, setPlayerName] = useState<string>('Spider-Ball');

  // Timer interval for campaign mode
  useEffect(() => {
    if (isEndless || isPaused || gameOverInfo || winInfo) return;
    const interval = window.setInterval(() => {
      setTimeSpent(prev => prev + 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, [isEndless, isPaused, gameOverInfo, winInfo]);

  // Trigger Victory Confetti
  const triggerConfetti = useCallback(() => {
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const interval: number = window.setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: 0.2, y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.8, y: Math.random() - 0.2 } });
    }, 250);
  }, []);

  // Initialize and start engine
  useEffect(() => {
    if (!canvasRef.current) return;

    // Set canvas dimensions
    const canvas = canvasRef.current;
    canvas.width = isEndless ? 800 : 1200;
    canvas.height = isEndless ? 1000 : 700;

    const engine = new GameEngine(
      canvas,
      level,
      settings,
      isEndless,
      {
        onScoreChange: (newScore, newCoins, newCombo) => {
          setScore(newScore);
          setCoinsInSession(newCoins);
          setCombo(newCombo);
        },
        onHeightChange: (newHeight) => {
          setHeightReached(newHeight);
        },
        onLevelWin: (stars, finalTime) => {
          setWinInfo({ stars, time: finalTime });
          onAddCoins(coinsInSession + stars * 50);
          onLevelComplete({
            levelId: level.id,
            completed: true,
            stars,
            bestTime: finalTime,
            medal: finalTime <= level.targetTime ? 'gold' : 'silver'
          });
          triggerConfetti();
        },
        onGameOver: (reason, finalScore = 0, finalHeight = 0) => {
          setGameOverInfo({ reason, score: finalScore, height: finalHeight });
          if (coinsInSession > 0) {
            onAddCoins(coinsInSession);
          }
        }
      }
    );

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
    };
  }, [level, isEndless]); // Re-run when level or mode changes

  // Sync settings changes to engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateSettings(settings);
    }
  }, [settings]);

  // Keyboard shortcut for Pause and Restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (!gameOverInfo && !winInfo) {
          togglePause();
        }
      } else if (e.code === 'KeyR') {
        handleRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, gameOverInfo, winInfo]);

  const togglePause = () => {
    soundManager.playClick();
    if (isPaused) {
      setIsPaused(false);
      engineRef.current?.start();
    } else {
      setIsPaused(true);
      engineRef.current?.stop();
    }
  };

  const handleRestart = () => {
    soundManager.playClick();
    setIsPaused(false);
    setGameOverInfo(null);
    setWinInfo(null);
    setScore(0);
    setCoinsInSession(0);
    setCombo(0);
    setHeightReached(0);
    setTimeSpent(0);

    if (canvasRef.current && engineRef.current) {
      engineRef.current.destroy();
      const canvas = canvasRef.current;
      const newEngine = new GameEngine(
        canvas,
        level,
        settings,
        isEndless,
        {
          onScoreChange: (newScore, newCoins, newCombo) => {
            setScore(newScore);
            setCoinsInSession(newCoins);
            setCombo(newCombo);
          },
          onHeightChange: (newHeight) => {
            setHeightReached(newHeight);
          },
          onLevelWin: (stars, finalTime) => {
            setWinInfo({ stars, time: finalTime });
            onAddCoins(coinsInSession + stars * 50);
            onLevelComplete({
              levelId: level.id,
              completed: true,
              stars,
              bestTime: finalTime,
              medal: finalTime <= level.targetTime ? 'gold' : 'silver'
            });
            triggerConfetti();
          },
          onGameOver: (reason, finalScore = 0, finalHeight = 0) => {
            setGameOverInfo({ reason, score: finalScore, height: finalHeight });
            if (coinsInSession > 0) {
              onAddCoins(coinsInSession);
            }
          }
        }
      );
      engineRef.current = newEngine;
      newEngine.start();
    }
  };

  const handleSaveScore = () => {
    if (!gameOverInfo) return;
    soundManager.playClick();
    const entry: HighScoreEntry = {
      id: `score_${Date.now()}`,
      name: playerName.trim() || 'Spider-Ball',
      score: gameOverInfo.score,
      height: gameOverInfo.height,
      date: new Date().toLocaleDateString(),
      mode: isEndless ? 'endless' : 'adventure'
    };
    onSaveHighScore(entry);
    onNavigateMenu();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-2 md:p-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none"></div>

      {/* Gameplay HUD Bar */}
      <div className="w-full max-w-6xl mb-3 flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-lg z-10">
        {/* Left: Level title & Combo badge */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-xl bg-indigo-600/20 border border-indigo-500/30 font-orbitron font-bold text-indigo-300 text-xs md:text-sm">
            {isEndless ? '🔥 MODO INFINITO' : `FASE ${level.id}: ${level.title.toUpperCase()}`}
          </div>

          {combo > 1 && (
            <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-orbitron font-extrabold text-xs animate-bounce shadow-md shadow-amber-500/20">
              COMBO x{combo}!
            </div>
          )}
        </div>

        {/* Center: Score, Height & Time */}
        <div className="flex items-center gap-4 md:gap-6 font-orbitron font-extrabold text-sm md:text-base">
          {isEndless ? (
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Trophy className="w-4 h-4" />
              <span>{heightReached} m</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-300" title="Tempo Decorrido">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>{timeSpent.toFixed(1)}s</span>
              <span className="text-[11px] text-slate-500 font-normal">/ {level.targetTime}s</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-amber-400" title="Moedas Coletadas">
            <Star className="w-4 h-4 fill-amber-400" />
            <span>{coinsInSession}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-pink-400" title="Pontuação Total">
            <Zap className="w-4 h-4" />
            <span>{score}</span>
          </div>
        </div>

        {/* Right: Pause & Restart */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
            title="Reiniciar Rápido (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={togglePause}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              isPaused
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Pausar Jogo (ESC ou P)"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Game Canvas Container */}
      <div className="relative w-full max-w-6xl aspect-[12/7] bg-slate-900 rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden flex items-center justify-center group">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain cursor-crosshair select-none"
        />

        {/* Bottom Floating Controls Tip */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400 pointer-events-none flex items-center gap-3 shadow-lg opacity-80 group-hover:opacity-100 transition-opacity">
          <span>🎮 <strong className="text-slate-200">Arraste:</strong> Estilingue</span>
          <span>•</span>
          <span>⚡ <strong className="text-slate-200">Toque no ar / Espaço:</strong> Pêndulo Spider-Swing</span>
        </div>
      </div>

      {/* =================== PAUSE MODAL =================== */}
      {isPaused && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
              <Pause className="w-8 h-8" />
            </div>
            
            <div>
              <h3 className="text-2xl font-orbitron font-black text-white">JOGO PAUSADO</h3>
              <p className="text-slate-400 text-sm mt-1">O que gostaria de fazer?</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={togglePause}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-orbitron font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>Continuar</span>
              </button>

              <button
                onClick={handleRestart}
                className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-indigo-400" />
                <span>Reiniciar FASE</span>
              </button>

              <button
                onClick={() => { soundManager.playClick(); onNavigateMenu(); }}
                className="w-full py-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Voltar ao Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================== GAME OVER MODAL =================== */}
      {gameOverInfo && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h3 className="text-2xl font-orbitron font-black text-rose-400">FIM DE JOGO</h3>
              <p className="text-slate-300 text-sm mt-1.5 font-medium">{gameOverInfo.reason}</p>
            </div>

            {/* Score & Height Stats */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-left">
              <div>
                <span className="text-slate-500 text-xs block font-medium uppercase">Pontuação</span>
                <span className="font-orbitron font-black text-white text-lg">{gameOverInfo.score}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block font-medium uppercase">Altura Relevada</span>
                <span className="font-orbitron font-black text-cyan-400 text-lg">{gameOverInfo.height} m</span>
              </div>
            </div>

            {/* Save High Score Input for Endless */}
            {isEndless && gameOverInfo.score > 100 && (
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Registrar Recorde:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={15}
                  placeholder="Seu Apelido"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={handleRestart}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-orbitron font-black text-sm shadow-lg shadow-rose-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                <span>TENTAR NOVAMENTE (R)</span>
              </button>

              {isEndless && gameOverInfo.score > 100 ? (
                <button
                  onClick={handleSaveScore}
                  className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-sm border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Salvar Recorde e Sair</span>
                </button>
              ) : (
                <button
                  onClick={() => { soundManager.playClick(); onNavigateMenu(); }}
                  className="w-full py-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  <span>Voltar ao Menu</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================== VICTORY / LEVEL COMPLETE MODAL =================== */}
      {winInfo && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
              <Trophy className="w-8 h-8 text-slate-950 animate-bounce" />
            </div>

            <div>
              <h3 className="text-2xl font-orbitron font-black text-white">NÍVEL CONCLUÍDO!</h3>
              <p className="text-slate-300 text-sm mt-1">Acrobacias de pêndulo perfeitas!</p>
            </div>

            {/* Star Awards Animation */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[1, 2, 3].map((starNum) => (
                <div
                  key={starNum}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                    winInfo.stars >= starNum
                      ? 'bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 border-amber-400 scale-110 shadow-lg shadow-amber-500/20 animate-glow'
                      : 'bg-slate-950 border-slate-800 opacity-40 scale-95'
                  }`}
                >
                  <Star
                    className={`w-8 h-8 ${
                      winInfo.stars >= starNum ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Time Stats */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-left">
              <div>
                <span className="text-slate-500 text-xs block font-medium uppercase">Tempo Final</span>
                <span className="font-orbitron font-black text-white text-lg">{winInfo.time.toFixed(1)}s</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block font-medium uppercase">Tempo Alvo (Ouro)</span>
                <span className="font-orbitron font-black text-amber-400 text-lg">{level.targetTime}s</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {onNextLevel ? (
                <button
                  onClick={() => { soundManager.playClick(); onNextLevel(); }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-orbitron font-black text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>PRÓXIMA FASE</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => { soundManager.playClick(); onNavigateMenu(); }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-orbitron font-black text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  <span>VOCÊ ZEROU A CAMPANHA! VOLTAR AO MENU</span>
                </button>
              )}

              <button
                onClick={handleRestart}
                className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-indigo-400" />
                <span>JOGAR NOVAMENTE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
