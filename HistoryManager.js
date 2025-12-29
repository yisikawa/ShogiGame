import {
    BOARD_SIZE,
    INITIAL_BOARD,
    PLAYER
} from './constants.js';

/**
 * 将棋ゲームの履歴・棋譜管理クラス
 */
export class HistoryManager {
    constructor(game) {
        this.game = game;
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.positionHistory = []; // 局面履歴（千日手判定用）
        this.checkHistory = []; // 王手履歴（連続王手の千日手判定用）
        this.pendingKifuData = null; // プレビュー中の棋譜データ
    }

    /**
     * 手を記録
     */
    recordMove(moveData) {
        const moveRecord = Object.assign({}, moveData, {
            turn: this.game.currentTurn,
            capturedPiecesBefore: {
                sente: this.game.capturedPieces.sente.slice(),
                gote: this.game.capturedPieces.gote.slice()
            }
        });

        // 現在の位置より後ろの手を削除（分岐を削除）
        this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        this.moveHistory.push(moveRecord);
        this.currentMoveIndex = this.moveHistory.length - 1;

        this.game.ui.updateMoveHistoryDisplay();
    }

    /**
     * 局面を文字列化（千日手判定用）
     */
    getPositionKey() {
        let boardStr = '';
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                boardStr += (this.game.board[row][col] || '.');
            }
        }

        const senteCaptured = [...this.game.capturedPieces.sente].sort().join('');
        const goteCaptured = [...this.game.capturedPieces.gote].sort().join('');

        return `${boardStr}|${senteCaptured}|${goteCaptured}|${this.game.currentTurn}`;
    }

    /**
     * 局面を記録
     */
    recordPosition() {
        const positionKey = this.getPositionKey();
        const isGivingCheck = this.game.isInCheck(this.game.currentTurn);

        this.positionHistory.push({
            key: positionKey,
            turn: this.game.currentTurn,
            isCheck: isGivingCheck
        });

        this.checkHistory.push(isGivingCheck);
    }

    /**
     * 千日手判定
     */
    checkRepetition() {
        if (this.positionHistory.length < 4) return;

        const recentPositions = this.positionHistory.slice(-4);
        const firstKey = recentPositions[0].key;
        const allSame = recentPositions.every(pos => pos.key === firstKey);

        if (allSame) {
            const recentChecks = this.checkHistory.slice(-4);
            const isContinuousCheck = recentChecks.every(check => check === true);

            if (isContinuousCheck) {
                const lastTurn = this.game.currentTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
                this.game.gameOver = true;
                this.game.winner = this.game.currentTurn;
                this.game.ui.showRepetitionMessage('連続王手の千日手', lastTurn);
                this.game.ui.showReplayMode();
            } else {
                this.game.gameOver = true;
                this.game.winner = null;
                this.game.ui.showRepetitionMessage('千日手', null);
                this.game.ui.showReplayMode();
            }
        }
    }

    /**
     * 棋譜から状態を復元
     */
    restoreFromHistory(targetIndex) {
        this.game.isReplaying = true;

        // 初期状態に戻す
        this.game.board = this.game.initializeBoard();
        this.game.capturedPieces = { sente: [], gote: [] };
        this.game.currentTurn = PLAYER.SENTE;
        this.game.gameOver = false;
        this.game.winner = null;

        // 指定された手まで再生
        for (let i = 0; i <= targetIndex && i < this.moveHistory.length; i++) {
            const move = this.moveHistory[i];
            if (move.type === 'move') {
                this.game.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promoted);
            } else if (move.type === 'drop') {
                this.game.dropPiece(move.piece, move.toRow, move.toCol);
            }
        }

        this.game.isReplaying = false;
        this.currentMoveIndex = targetIndex;
        this.game.ui.updateMoveHistoryDisplay();
        this.game.ui.updateMoveControls();
    }

    /**
     * 棋譜をJSONデータに変換
     */
    exportKifuToJSON() {
        return JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            winner: this.game.winner,
            moves: this.moveHistory,
            initialBoard: INITIAL_BOARD.map(row => [...row])
        }, null, 2);
    }

    /**
     * 棋譜をダウンロード
     */
    downloadKifu() {
        if (this.moveHistory.length === 0) {
            alert('棋譜がありません');
            return;
        }

        const jsonData = this.exportKifuToJSON();
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shogi-kifu-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 棋譜をプレビュー
     */
    async previewKifuData(file) {
        try {
            const text = await file.text();
            const kifuData = JSON.parse(text);

            if (!kifuData.moves || !Array.isArray(kifuData.moves)) {
                throw new Error('無効な棋譜ファイルです');
            }

            this.pendingKifuData = kifuData;
            this.game.ui.showKifuDataInfo(kifuData);

            setTimeout(() => {
                this.game.ui.showKifuDataList(kifuData.moves);
            }, 10);
        } catch (error) {
            this.game.ui.log('error', '棋譜読み込みエラー', { message: error.message });
            alert('棋譜ファイルの読み込みに失敗しました: ' + error.message);
        }
    }

    /**
     * プレビューから棋譜を読み込む
     */
    loadKifuFromPreview() {
        if (!this.pendingKifuData) return;

        const kifuData = this.pendingKifuData;
        this.game.board = this.game.initializeBoard();
        this.game.currentTurn = PLAYER.SENTE;
        this.game.capturedPieces = { sente: [], gote: [] };
        this.game.gameOver = false;
        this.game.winner = kifuData.winner || null;
        this.moveHistory = kifuData.moves.map(move => Object.assign({}, move));
        this.currentMoveIndex = -1;
        this.game.isReplaying = true;

        for (let i = 0; i < kifuData.moves.length; i++) {
            this.currentMoveIndex = i;
            const move = kifuData.moves[i];
            if (move.type === 'move') {
                this.game.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promoted);
            } else if (move.type === 'drop') {
                this.game.dropPiece(move.piece, move.toRow, move.toCol);
            }
        }

        this.currentMoveIndex = kifuData.moves.length - 1;
        this.game.isReplaying = false;

        this.game.ui.updateUI();
        this.game.ui.updateMoveHistoryDisplay();
        this.game.ui.updateMoveControls();

        if (this.game.winner) {
            this.game.ui.showReplayMode();
        }

        this.game.ui.hideKifuDataModal();
        alert('棋譜を読み込みました');
    }

    /**
     * リセット
     */
    reset() {
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.positionHistory = [];
        this.checkHistory = [];
        this.pendingKifuData = null;
    }
}
