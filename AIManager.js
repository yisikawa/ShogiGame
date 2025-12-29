import {
    PLAYER,
    AI_LEVEL,
    OLLAMA_CONFIG,
    AI_THINKING_TIME
} from './constants.js';
import { log } from './utils.js';

/**
 * 将棋ゲームのAI管理クラス
 */
export class AIManager {
    constructor(game) {
        this.game = game;
        this.aiInProgress = false;
        this.aiStopped = false;
        this.aiMovePromise = null;
        this.aiMoveTimeout = null;
    }

    /**
     * AIインスタンスを作成
     */
    createAI(player) {
        const isSente = player === PLAYER.SENTE;
        const aiLevel = isSente ? this.game.aiLevelSente : this.game.aiLevelGote;

        if (aiLevel === AI_LEVEL.HUMAN) {
            return null;
        }

        let ollamaModel = OLLAMA_CONFIG.MODEL;
        if (isSente) {
            const ollamaModelInput = document.getElementById('ollamaModelSente');
            if (ollamaModelInput && ollamaModelInput.value.trim()) {
                ollamaModel = ollamaModelInput.value.trim();
            }
        } else {
            const ollamaModelInput = document.getElementById('ollamaModelGote');
            if (ollamaModelInput && ollamaModelInput.value.trim()) {
                ollamaModel = ollamaModelInput.value.trim();
            }
        }

        let usiServerUrl = 'http://localhost:8080';
        if (isSente) {
            const usiServerUrlInput = document.getElementById('usiServerUrlSente');
            if (usiServerUrlInput && usiServerUrlInput.value.trim()) {
                usiServerUrl = usiServerUrlInput.value.trim();
            }
        } else {
            const usiServerUrlInput = document.getElementById('usiServerUrlGote');
            if (usiServerUrlInput && usiServerUrlInput.value.trim()) {
                usiServerUrl = usiServerUrlInput.value.trim();
            }
        }

        return new this.game.ShogiAI(aiLevel, null, ollamaModel, usiServerUrl);
    }

    /**
     * USIエンジンを初期化し、新しいゲームを開始する
     */
    async initializeUSIEngines() {
        if (this.game.aiSente && this.game.aiSente.level === AI_LEVEL.USI) {
            await this.initializeSingleUSIEngine(this.game.aiSente.usiClient, '先手');
        }
        if (this.game.aiGote && this.game.aiGote.level === AI_LEVEL.USI) {
            await this.initializeSingleUSIEngine(this.game.aiGote.usiClient, '後手');
        }
    }

    /**
     * 単一のUSIエンジンを初期化
     */
    async initializeSingleUSIEngine(usiClient, name) {
        if (!usiClient) return;

        try {
            const connected = await usiClient.connect();
            if (connected) {
                this.game.ui.log('info', `${name} USIエンジン初期化開始...`);
                // 初期化を実行（内部でエンジン名を取得）
                try {
                    await usiClient.initialize();
                } catch (e) {
                    this.game.ui.log('warn', `${name} USI初期化中にエラーが発生しましたが、続行を試みます: ${e.message}`);
                }

                // エンジン名が取得できていれば表示を更新
                if (usiClient.engineName) {
                    this.game.ui.setUSIEngineName(name, usiClient.engineName, usiClient.serverUrl);
                    this.game.ui.log('success', `${name} USIエンジン名表示更新: ${usiClient.engineName}`);
                } else {
                    this.game.ui.log('warn', `${name} USIエンジン名が未取得です`);
                }

                // 準備完了していればニューゲームを送信
                if (usiClient.engineReady) {
                    await usiClient.newGame();
                }
            }
        } catch (error) {
            this.game.ui.log('error', `${name} USI初期化エラー`, { message: error.message, stack: error.stack });
        }
    }

    /**
     * Ollamaモデルが利用可能か確認
     */
    async checkOllamaModel(modelName, playerName) {
        try {
            const response = await fetch(`${OLLAMA_CONFIG.ENDPOINT}/api/tags`);
            if (!response.ok) throw new Error('Ollamaサーバーに接続できません');

            const data = await response.json();
            const models = data.models || [];
            const exists = models.some(m => m.name === modelName || m.name.startsWith(modelName + ':'));

            if (!exists) {
                this.game.ui.log('warn', `${playerName}のモデル ${modelName} が見つかりません。`);
                if (confirm(`${playerName}のモデル ${modelName} が見つかりません。ダウンロード（pull）を開始しますか？\n(時間がかかる場合があります)`)) {
                    this.pullOllamaModel(modelName, playerName);
                }
            } else {
                this.game.ui.log('info', `${playerName}のモデル ${modelName} は利用可能です。`);
            }
        } catch (error) {
            this.game.ui.log('error', `Ollama接続エラー`, { message: error.message });
        }
    }

    /**
     * Ollamaモデルをプル
     */
    async pullOllamaModel(modelName, playerName) {
        try {
            this.game.ui.log('info', `${playerName}のモデル ${modelName} をプルしています...`);
            const response = await fetch(`${OLLAMA_CONFIG.ENDPOINT}/api/pull`, {
                method: 'POST',
                body: JSON.stringify({ name: modelName })
            });
            if (response.ok) {
                this.game.ui.log('info', `${playerName}のモデル ${modelName} のプルを開始しました。`);
            }
        } catch (error) {
            this.game.ui.log('error', `Ollamaプルエラー`, { message: error.message });
        }
    }

    /**
     * 現在の手番に応じたAIインスタンスを取得
     */
    getCurrentAI() {
        return this.game.currentTurn === PLAYER.SENTE ? this.game.aiSente : this.game.aiGote;
    }

    /**
     * AIのターンかどうか
     */
    isAITurn() {
        const currentAILevel = this.game.currentTurn === PLAYER.SENTE ? this.game.aiLevelSente : this.game.aiLevelGote;
        return currentAILevel !== AI_LEVEL.HUMAN;
    }

    /**
     * AIの手を打つ
     */
    checkAndMakeAIMove() {
        if (!this.game.gameStarted || this.aiInProgress || this.aiMovePromise || !this.isAITurn() || this.game.gameOver || this.game.isReplaying) {
            return;
        }

        if (this.aiStopped) {
            this.game.ui.log('warn', 'AI停止中のためスキップ');
            return;
        }

        this.aiInProgress = true;
        this.game.ui.showAIThinking();

        const currentAI = this.getCurrentAI();
        if (!currentAI) {
            this.cleanupAIMove();
            return;
        }

        const currentTurn = this.game.currentTurn;
        const playerName = currentTurn === PLAYER.SENTE ? '先手' : '後手';

        if (currentAI.level === AI_LEVEL.OLLAMA || currentAI.level === AI_LEVEL.USI) {
            this.aiMovePromise = currentAI.getBestMoveAsync(this.game, currentTurn)
                .then(move => {
                    if (this.game.gameOver || this.game.isReplaying || this.game.currentTurn !== currentTurn) {
                        this.cleanupAIMove();
                        return;
                    }

                    if (move) {
                        this.aiInProgress = false;
                        this.game.ui.hideAIThinking();

                        if (move.type === 'move') {
                            this.game.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
                        } else if (move.type === 'drop') {
                            this.game.dropPiece(move.piece, move.toRow, move.toCol);
                        }
                    } else {
                        this.cleanupAIMove();
                    }
                })
                .catch(error => {
                    this.game.ui.log('error', `AI手取得エラー`, { message: error.message });
                    this.cleanupAIMove();
                    if (currentAI.level === AI_LEVEL.USI && error.message && error.message.includes('エンジン')) {
                        this.aiStopped = true;
                    }
                })
                .finally(() => {
                    this.aiMovePromise = null;
                });
        } else {
            const thinkingTime = AI_THINKING_TIME.MIN + Math.random() * (AI_THINKING_TIME.MAX - AI_THINKING_TIME.MIN);
            this.aiMoveTimeout = setTimeout(() => {
                if (this.game.gameOver || this.game.isReplaying || this.game.currentTurn !== currentTurn) {
                    this.cleanupAIMove();
                    return;
                }

                const move = currentAI.getBestMove(this.game, currentTurn);
                if (move) {
                    this.aiInProgress = false;
                    this.game.ui.hideAIThinking();

                    if (move.type === 'move') {
                        this.game.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
                    } else if (move.type === 'drop') {
                        this.game.dropPiece(move.piece, move.toRow, move.toCol);
                    }
                } else {
                    this.cleanupAIMove();
                }
            }, thinkingTime);
        }
    }

    /**
     * AI思考のクリーンアップ
     */
    cleanupAIMove() {
        this.game.ui.hideAIThinking();
        this.aiInProgress = false;
        if (this.aiMoveTimeout) {
            clearTimeout(this.aiMoveTimeout);
            this.aiMoveTimeout = null;
        }
    }
}
