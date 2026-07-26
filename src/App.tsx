import { useState, useEffect } from 'react';
import { GameMode, LevelData, GameSettings, LevelProgress, HighScoreEntry } from './types/game';
import { CAMPAIGN_LEVELS, COMMUNITY_LEVELS } from './game/levels';
import { Navbar } from './components/Navbar';
import { StartScreen } from './components/StartScreen';
import { GameCanvas } from './components/GameCanvas';
import { ShopModal } from './components/ShopModal';
import { HighScoresModal } from './components/HighScoresModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { LevelEditor } from './components/LevelEditor';
import { endlessGenerator } from './game/endless';
import { storage } from './utils/storage';

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  screenShake: true,
  showTrajectory: true,
  equippedBall: 'plasma',
  equippedTrail: 'default',
  equippedRope: 'default'
};

export function App() {
  const [currentMode, setCurrentMode] = useState<GameMode>('level-select');
  const [currentLevel, setCurrentLevel] = useState<LevelData>(CAMPAIGN_LEVELS[0]);
  const [isEndless, setIsEndless] = useState<boolean>(false);
  
  // Persistent State
  const [coins, setCoins] = useState<number>(() => {
    const saved = storage.getItem('ce_coins');
    const n = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(n) ? n : 250; // default start with 250 stars for rewards!
  });

  const [settings, setSettings] = useState<GameSettings>(() =>
    // Merge with defaults so a partial/old saved payload can't break the game.
    ({ ...DEFAULT_SETTINGS, ...storage.getJSON<Partial<GameSettings>>('ce_settings', {}) })
  );

  const [progress, setProgress] = useState<LevelProgress[]>(() =>
    storage.getJSON<LevelProgress[]>('ce_progress', [{ levelId: 1, completed: false, stars: 0 }])
  );

  const [highScores, setHighScores] = useState<HighScoreEntry[]>(() => {
    const saved = storage.getJSON<HighScoreEntry[] | null>('ce_highscores', null);
    if (saved) return saved;
    return [
      { id: 'hs_1', name: 'CyberSpider', score: 450, height: 45, date: '10/05/2026', mode: 'endless' },
      { id: 'hs_2', name: 'NeonSwinger', score: 320, height: 32, date: '11/05/2026', mode: 'endless' },
      { id: 'hs_3', name: 'PlasmaKing', score: 180, height: 18, date: '12/05/2026', mode: 'endless' }
    ];
  });

  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(() =>
    storage.getJSON<string[]>('ce_unlocked_skins', ['plasma'])
  );

  const [communityLevels, setCommunityLevels] = useState<LevelData[]>(() =>
    storage.getJSON<LevelData[]>('ce_community_levels', COMMUNITY_LEVELS)
  );

  // Persist changes (no-ops safely when storage is unavailable)
  useEffect(() => {
    storage.setItem('ce_coins', coins.toString());
  }, [coins]);

  useEffect(() => {
    storage.setJSON('ce_settings', settings);
  }, [settings]);

  useEffect(() => {
    storage.setJSON('ce_progress', progress);
  }, [progress]);

  useEffect(() => {
    storage.setJSON('ce_highscores', highScores);
  }, [highScores]);

  useEffect(() => {
    storage.setJSON('ce_unlocked_skins', unlockedSkins);
  }, [unlockedSkins]);

  useEffect(() => {
    storage.setJSON('ce_community_levels', communityLevels);
  }, [communityLevels]);

  // Handlers
  const handleSelectLevel = (level: LevelData, endless: boolean = false) => {
    if (endless) {
      const init = endlessGenerator.getInitialLevel();
      setCurrentLevel(init.level);
      setIsEndless(true);
      setCurrentMode('endless');
    } else {
      setCurrentLevel(level);
      setIsEndless(false);
      setCurrentMode('adventure');
    }
  };

  const handleLevelComplete = (newProg: LevelProgress) => {
    setProgress(prev => {
      const existingIdx = prev.findIndex(p => p.levelId === newProg.levelId);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const old = copy[existingIdx];
        copy[existingIdx] = {
          ...old,
          completed: true,
          stars: Math.max(old.stars || 0, newProg.stars),
          bestTime: old.bestTime ? Math.min(old.bestTime, newProg.bestTime || 999) : newProg.bestTime,
          medal: newProg.medal
        };
        return copy;
      } else {
        return [...prev, newProg];
      }
    });

    // Automatically unlock next level in progress array if not present
    if (newProg.levelId < CAMPAIGN_LEVELS.length) {
      setProgress(prev => {
        if (!prev.some(p => p.levelId === newProg.levelId + 1)) {
          return [...prev, { levelId: newProg.levelId + 1, completed: false, stars: 0 }];
        }
        return prev;
      });
    }
  };

  const handleNextLevel = () => {
    const nextId = currentLevel.id + 1;
    const nextLvl = CAMPAIGN_LEVELS.find(l => l.id === nextId);
    if (nextLvl) {
      setCurrentLevel(nextLvl);
    } else {
      setCurrentMode('level-select');
    }
  };

  const handleSaveHighScore = (entry: HighScoreEntry) => {
    setHighScores(prev => [entry, ...prev].slice(0, 50));
  };

  const handleClearHighScores = () => {
    setHighScores([]);
  };

  const handleSpendCoins = (amount: number) => {
    setCoins(prev => Math.max(0, prev - amount));
  };

  const handleAddCoins = (amount: number) => {
    setCoins(prev => prev + amount);
  };

  const handleUnlockSkin = (skinId: string) => {
    if (!unlockedSkins.includes(skinId)) {
      setUnlockedSkins(prev => [...prev, skinId]);
    }
  };

  const handleSaveCommunityLevel = (lvl: LevelData) => {
    setCommunityLevels(prev => {
      const idx = prev.findIndex(l => l.id === lvl.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = lvl;
        return copy;
      }
      return [lvl, ...prev];
    });
  };

  return (
    <div className="w-full h-screen flex flex-col bg-slate-950 font-sans overflow-hidden select-none">
      <Navbar
        currentMode={currentMode}
        onNavigate={setCurrentMode}
        coins={coins}
        settings={settings}
        onUpdateSettings={setSettings}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentMode === 'level-select' && (
          <StartScreen
            onSelectLevel={handleSelectLevel}
            onNavigate={setCurrentMode}
            progress={progress}
          />
        )}

        {(currentMode === 'adventure' || currentMode === 'endless') && (
          <GameCanvas
            level={currentLevel}
            isEndless={isEndless}
            settings={settings}
            onLevelComplete={handleLevelComplete}
            onSaveHighScore={handleSaveHighScore}
            onNavigateMenu={() => setCurrentMode('level-select')}
            onNextLevel={currentLevel.id < CAMPAIGN_LEVELS.length && !isEndless ? handleNextLevel : undefined}
            totalCoins={coins}
            onAddCoins={handleAddCoins}
          />
        )}

        {currentMode === 'shop' && (
          <ShopModal
            onClose={() => setCurrentMode('level-select')}
            coins={coins}
            onSpendCoins={handleSpendCoins}
            settings={settings}
            onUpdateSettings={setSettings}
            unlockedSkins={unlockedSkins}
            onUnlockSkin={handleUnlockSkin}
          />
        )}

        {currentMode === 'high-scores' && (
          <HighScoresModal
            onClose={() => setCurrentMode('level-select')}
            scores={highScores}
            onClearScores={handleClearHighScores}
            progress={progress}
          />
        )}

        {currentMode === 'how-to-play' && (
          <HowToPlayModal
            onClose={() => setCurrentMode('level-select')}
            onPlayTutorial={() => handleSelectLevel(CAMPAIGN_LEVELS[0], false)}
          />
        )}

        {currentMode === 'editor' && (
          <LevelEditor
            onClose={() => setCurrentMode('level-select')}
            onTestLevel={(lvl) => handleSelectLevel(lvl, false)}
            onSaveCommunityLevel={handleSaveCommunityLevel}
          />
        )}
      </main>
    </div>
  );
}
export default App;
