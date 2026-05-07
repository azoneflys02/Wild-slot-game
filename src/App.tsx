/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Coins, 
  Trophy, 
  Zap, 
  Info,
  Volume2,
  VolumeX,
  Star,
  Lock,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Constants & Types ---

const ROWS = 3;
const COLS = 5;
const SPIN_DURATION = 2000;
const REEL_DELAY = 200;

// --- Sound Engine ---
const playSound = (type: 'spin' | 'stop' | 'win' | 'bigWin' | 'bonus' | 'land_standard' | 'land_wild' | 'land_scatter' | 'ambient_safari' | 'loss_thud', muted: boolean) => {
  if (muted || typeof window === 'undefined') return;
  
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (freq: number, startTime: number, duration: number, oscType: OscillatorType = 'sine', volume = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    switch (type) {
      case 'spin':
        playTone(70, ctx.currentTime, 0.5, 'square', 0.03);
        playTone(60, ctx.currentTime, 0.5, 'triangle', 0.05);
        break;
      case 'stop':
        playTone(120, ctx.currentTime, 0.15, 'triangle', 0.1);
        break;
      case 'loss_thud':
        playTone(40, ctx.currentTime, 0.3, 'sine', 0.15);
        playTone(60, ctx.currentTime, 0.2, 'triangle', 0.1);
        break;
      case 'land_standard':
        playTone(180, ctx.currentTime, 0.1, 'sine', 0.05);
        break;
      case 'land_wild':
        playTone(330, ctx.currentTime, 0.2, 'sine', 0.1);
        playTone(440, ctx.currentTime + 0.05, 0.2, 'triangle', 0.08);
        break;
      case 'land_scatter':
        playTone(523, ctx.currentTime, 0.2, 'square', 0.05);
        playTone(659, ctx.currentTime + 0.05, 0.2, 'sine', 0.05);
        break;
      case 'win':
        [523.25, 659.25, 783.99].forEach((f, i) => {
          playTone(f, ctx.currentTime + (i * 0.1), 0.4, 'sine', 0.1);
        });
        break;
      case 'bigWin':
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
          playTone(f, ctx.currentTime + (i * 0.1), 1.0, 'triangle', 0.1);
          playTone(f * 1.25, ctx.currentTime + (i * 0.1), 0.8, 'square', 0.02);
          playTone(f * 1.5, ctx.currentTime + (i * 0.1), 0.5, 'sine', 0.05);
        });
        break;
      case 'bonus':
        // Pronounced bonus trigger sound
        for (let i = 0; i < 5; i++) {
          const startTime = ctx.currentTime + (i * 0.15);
          playTone(440 * (1 + i * 0.2), startTime, 0.6, 'sawtooth', 0.05);
          playTone(880 * (1 + i * 0.1), startTime, 0.4, 'sine', 0.1);
        }
        playTone(220, ctx.currentTime, 2.0, 'sawtooth', 0.05);
        break;
      case 'ambient_safari':
        // Subtle ambient noises (insect buzzes, distant bird chirps simulated with oscillators)
        const frequency = 2000 + Math.random() * 1000;
        playTone(frequency, ctx.currentTime, 0.2, 'sine', 0.005);
        playTone(frequency * 1.5, ctx.currentTime + 0.1, 0.1, 'sine', 0.003);
        break;
    }
  } catch (e) {
    console.warn('Audio context blocked or unavailable:', e);
  }
};

interface Symbol {
  id: string;
  emoji: string;
  value: number;
  label: string;
  color: string;
  type: 'standard' | 'wild' | 'scatter';
}

const SYMBOLS: Symbol[] = [
  { id: 'lion', emoji: '🦁', value: 500, label: 'Lion', color: 'from-orange-400 to-red-600', type: 'wild' },
  { id: 'paw', emoji: '🐾', value: 0, label: 'Scatter', color: 'from-yellow-300 to-amber-500', type: 'scatter' },
  { id: 'elephant', emoji: '🐘', value: 200, label: 'Elephant', color: 'from-blue-400 to-indigo-600', type: 'standard' },
  { id: 'zebra', emoji: '🦓', value: 100, label: 'Zebra', color: 'from-slate-300 to-slate-500', type: 'standard' },
  { id: 'monkey', emoji: '🐒', value: 50, label: 'Monkey', color: 'from-amber-600 to-orange-800', type: 'standard' },
  { id: 'parrot', emoji: '🦜', value: 20, label: 'Parrot', color: 'from-green-400 to-emerald-600', type: 'standard' },
  { id: 'banana', emoji: '🍌', value: 10, label: 'Banana', color: 'from-yellow-200 to-yellow-400', type: 'standard' },
  { id: 'leaf', emoji: '🌿', value: 5, label: 'Leaf', color: 'from-green-200 to-green-400', type: 'standard' },
];

const PAYLINES = [
  [1, 1, 1, 1, 1], // 1: Middle row
  [0, 0, 0, 0, 0], // 2: Top row
  [2, 2, 2, 2, 2], // 3: Bottom row
  [0, 1, 2, 1, 0], // 4: V-shape
  [2, 1, 0, 1, 2], // 5: Inverted V
  [0, 0, 1, 2, 2], // 6: Step down
  [2, 2, 1, 0, 0], // 7: Step up
  [1, 0, 1, 2, 1], // 8: M-shape
  [1, 2, 1, 0, 1], // 9: W-shape
  [0, 2, 0, 2, 0], // 10: Big Zigzag
  [2, 0, 2, 0, 2], // 11: Big Zigzag Inverted
  [1, 0, 0, 0, 1], // 12: Arch
  [1, 2, 2, 2, 1], // 13: Inverted arch
  [0, 1, 0, 1, 0], // 14: Top Zigzag
  [2, 1, 2, 1, 2], // 15: Bottom Zigzag
  [0, 2, 2, 2, 0], // 16: Deep Arch
  [2, 0, 0, 0, 2], // 17: Deep Inverted Arch
  [1, 1, 0, 1, 1], // 18: Middle Bump
  [1, 1, 2, 1, 1], // 19: Middle Dip
  [0, 1, 1, 1, 0], // 20: Top Flattened Arch
];

// --- Helper Functions ---

const getRandomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

const generateGrid = () => {
  return Array(COLS).fill(null).map(() => 
    Array(ROWS).fill(null).map(() => getRandomSymbol())
  );
};

// --- Components ---

const PaylineOverlay = ({ winningLines, isSpinning }: { winningLines: number[], isSpinning: boolean }) => {
  if (isSpinning || winningLines.length === 0) return null;

  return (
    <svg 
      className="absolute inset-0 pointer-events-none z-20 w-full h-full px-2 md:px-4" 
      viewBox="0 0 500 300" 
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {winningLines.map((lineIdx) => {
        const path = PAYLINES[lineIdx];
        const points = path.map((row, col) => {
          const x = (col * 100) + 50;
          const y = (row * 100) + 50;
          return `${x},${y}`;
        }).join(' ');
        
        return (
          <motion.polyline
            key={`line-${lineIdx}`}
            points={points}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        );
      })}
    </svg>
  );
};

const SlotSymbol = ({ 
  symbol, 
  highlighted = false, 
  isLocked = false,
  onToggleLock = () => {}
}: { 
  symbol: Symbol; 
  highlighted?: boolean; 
  isLocked?: boolean;
  onToggleLock?: () => void;
  key?: React.Key 
}) => (
  <motion.div
    animate={highlighted ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : { scale: 1 }}
    transition={{ repeat: highlighted ? Infinity : 0, duration: 0.5 }}
    onClick={onToggleLock}
    className={`w-full aspect-square flex items-center justify-center p-2 rounded-2xl transition-all duration-300 relative cursor-pointer group ${
      highlighted 
        ? 'bg-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.4)] z-10 border-2 border-emerald-400' 
        : isLocked
          ? 'bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)] border-2 border-amber-400 z-10'
          : 'bg-black/40 shadow-inner border border-white/5 hover:bg-black/50'
    }`}
  >
    <div className="text-4xl md:text-5xl lg:text-7xl drop-shadow-md select-none group-hover:scale-110 transition-transform">
      {symbol.emoji}
    </div>
    
    {/* Lock/Unlock Tooltip hint */}
    {!highlighted && !isLocked && (
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-2xl">
        <span className="text-[10px] font-black uppercase text-amber-400">Lock (+5)</span>
      </div>
    )}

    {isLocked && (
      <div className="absolute -top-1 -right-1 bg-amber-400 text-black p-1 rounded-full shadow-lg">
        <Lock className="w-3 h-3" />
      </div>
    )}

    {symbol.type === 'wild' && !highlighted && !isLocked && (
      <div className="absolute top-0 right-0 p-1">
        <span className="text-[10px] bg-emerald-500 text-black px-1 font-bold rounded">WILD</span>
      </div>
    )}
  </motion.div>
);

const Reel = ({ 
  symbols, 
  isSpinning, 
  delay, 
  colIdx, 
  lockedPositions, 
  onToggleLock,
  isSymbolWinning
}: { 
  symbols: Symbol[]; 
  isSpinning: boolean; 
  delay: number; 
  colIdx: number;
  lockedPositions: Set<string>;
  onToggleLock: (col: number, row: number) => void;
  isSymbolWinning: (colIdx: number, rowIdx: number) => boolean;
  key?: React.Key 
}) => {
  const [displaySymbols, setDisplaySymbols] = useState(symbols);

  useEffect(() => {
    if (isSpinning) {
      const blurSymbols = Array(20).fill(null).map(() => getRandomSymbol());
      setDisplaySymbols([...blurSymbols, ...symbols]);
    } else {
      setDisplaySymbols(symbols);
    }
  }, [isSpinning, symbols]);

  return (
    <div className="relative flex-1 h-[240px] md:h-[360px] lg:h-[480px] overflow-hidden bg-black/60 rounded-2xl border-x border-white/5 mx-0.5">
      <AnimatePresence mode="popLayout">
        {isSpinning ? (
          <motion.div
            key="spinning"
            initial={{ y: 0 }}
            animate={{ y: [0, 25, -1500] }}
            transition={{ 
              duration: 1.8, 
              times: [0, 0.1, 1],
              ease: [0.45, 0.05, 0.55, 0.95],
              delay: delay / 1000 
            }}
            className="flex flex-col gap-3 p-3"
          >
            {displaySymbols.map((s, i) => (
              <SlotSymbol 
                key={`blur-${i}`} 
                symbol={s} 
                isLocked={lockedPositions.has(`${colIdx}-${(i - 20) % ROWS}`)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="stopped"
            initial={{ y: -100, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 12,
              mass: 1
            }}
            className="flex flex-col gap-3 p-3 h-full justify-between"
          >
            {symbols.map((s, i) => (
              <SlotSymbol 
                key={`final-${i}`} 
                symbol={s} 
                highlighted={isSymbolWinning(colIdx, i)}
                isLocked={lockedPositions.has(`${colIdx}-${i}`)}
                onToggleLock={() => onToggleLock(colIdx, i)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  // --- Game State ---
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('safari_slots_balance');
    return saved ? parseFloat(saved) : 1000;
  });
  const [bet, setBet] = useState(() => {
    const saved = localStorage.getItem('safari_slots_bet');
    const b = saved ? parseInt(saved) : 10;
    return Math.max(10, b);
  });
  const [grid, setGrid] = useState(generateGrid());
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [winType, setWinType] = useState<'none' | 'small' | 'big' | 'mega' | 'jackpot'>('none');
  const [winningLines, setWinningLines] = useState<number[]>([]);
  const [freeSpins, setFreeSpins] = useState(() => {
    const saved = localStorage.getItem('safari_slots_free_spins');
    return saved ? parseInt(saved) : 0;
  });
  const [totalFreeWin, setTotalFreeWin] = useState(() => {
    const saved = localStorage.getItem('safari_slots_total_free_win');
    return saved ? parseFloat(saved) : 0;
  });
  const [jackpot, setJackpot] = useState(() => {
    const saved = localStorage.getItem('safari_slots_jackpot');
    return saved ? parseFloat(saved) : 12500.50;
  });
  const [showJackpotWin, setShowJackpotWin] = useState(false);
  const [lockedPositions, setLockedPositions] = useState<Set<string>>(new Set());
  const [autoPlay, setAutoPlay] = useState(false);
  const [showAutoPlaySettings, setShowAutoPlaySettings] = useState(false);
  const [autoPlayConfig, setAutoPlayConfig] = useState(() => {
    const saved = localStorage.getItem('safari_slots_autoplay_config');
    return saved ? JSON.parse(saved) : { spins: 10, lossLimit: 0, winLimit: 0 };
  });
  const [sessionWinnings, setSessionWinnings] = useState(() => {
    const saved = localStorage.getItem('safari_slots_session_winnings');
    return saved ? parseFloat(saved) : 0;
  });
  const [activePaylines, setActivePaylines] = useState(() => {
    const saved = localStorage.getItem('safari_slots_active_lines');
    return saved ? parseInt(saved) : 20;
  });
  const [showPaylineDropdown, setShowPaylineDropdown] = useState(false);

  // --- Persistence Effect ---
  useEffect(() => {
    localStorage.setItem('safari_slots_balance', balance.toString());
    localStorage.setItem('safari_slots_bet', bet.toString());
    localStorage.setItem('safari_slots_free_spins', freeSpins.toString());
    localStorage.setItem('safari_slots_total_free_win', totalFreeWin.toString());
    localStorage.setItem('safari_slots_jackpot', jackpot.toString());
    localStorage.setItem('safari_slots_autoplay_config', JSON.stringify(autoPlayConfig));
    localStorage.setItem('safari_slots_session_winnings', sessionWinnings.toString());
    localStorage.setItem('safari_slots_active_lines', activePaylines.toString());
  }, [balance, bet, freeSpins, totalFreeWin, jackpot, autoPlayConfig, sessionWinnings, activePaylines]);
  const [sessionSpinsLeft, setSessionSpinsLeft] = useState(0);
  const [sessionStartingBalance, setSessionStartingBalance] = useState(0);

  const [muted, setMuted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // --- Ambient Sound Effect ---
  useEffect(() => {
    if (muted) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        playSound('ambient_safari', muted);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [muted]);

  // --- Logic ---

  const checkWins = useCallback((currentGrid: Symbol[][]) => {
    let totalWin = 0;
    const lines: number[] = [];

    PAYLINES.slice(0, activePaylines).forEach((line, index) => {
      const firstSymbol = currentGrid[0][line[0]];
      let matches = 1;

      for (let i = 1; i < COLS; i++) {
        const currentSymbol = currentGrid[i][line[i]];
        const targetSymbol = firstSymbol;

        if (
          currentSymbol.id === targetSymbol.id || 
          currentSymbol.type === 'wild' || 
          targetSymbol.type === 'wild'
        ) {
          matches++;
        } else {
          break;
        }
      }

      if (matches >= 3) {
        let valuedSymbol = firstSymbol;
        if (firstSymbol.type === 'wild') {
          for (let i = 0; i < matches; i++) {
            if (currentGrid[i][line[i]].type !== 'wild') {
              valuedSymbol = currentGrid[i][line[i]];
              break;
            }
          }
        }

        const payoutMultiplier = matches === 3 ? 1 : matches === 4 ? 5 : 20;
        const lineWin = valuedSymbol.value * payoutMultiplier * (bet / 10);
        totalWin += lineWin;
        lines.push(index);
      }
    });

    // Check Scatters
    let scatterCount = 0;
    currentGrid.forEach(col => col.forEach(sym => {
      if (sym.type === 'scatter') scatterCount++;
    }));

    if (scatterCount >= 3) {
      setFreeSpins(prev => prev + 10);
    }

    return { totalWin, lines };
  }, [bet, activePaylines]);

  const handleSpin = useCallback(() => {
    const lockCost = lockedPositions.size * 5;
    const lineBetMultiplier = activePaylines / 20;
    const totalStake = (bet * lineBetMultiplier) + lockCost;
    
    // Use the latest balance and freeSpins for the check
    if (isSpinning || (balance < totalStake && freeSpins === 0)) {
      setAutoPlay(false);
      return;
    }

    // Capture current state values needed for the setTimeout logic
    const currentLockedSize = lockedPositions.size;
    const currentFreeSpins = freeSpins;
    const currentMuted = muted;
    const currentGridState = grid;
    const currentJackpot = jackpot;

    setIsSpinning(true);
    setWinningLines([]);
    setLastWin(0);
    playSound('spin', currentMuted);

    if (currentFreeSpins === 0) {
      setBalance(prev => prev - totalStake);
      setSessionWinnings(prev => prev - totalStake);
      setJackpot(prev => prev + ((totalStake - (currentLockedSize * 5)) * 0.01)); 
      setTotalFreeWin(0);
    }

    const newGrid = Array(COLS).fill(null).map((_, colIdx) => 
      Array(ROWS).fill(null).map((_, rowIdx) => {
        if (lockedPositions.has(`${colIdx}-${rowIdx}`)) {
          return currentGridState[colIdx][rowIdx];
        }
        return getRandomSymbol();
      })
    );

    const completeSpin = () => {
      setGrid(newGrid);
      setIsSpinning(false);
      
      // Symbol-specific landing sounds
      newGrid.forEach((col, colIdx) => {
        setTimeout(() => {
          let soundToPlay: 'land_standard' | 'land_wild' | 'land_scatter' = 'land_standard';
          if (col.some(s => s.type === 'wild')) soundToPlay = 'land_wild';
          else if (col.some(s => s.type === 'scatter')) soundToPlay = 'land_scatter';
          playSound(soundToPlay, currentMuted);
        }, colIdx * REEL_DELAY);
      });

      setLockedPositions(new Set()); // Reset locks after spin
      
      const { totalWin, lines } = checkWins(newGrid);
      const finalWin = currentFreeSpins > 0 ? totalWin * 3 : totalWin;

      if (finalWin > 0) {
        setLastWin(finalWin);
        setWinningLines(lines);
        setBalance(prev => prev + finalWin);
        setSessionWinnings(prev => prev + finalWin);
        if (currentFreeSpins > 0) setTotalFreeWin(prev => prev + finalWin);
        
        if (finalWin >= totalStake * 20) {
          setWinType('mega');
          playSound('bigWin', currentMuted);
          confetti({
            particleCount: 200, spread: 90, origin: { y: 0.5 },
            colors: ['#fbbf24', '#ffffff', '#10b981', '#3b82f6']
          });
        } else if (finalWin >= totalStake * 5) {
          setWinType('big');
          playSound('bigWin', currentMuted);
          confetti({
            particleCount: 100, spread: 70, origin: { y: 0.6 },
            colors: ['#fbbf24', '#f59e0b']
          });
        } else {
          setWinType('small');
          playSound('win', currentMuted);
        }
        
        if (autoPlay && autoPlayConfig.winLimit > 0 && finalWin >= autoPlayConfig.winLimit) {
          setAutoPlay(false);
        }
      } else {
        setWinType('none');
        playSound('loss_thud', currentMuted);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
      }

      // Loss Limit Check
      if (autoPlay && autoPlayConfig.lossLimit > 0) {
        const currentLoss = sessionStartingBalance - (balance + finalWin - (currentFreeSpins > 0 ? 0 : totalStake));
        if (currentLoss >= autoPlayConfig.lossLimit) {
          setAutoPlay(false);
        }
      }

      if (autoPlay && sessionSpinsLeft > 0) {
        setSessionSpinsLeft(prev => {
          if (prev <= 1) setAutoPlay(false);
          return prev - 1;
        });
      }

      const isJackpotWin = Math.random() < 0.0005;
      if (isJackpotWin && currentFreeSpins === 0) {
        const jackpotWinAmount = currentJackpot;
        setBalance(prev => prev + jackpotWinAmount);
        setLastWin(jackpotWinAmount);
        setShowJackpotWin(true);
        setJackpot(10000.00); 
        playSound('bigWin', currentMuted);
        confetti({ particleCount: 300, spread: 100, origin: { y: 0.3 }, colors: ['#34d399', '#fbbf24', '#ffffff'] });
      }

      if (currentFreeSpins > 0) {
        setFreeSpins(prev => prev - 1);
      }
    };

    setTimeout(completeSpin, SPIN_DURATION + (REEL_DELAY * COLS));
  }, [isSpinning, balance, bet, activePaylines, lockedPositions, grid, freeSpins, jackpot, checkWins, muted, autoPlay, autoPlayConfig, sessionStartingBalance, sessionSpinsLeft]);

  const startAutoPlay = () => {
    setSessionSpinsLeft(autoPlayConfig.spins);
    setSessionStartingBalance(balance);
    setAutoPlay(true);
    setShowAutoPlaySettings(false);
  };

  const toggleLock = (col: number, row: number) => {
    if (isSpinning || freeSpins > 0) return;
    const key = `${col}-${row}`;
    setLockedPositions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (autoPlay && !isSpinning) {
      const timer = setTimeout(handleSpin, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, isSpinning, handleSpin]);

  // --- Render Helpers ---

  const isSymbolWinning = (colIdx: number, rowIdx: number) => {
    return winningLines.some(lineIdx => PAYLINES[lineIdx][colIdx] === rowIdx);
  };

  return (
    <div className="min-h-screen bg-[#0d1b1e] text-white flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      {/* Background with Theme Overlay */}
      <div className="fixed inset-0 bg-[#0d1b1e] pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.15)_0%,_transparent_70%)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 h-20 flex items-center justify-between px-6 md:px-10 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)] flex items-center justify-center border-2 border-emerald-300">
            <span className="text-2xl">🐾</span>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic text-emerald-400 leading-none">Wild Kingdom</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/50 mt-1">Premium Safari Slots</p>
          </div>
        </div>

        {/* Grand Jackpot Display */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 hidden lg:block">
          <motion.div 
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="px-8 py-2 bg-gradient-to-br from-neutral-900 to-black rounded-lg border-2 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)] text-center relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent shadow-[0_0_10px_#fbbf24]" />
            <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest leading-none mb-1 shadow-sm">Grand Jackpot</p>
            <p className="text-2xl font-mono font-black text-white tabular-nums">
              ${jackpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex gap-4 md:gap-6 items-center">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Session Net</span>
              <span className={`text-xl font-mono font-black tabular-nums ${sessionWinnings >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {sessionWinnings >= 0 ? '+' : '-'}${Math.abs(sessionWinnings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="hidden sm:block h-8 w-[1px] bg-white/10" />
            <div className="flex flex-col items-end bg-gradient-to-br from-yellow-500/10 to-transparent px-3 md:px-4 py-1.5 rounded-xl border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <span className="text-[9px] font-black text-yellow-200 uppercase tracking-[0.2em] mb-0.5 md:mb-1">Total Balance</span>
              <motion.span 
                key={balance}
                initial={{ scale: 1.1, color: '#fef08a' }}
                animate={{ scale: 1, color: '#fef9c3' }}
                className="text-lg md:text-2xl font-mono font-black tabular-nums drop-shadow-[0_0_10px_rgba(253,224,71,0.3)]"
              >
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </motion.span>
            </div>
          </div>
          <div className="flex gap-1 md:gap-2">
            <button 
              onClick={() => setMuted(!muted)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10"
            >
              {muted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10"
            >
              <Info className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 max-w-7xl mx-auto w-full">
        
        {/* Bonus Mode Indicator */}
        <AnimatePresence>
          {freeSpins > 0 && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="absolute right-8 top-0 bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4 w-48 text-center shadow-[0_0_30px_rgba(234,179,8,0.1)] hidden lg:block"
            >
              <p className="text-yellow-500 font-bold uppercase text-sm tracking-tighter italic">Bonus Mode</p>
              <p className="text-4xl font-black text-white">{freeSpins}</p>
              <p className="text-[10px] text-yellow-200/70 uppercase tracking-widest">Free Spins Left</p>
              <p className="text-xl font-bold text-yellow-300 mt-2">${totalFreeWin.toLocaleString()}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Machine */}
        <motion.div 
          animate={isShaking ? {
            x: [0, -5, 5, -5, 5, 0],
            y: [0, 2, -2, 2, -2, 0]
          } : {}}
          transition={{ duration: 0.25 }}
          className="relative p-2 md:p-4 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] border-4 border-neutral-700/50"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-yellow-500 to-emerald-500 opacity-20 blur-xl"></div>
          
          <div className="grid grid-cols-5 gap-1 md:gap-3 relative">
            <PaylineOverlay winningLines={winningLines} isSpinning={isSpinning} />
            {grid.map((col, i) => (
              <Reel 
                key={`reel-${i}`} 
                symbols={col} 
                isSpinning={isSpinning} 
                delay={i * REEL_DELAY} 
                colIdx={i}
                lockedPositions={lockedPositions}
                onToggleLock={toggleLock}
                isSymbolWinning={isSymbolWinning}
              />
            ))}
          </div>

          {/* Payline Indicators (Visual Decor) */}
          <div className="absolute left-[-15px] md:left-[-25px] top-1/2 -translate-y-1/2 flex flex-col gap-6 md:gap-10 pointer-events-none">
            <div className="w-3 md:w-5 h-3 md:h-5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
            <div className="w-3 md:w-5 h-3 md:h-5 rounded-full bg-red-500/30"></div>
            <div className="w-3 md:w-5 h-3 md:h-5 rounded-full bg-blue-500/30"></div>
          </div>
        </motion.div>

        {/* Ways to Win Banner */}
        <div className="mt-8 px-8 md:px-12 py-3 bg-white/5 rounded-full backdrop-blur-md border border-white/10 flex gap-4 md:gap-6 text-xs md:text-sm uppercase tracking-widest font-bold">
          <span className="text-emerald-400">{activePaylines} Paylines Active</span>
          <span className="text-white/20">|</span>
          <span className="text-yellow-400">Bonus x3 Multiplier</span>
        </div>
      </main>

      {/* Mobile Info Bar (Sticky above footer) */}
      <div className="md:hidden fixed bottom-32 left-0 right-0 px-4 pointer-events-none z-40">
        <div className="flex justify-between items-end gap-2">
          <motion.div 
            animate={lastWin > 0 ? { y: [0, -10, 0], scale: [1, 1.05, 1] } : {}}
            className="bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-yellow-500/30 flex-1"
          >
            <p className="text-[8px] uppercase tracking-widest text-white/40">Last Win</p>
            <p className="text-sm font-mono font-black text-yellow-400 tabular-nums">
              ${lastWin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </motion.div>
          
          <div className="bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-yellow-500/30 text-right flex-1">
            <p className="text-[8px] uppercase tracking-widest text-yellow-200/40">Total Balance</p>
            <p className="text-sm font-mono font-black text-white tabular-nums">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <footer className="relative z-10 h-32 bg-black/60 backdrop-blur-xl border-t border-white/5 px-6 md:px-10 flex items-center justify-between">
        <div className="flex gap-4 md:gap-10 items-center">
          <div className="flex flex-col">
            <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold">Bet</label>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setBet(b => Math.max(10, b - 10))}
                disabled={isSpinning}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-20"
              >
                -
              </button>
              <span className="text-xl font-mono font-bold min-w-[60px] text-center">${bet}</span>
              <button 
                onClick={() => setBet(b => Math.min(500, b + 10))}
                disabled={isSpinning}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-20"
              >
                +
              </button>
              <button 
                onClick={() => setBet(500)}
                disabled={isSpinning}
                className={`px-2 h-8 rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-[10px] font-black tracking-tighter hover:bg-emerald-500/20 transition-all ${bet === 500 ? 'bg-emerald-500 text-black border-emerald-500' : ''}`}
              >
                MAX
              </button>
            </div>
          </div>

          <div className="flex flex-col relative">
            <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold">Lines</label>
            <button
              onClick={() => !isSpinning && setShowPaylineDropdown(!showPaylineDropdown)}
              disabled={isSpinning}
              className={`h-8 px-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs font-black transition-all hover:bg-white/10 disabled:opacity-50 min-w-[80px] ${
                showPaylineDropdown ? 'border-blue-500/50 ring-2 ring-blue-500/20' : ''
              }`}
            >
              <span className="text-white">{activePaylines}</span>
              <ChevronDown className={`w-3 h-3 text-white/40 transition-transform duration-300 ${showPaylineDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showPaylineDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowPaylineDropdown(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: -4, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-2 w-full bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl p-1 z-50 overflow-hidden"
                  >
                    {[5, 10, 15, 20].map(l => (
                      <button
                        key={`line-opt-${l}`}
                        onClick={() => {
                          setActivePaylines(l);
                          setShowPaylineDropdown(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg text-left text-xs font-bold transition-all flex items-center justify-between group ${
                          activePaylines === l 
                            ? 'bg-blue-500 text-white' 
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {l} Lines
                        {activePaylines === l && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden lg:flex flex-col border-l border-white/10 pl-6">
            <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold">Total Bet</label>
            <span className="text-xl font-mono font-bold text-emerald-400 font-black">${(bet * (activePaylines / 20)) + (lockedPositions.size * 5)}</span>
          </div>
          
          <div className="hidden md:flex flex-col">
            <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold">Auto Play</label>
            <button 
              onClick={() => {
                if (autoPlay) setAutoPlay(false);
                else setShowAutoPlaySettings(true);
              }}
              className={`h-8 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                autoPlay 
                  ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                  : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}
            >
              {autoPlay ? (
                <>
                  <RotateCcw className="w-3 h-3 animate-spin" />
                  {sessionSpinsLeft} LEFT
                </>
              ) : 'OFF'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="h-20 w-20 rounded-full border-4 border-emerald-500/30 flex items-center justify-center relative">
            <button
              onClick={handleSpin}
              disabled={isSpinning || (balance < (bet * (activePaylines / 20)) && freeSpins === 0)}
              className={`
                h-16 w-16 rounded-full flex items-center justify-center transition-all relative overflow-hidden group
                ${(isSpinning || (balance < (bet * (activePaylines / 20)) && freeSpins === 0))
                  ? 'bg-emerald-900/50 text-white/30 cursor-not-allowed'
                  : 'bg-gradient-to-tr from-emerald-600 to-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-90 scale-100 hover:scale-105'
                }
              `}
            >
              {isSpinning ? (
                <RotateCcw className="w-6 h-6 animate-spin text-black" />
              ) : (
                <span className="font-black italic text-lg text-black">SPIN</span>
              )}
            </button>
          </div>
          {/* Debug buttons moved/removed for better UX */}
        </div>

        <div className="flex gap-2">
            <div className="hidden md:flex flex-col text-right mr-4">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{activePaylines} Lines</p>
              <p className="text-xs font-bold text-emerald-400">PAYLINE MODE</p>
            </div>
        </div>
      </footer>

      {/* Win Overlays */}
      <AnimatePresence>
        {winType !== 'none' && !isSpinning && !showJackpotWin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-40 bg-black/20"
          >
            {winType === 'small' && (
              <motion.div 
                initial={{ scale: 0.5, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-black/60 backdrop-blur-md px-8 py-3 rounded-2xl border border-white/20 shadow-xl"
              >
                <p className="text-white text-xs font-black uppercase tracking-widest text-center mb-1">Nice Win!</p>
                <p className="text-2xl font-black text-emerald-400 italic">+${lastWin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </motion.div>
            )}

            {winType === 'big' && (
              <motion.div 
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                className="bg-gradient-to-br from-yellow-400 to-orange-600 p-8 rounded-3xl shadow-[0_0_50px_rgba(251,191,36,0.5)] border-4 border-white"
              >
                <p className="text-sm font-black text-white text-center uppercase tracking-[0.3em] drop-shadow-md mb-2">Big Win!</p>
                <motion.p 
                  animate={{ scale: [1, 1.1, 1] }} 
                  transition={{ repeat: Infinity, duration: 0.4 }}
                  className="text-5xl md:text-7xl font-black text-white drop-shadow-xl tabular-nums italic"
                >
                  ${lastWin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </motion.p>
              </motion.div>
            )}

            {winType === 'mega' && (
              <motion.div 
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1.1, rotate: 0 }}
                className="flex flex-col items-center gap-4 bg-black/40 backdrop-blur-xl p-12 rounded-[3rem] border-2 border-emerald-500/50 shadow-[0_0_100px_rgba(16,185,129,0.3)]"
              >
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-400/40 to-emerald-500/0 rounded-full blur-3xl"
                  />
                  <Trophy className="w-24 h-24 text-yellow-400 fill-yellow-400 relative z-10 filter drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                </div>
                <div className="text-center">
                  <h3 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 italic uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(16,185,129,0.5)] mb-2">MEGA WIN</h3>
                  <motion.p 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                    className="text-6xl md:text-8xl font-black text-white italic drop-shadow-lg tabular-nums"
                  >
                    ${lastWin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </motion.p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jackpot Win Modal */}
      <AnimatePresence>
        {showJackpotWin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setShowJackpotWin(false)}
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 p-1 rounded-[3rem] shadow-[0_0_100px_rgba(234,179,8,0.5)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#1a1a1c] p-12 rounded-[2.8rem] flex flex-col items-center text-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-8xl mb-6"
                >
                  🏆
                </motion.div>
                <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 italic mb-2">GRAND JACKPOT!</h2>
                <p className="text-white/60 uppercase tracking-[0.3em] font-bold mb-8">Ultimate Safari Legend</p>
                
                <p className="text-7xl font-mono font-black text-white mb-10 tabular-nums">
                  ${lastWin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>

                <button 
                  onClick={() => setShowJackpotWin(false)}
                  className="w-full py-6 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black text-xl uppercase rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl"
                >
                  Claim My Prize
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto Play Settings Modal */}
      <AnimatePresence>
        {showAutoPlaySettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAutoPlaySettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1c] border border-white/10 p-8 rounded-[2rem] max-w-md w-full shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-black mb-6 text-emerald-400 italic">AUTO PLAY SETTINGS</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-3">Number of Spins</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 25, 50, 100].map(s => (
                      <button
                        key={`spins-${s}`}
                        onClick={() => setAutoPlayConfig(prev => ({ ...prev, spins: s }))}
                        className={`py-2 rounded-xl text-xs font-black transition-all border ${
                          autoPlayConfig.spins === s 
                            ? 'bg-emerald-500 border-emerald-400 text-black' 
                            : 'bg-white/5 border-white/10 text-white/60'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-3">Stop if Loss exceeds</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 100, 500, 1000].map(l => (
                      <button
                        key={`loss-${l}`}
                        onClick={() => setAutoPlayConfig(prev => ({ ...prev, lossLimit: l }))}
                        className={`py-2 rounded-xl text-xs font-black transition-all border ${
                          autoPlayConfig.lossLimit === l 
                            ? 'bg-emerald-500 border-emerald-400 text-black' 
                            : 'bg-white/5 border-white/10 text-white/60'
                        }`}
                      >
                        {l === 0 ? 'NEVER' : `$${l}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-3">Stop if Single Win exceeds</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 100, 500, 1000].map(w => (
                      <button
                        key={`win-lim-${w}`}
                        onClick={() => setAutoPlayConfig(prev => ({ ...prev, winLimit: w }))}
                        className={`py-2 rounded-xl text-xs font-black transition-all border ${
                          autoPlayConfig.winLimit === w 
                            ? 'bg-emerald-500 border-emerald-400 text-black' 
                            : 'bg-white/5 border-white/10 text-white/60'
                        }`}
                      >
                        {w === 0 ? 'NEVER' : `$${w}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button 
                  onClick={() => setShowAutoPlaySettings(false)}
                  className="py-4 bg-white/5 hover:bg-white/10 text-white/70 font-bold uppercase rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={startAutoPlay}
                  className="py-4 bg-emerald-500 text-black font-black uppercase rounded-2xl transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                >
                  Start Auto
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1c] border border-white/10 p-8 rounded-[2rem] max-w-2xl w-full shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-3xl font-black mb-6 text-emerald-400 italic">PAYTABLE & RULES</h2>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {SYMBOLS.map(s => {
                  const prob = (1 / SYMBOLS.length) * 100;
                  return (
                    <div key={s.id} className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2 relative group overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-mono text-emerald-400/60">{prob.toFixed(1)}%</span>
                      </div>
                      <span className="text-4xl">{s.emoji}</span>
                      <p className="text-[10px] font-bold text-white/40 uppercase">{s.label}</p>
                      <div className="w-full space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-white/40">5x</span>
                          <span className="text-emerald-400 font-bold">x{s.value * 20}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-white/40">4x</span>
                          <span className="text-emerald-400/80">x{s.value * 5}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-white/40">3x</span>
                          <span className="text-emerald-400/60">x{s.value * 1}</span>
                        </div>
                      </div>
                      {s.type === 'wild' && <p className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded w-full text-center">WILD</p>}
                      {s.type === 'scatter' && <p className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded w-full text-center">SCATTER</p>}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4 text-sm text-white/70">
                  <h3 className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2">Game Mechanics</h3>
                  <div className="flex gap-4">
                    <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
                    <p><span className="text-white font-bold">BONUS ROUND:</span> 3+ PAW symbols trigger 10 FREE SPINS. Wins are <span className="text-yellow-400 font-bold">3X TRIPLED</span>!</p>
                  </div>
                  <div className="flex gap-4">
                    <Play className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p><span className="text-white font-bold">WILD:</span> LION substitutes for symbols (except Scatter).</p>
                  </div>
                </div>

                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <h3 className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2">Hit Probabilities (per check)</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Any 3-of-a-kind', odds: '1 in 585' },
                      { label: 'Any 4-of-a-kind', odds: '1 in 4,681' },
                      { label: 'Any 5-of-a-kind', odds: '1 in 32,768' },
                      { label: 'Grand Jackpot', odds: '1 in 2,000 spins' },
                    ].map(stat => (
                      <div key={stat.label} className="flex justify-between items-center text-xs font-mono">
                        <span className="text-white/40">{stat.label}</span>
                        <span className="text-white font-bold">{stat.odds}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowInfo(false)}
                className="mt-8 w-full py-4 bg-emerald-500 text-black font-black uppercase rounded-2xl transition-all hover:bg-emerald-400"
              >
                Return to Safari
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
