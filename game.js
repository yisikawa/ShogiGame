import {
    BOARD_SIZE,
    INITIAL_BOARD,
    PIECE_NAMES,
    PLAYER,
    AI_LEVEL,
    AI_THINKING_TIME,
    UI_UPDATE_DELAY,
    initializeConfig
} from './constants.js';
import { loadConfig } from './config.js';
import { ShogiBoard } from './board.js';
import { ShogiRules } from './rules.js';
import { ShogiUI } from './ui.js';
import { ShogiAI } from './ai.js';

export class ShogiGame {
    constructor() {
        this.board = new ShogiBoard();
        this.appBoard = this.board;// Alias for AI compatibility
        this.rules = new ShogiRules(this.board);
        this.ui = new ShogiUI(this);

        this.currentTurn = PLAYER.SENTE;
        this.selectedCell = null;
        this.selectedCapturedPiece = null;

        // AI & USI Configuration
        this.aiLevelSente = AI_LEVEL.HUMAN;
        this.aiLevelGote = AI_LEVEL.HUMAN;
        this.aiSente = null;
        this.aiGote = null;
        this.aiInProgress = false;
        this.aiStopped = false;
        this.aiMovePromise = null;
        this.aiMoveTimeout = null;

        // Game State
        this.gameStarted = false;
        this.gameOver = false;
        this.winner = null;
        this.pendingPromotion = null;

        // History
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.isReplaying = false;
        this.positionHistory = [];
        this.checkHistory = [];


        this.init();
    }

    init() {
        this.reset();
    }

    reset() {
        this.gameStarted = true;
        this.cleanupAIMove();
        this.aiMovePromise = null;

        // Fix: Actually update the board state
        this.board.board = this.board.initializeBoard();
        this.board.capturedPieces = {
            [PLAYER.SENTE]: [],
            [PLAYER.GOTE]: []
        };

        this.currentTurn = PLAYER.SENTE;
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.pendingPromotion = null;
        this.gameOver = false;
        this.winner = null;

        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.isReplaying = false;
        this.positionHistory = [];
        this.checkHistory = [];

        // Load AI Settings via UI
        const senteConfig = this.ui.getAIConfig(PLAYER.SENTE);
        const goteConfig = this.ui.getAIConfig(PLAYER.GOTE);

        this.aiLevelSente = senteConfig.level;
        this.aiLevelGote = goteConfig.level;

        this.ui.updateAIConfigVisibility(PLAYER.SENTE, this.aiLevelSente);
        this.ui.updateAIConfigVisibility(PLAYER.GOTE, this.aiLevelGote);

        this.aiSente = this.createAI(PLAYER.SENTE);
        this.aiGote = this.createAI(PLAYER.GOTE);

        this.initializeUSIEngines();

        this.updateUI();

        if (this.ui.hideAIThinking) this.ui.hideAIThinking();
        if (this.ui.hidePromoteModal) this.ui.hidePromoteModal();
        if (this.ui.exitReplayMode) this.ui.exitReplayMode();

        if (this.isAITurn()) {
            this.cleanupAIMove();
            setTimeout(() => {
                if (!this.gameOver && !this.isReplaying) {
                    this.checkAndMakeAIMove();
                }
            }, UI_UPDATE_DELAY * 2);
        }
    }


    // --- Interaction Handlers (Called by UI) ---

    handleCellClick(row, col) {
        if (!this.gameStarted || this.gameOver || this.isReplaying) return;
        if (this.isAITurn()) return;

        const piece = this.board.getPiece(row, col);
        const isMyPiece = piece && this.rules.isPlayerPiece(piece, this.currentTurn);

        if (isMyPiece) {
            this.selectedCell = [row, col];
            this.selectedCapturedPiece = null;
            const possibleMoves = this.rules.getPossibleMoves(row, col, this.currentTurn);
            this.ui.highlightMoves(possibleMoves, this.selectedCell);
            return;
        }

        if (this.selectedCell) {
            const [fromRow, fromCol] = this.selectedCell;
            const possibleMoves = this.rules.getPossibleMoves(fromRow, fromCol, this.currentTurn);
            const canMove = possibleMoves.some(([r, c]) => r === row && c === col);

            if (canMove) {
                this.movePiece(fromRow, fromCol, row, col);
                return;
            }
        }

        if (this.selectedCapturedPiece) {
            if (this.canDropPiece(this.selectedCapturedPiece.piece, row, col)) {
                this.dropPiece(this.selectedCapturedPiece.piece, row, col);
                return;
            }
        }

        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.ui.highlightMoves([], null);
    }

    handleCapturedPieceClick(piece, player) {
        if (!this.gameStarted || player !== this.currentTurn || this.gameOver || this.isAITurn()) return;

        if (this.selectedCapturedPiece &&
            this.selectedCapturedPiece.piece === piece &&
            this.selectedCapturedPiece.player === player) {
            this.selectedCapturedPiece = null;
        } else {
            this.selectedCapturedPiece = { piece, player };
            this.selectedCell = null;
        }

        this.updateUI();
    }

    handlePromotionChoice(promote) {
        if (this.pendingPromotion) {
            const { fromRow, fromCol, toRow, toCol, piece } = this.pendingPromotion;
            this.movePiece(fromRow, fromCol, toRow, toCol, promote);
            this.ui.hidePromoteModal();
            this.pendingPromotion = null;
        }
    }

    // --- AI Config Handlers ---
    handleAILevelChange(player, level) {
        if (player === PLAYER.SENTE) this.aiLevelSente = level;
        else this.aiLevelGote = level;

        this.ui.updateAIConfigVisibility(player, level);

        if (player === PLAYER.SENTE) this.aiSente = this.createAI(PLAYER.SENTE);
        else this.aiGote = this.createAI(PLAYER.GOTE);
    }

    handleOllamaModelChange(player, value) {
        // Just recreate AI with new config
        if (player === PLAYER.SENTE) this.aiSente = this.createAI(PLAYER.SENTE);
        else this.aiGote = this.createAI(PLAYER.GOTE);
    }

    handleUSIUrlChange(player, value) {
        // Just recreate AI with new config, logic handles fetching from UI
        if (player === PLAYER.SENTE) this.aiSente = this.createAI(PLAYER.SENTE);
        else this.aiGote = this.createAI(PLAYER.GOTE);
    }

    // --- Game Logic ---

    movePiece(fromRow, fromCol, toRow, toCol, promote = null) {
        const piece = this.board.getPiece(fromRow, fromCol);
        const captured = this.board.getPiece(toRow, toCol);

        if (promote === null) {
            const canPromote = this.rules.canPromote(piece, fromRow, toRow);
            if (canPromote && !piece.includes('+') && piece.toLowerCase() !== 'k' && piece.toLowerCase() !== 'g') {
                if (!this.isAITurn()) {
                    this.pendingPromotion = { fromRow, fromCol, toRow, toCol, piece };
                    this.ui.showPromoteModal(piece);
                    return;
                }
                if (this.rules.shouldAIPromote(piece, toRow)) {
                    promote = true;
                }
            }
        }

        this.board.capturePiece(captured, this.currentTurn);
        this.board.setPiece(toRow, toCol, (promote === true) ? '+' + piece : piece);
        this.board.setPiece(fromRow, fromCol, null);

        if (captured && captured.replace('+', '').toLowerCase() === 'k') {
            this.finishGame(this.currentTurn);
            return;
        }

        if (!this.isReplaying) {
            this.recordMove({
                type: 'move', fromRow, fromCol, toRow, toCol,
                piece: piece,
                promoted: (promote === true),
                captured: captured ? captured.replace('+', '') : null
            });
        }

        this.postMoveProcessing();
    }

    dropPiece(piece, row, col) {
        if (!this.canDropPiece(piece, row, col)) return false;

        this.board.setPiece(row, col, this.currentTurn === PLAYER.SENTE ? piece.toUpperCase() : piece.toLowerCase());
        this.board.removeCapturedPiece(piece, this.currentTurn);

        if (!this.isReplaying) {
            this.recordMove({
                type: 'drop', piece: piece, toRow: row, toCol: col
            });
        }

        this.postMoveProcessing();
        return true;
    }

    postMoveProcessing() {
        this.switchTurn();
        this.updateUI();

        if (!this.isReplaying) {
            this.recordPosition();
        }

        if (!this.gameOver) {
            this.checkRepetition();
            const result = this.rules.checkGameEnd(this.currentTurn);
            if (result.gameOver) {
                this.winner = result.winner;
                this.finishGame(this.winner);
                return;
            }

            setTimeout(() => {
                this.checkAndMakeAIMove();
            }, UI_UPDATE_DELAY);
        }
    }

    switchTurn() {
        this.currentTurn = this.currentTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
    }

    canDropPiece(piece, row, col) {
        return this.rules.canDropPiece(piece, row, col, this.currentTurn);
    }

    // --- History & State ---

    recordMove(moveData) {
        const moveRecord = Object.assign({}, moveData, {
            turn: this.currentTurn,
            capturedPiecesBefore: {
                sente: [...this.board.capturedPieces.sente],
                gote: [...this.board.capturedPieces.gote]
            }
        });
        this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        this.moveHistory.push(moveRecord);
        this.currentMoveIndex = this.moveHistory.length - 1;
    }

    recordPosition() {
        const posKey = this.getPositionKey();
        const isGivingCheck = this.rules.isInCheck(this.currentTurn);
        this.positionHistory.push({ key: posKey, turn: this.currentTurn, isCheck: isGivingCheck });
        this.checkHistory.push(isGivingCheck);
    }

    getPositionKey() {
        return `${this.board.toKey()}|${this.currentTurn}`;
    }

    checkRepetition() {
        const lastPos = this.positionHistory[this.positionHistory.length - 1];
        if (!lastPos) return;

        const currentKey = lastPos.key;
        const count = this.positionHistory.filter(pos => pos.key === currentKey).length;

        if (count >= 4) {
            // 連続王手の千日手判定（簡易実装：自分が王手している状態が続いているか）
            // 厳密には、同一局面が現れる"過程のすべて"で王手をかけていた側が負け
            // ここでは簡易的に、4回目の局面でチェック履歴を確認する
            // 直近の履歴から、自分(の手番で終わった局面前)が王手していたかを確認する必要があるが、
            // checkRepetitionはmovePiece(手番交代)後に呼ばれるため、
            // this.currentTurnは「手番を持っている側（これから指す側）」
            // 千日手が成立したのは「今指し終わった側(prevTurn)」の指し手による。

            // 簡易的に引分とする
            this.finishGame(null, '千日手');
        }
    }

    finishGame(winner, reason) {
        this.gameOver = true;
        this.winner = winner;
        this.ui.showReplayMode(); // Includes showGameEndMessage(winner)
    }

    updateUI() {
        this.ui.renderBoard(this.board);
        this.ui.updateTurnIndicator(this.currentTurn);
        this.ui.updateCapturedPieces(this.board.capturedPieces, this.selectedCapturedPiece);
        this.ui.updateMoveControls(this.currentMoveIndex, this.moveHistory.length);
        this.ui.updateMoveHistoryDisplay(this.moveHistory, this.currentMoveIndex);

        if (this.selectedCapturedPiece) {
            const drops = [];
            for (let r = 0; r < BOARD_SIZE; r++)
                for (let c = 0; c < BOARD_SIZE; c++)
                    if (this.canDropPiece(this.selectedCapturedPiece.piece, r, c))
                        drops.push([r, c]);
            this.ui.highlightDropPositions(drops);
        }
    }

    // --- AI Integration ---

    createAI(player) {
        const config = this.ui.getAIConfig(player);
        return new ShogiAI(config.level, config.ollamaEndpoint, config.ollamaModel, config.usiUrl);
    }

    isAITurn() {
        const level = this.currentTurn === PLAYER.SENTE ? this.aiLevelSente : this.aiLevelGote;
        return level !== AI_LEVEL.HUMAN;
    }

    getCurrentAI() {
        return this.currentTurn === PLAYER.SENTE ? this.aiSente : this.aiGote;
    }

    cleanupAIMove() {
        this.aiInProgress = false;
        // Logic to stop AI if needed
    }

    checkAndMakeAIMove() {
        if (!this.gameStarted || this.aiInProgress || !this.isAITurn() || this.gameOver) return;

        this.aiInProgress = true;
        this.ui.showAIThinking();

        const ai = this.getCurrentAI();
        const turn = this.currentTurn;

        setTimeout(async () => {
            try {
                let move;
                if (ai.level === AI_LEVEL.OLLAMA || ai.level === AI_LEVEL.USI) {
                    move = await ai.getBestMoveAsync(this, turn);
                } else {
                    move = ai.getBestMove(this, turn);
                }

                if (move) {
                    if (move.type === 'move') {
                        this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promoted);
                    } else {
                        this.dropPiece(move.piece, move.toRow, move.toCol);
                    }
                } else {
                    this.finishGame(turn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE);
                }
            } catch (e) {
                console.error("AI Error", e);
            } finally {
                this.aiInProgress = false;
                this.ui.hideAIThinking();
            }
        }, 100);
    }

    // --- USI Support ---
    initializeUSIEngines() {
        [PLAYER.SENTE, PLAYER.GOTE].forEach(player => {
            const ai = player === PLAYER.SENTE ? this.aiSente : this.aiGote;
            if (ai && ai.level === AI_LEVEL.USI) {
                // Set callback to receive engine name and update UI
                ai.setEngineNameCallback((name, author) => {
                    this.ui.updateEngineName(player, name, author);
                });

                // Initialize USI engine if needed (this connects and sends usi command)
                if (ai.usiClient && !ai.usiClient.engineReady) {
                    ai.usiClient.initialize().catch(err => {
                        console.error(`[USI Init Error ${player}]`, err);
                    });
                }
            }
        });
    }

    // --- Kifu Methods ---
    loadKifu(kifuData) {
        if (kifuData) {
            this.moveHistory = kifuData.moves || [];
            this.currentMoveIndex = -1;
            this.restoreFromHistory(-1);
        }
    }

    restoreFromHistory(index) {
        this.board.initializeBoard();
        this.currentTurn = PLAYER.SENTE;
        this.gameOver = false;
        this.ui.exitReplayMode(); // Clear "win" messages temporarily

        // Replay moves up to index
        // This is tricky because we need to update state without recursion/animation
        // Just execute logically
        const targetMoves = this.moveHistory.slice(0, index + 1);

        // We can't reuse movePiece/dropPiece easily because they trigger UI/AI
        // We need a "quiet" move execution or just set state
        // Refactoring: board.js allows setting pieces.
        // It's safer to re-execute logic to handle captures properly

        // Actually, we can reuse but need to suppress UI/AI
        this.isReplaying = true; // suppresses recording and AI

        targetMoves.forEach(m => {
            if (m.type === 'move') {
                // Logic from movePiece but stripped? 
                // Or just use movePiece? movePiece checks validity etc.
                // Ideally we trust history.
                // Let's manually apply on board to be fast.
                if (m.captured) this.board.capturePiece(m.captured, m.turn); // Need to 'un-capture' or 'capture'?
                // Wait, capturePiece adds to hand.
                // In restore, we act as if playing.

                // However, we are replaying from START.
                const p = this.board.getPiece(m.fromRow, m.fromCol);
                // If p is null, history is broken or logic is wrong.
                if (p) {
                    const captured = this.board.getPiece(m.toRow, m.toCol);
                    if (captured) this.board.capturePiece(captured, m.turn);

                    const newPiece = m.promoted ? (p.startsWith('+') ? p : '+' + p) : p; // Ensure promotion logic matches record
                    this.board.setPiece(m.toRow, m.toCol, newPiece);
                    this.board.setPiece(m.fromRow, m.fromCol, null);
                }
            } else {
                // Drop
                this.board.setPiece(m.toRow, m.toCol, m.turn === PLAYER.SENTE ? m.piece.toUpperCase() : m.piece.toLowerCase());
                this.board.removeCapturedPiece(m.piece, m.turn);
            }
            this.currentTurn = m.turn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
        });

        this.currentMoveIndex = index;

        // Re-enable "Replay Mode" UI
        this.updateUI();
        this.ui.showReplayMode();
    }

    goToPreviousMove() { if (this.currentMoveIndex >= -1) this.restoreFromHistory(this.currentMoveIndex - 1); }
    goToNextMove() { if (this.currentMoveIndex < this.moveHistory.length - 1) this.restoreFromHistory(this.currentMoveIndex + 1); }
    goToFirstMove() { this.restoreFromHistory(-1); }
    goToLastMove() { this.restoreFromHistory(this.moveHistory.length - 1); }
    exitReplayMode() { this.isReplaying = false; this.ui.exitReplayMode(); this.updateUI(); }
    exitGame() { this.gameStarted = false; this.updateUI(); /* Show title? */ }

    // Helpers
    getAllPossibleMoves(turn) { return this.rules.getAllPossibleMoves(turn); }
    isSente(piece) { return this.rules.isSente(piece); }
    isGote(piece) { return this.rules.isGote(piece); }
}

// Start the game
// Ensure DOM is ready and expose to window for debugging
document.addEventListener('DOMContentLoaded', async () => {
    // コンフィグを読み込む
    try {
        const config = await loadConfig();
        
        // HTMLの初期値を設定
        const ollamaModelSente = document.getElementById('ollamaModelSente');
        const ollamaModelGote = document.getElementById('ollamaModelGote');
        const usiServerUrlSente = document.getElementById('usiServerUrlSente');
        const usiServerUrlGote = document.getElementById('usiServerUrlGote');
        
        if (ollamaModelSente) {
            ollamaModelSente.value = config.ollama.model;
            ollamaModelSente.placeholder = config.ollama.model;
        }
        if (ollamaModelGote) {
            ollamaModelGote.value = config.ollama.model;
            ollamaModelGote.placeholder = config.ollama.model;
        }
        if (usiServerUrlSente) {
            usiServerUrlSente.value = config.usi.serverUrl;
            usiServerUrlSente.placeholder = config.usi.serverUrl;
        }
        if (usiServerUrlGote) {
            usiServerUrlGote.value = config.usi.serverUrl;
            usiServerUrlGote.placeholder = config.usi.serverUrl;
        }
        
        // コンフィグを初期化
        await initializeConfig();
    } catch (error) {
        console.error('Failed to load config:', error);
        // エラーが発生してもデフォルト値で続行
        await initializeConfig();
    }
    
    // ゲームを初期化
    if (!window.game) {
        window.game = new ShogiGame();
        // start() is not a method, init() is called in constructor which calls reset() setting gameStarted=true
    }
});
