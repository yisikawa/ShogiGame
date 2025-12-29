// ゲーム状態管理クラス

import { BOARD_SIZE, INITIAL_BOARD, PLAYER } from './constants.js';
import { deepClone } from './utils.js';

/**
 * ゲーム状態を管理するクラス
 * UI層から分離し、純粋なゲームロジックのみを扱う
 */
export class GameState {
    constructor() {
        this.board = this.initializeBoard();
        this.currentTurn = PLAYER.SENTE;
        this.capturedPieces = {
            [PLAYER.SENTE]: [],
            [PLAYER.GOTE]: []
        };
        this.moveHistory = [];
        this.gameStarted = false;
        this.gameEnded = false;
        this.winner = null;
    }

    /**
     * 盤面を初期化
     * @returns {Array} 初期化された盤面
     */
    initializeBoard() {
        return deepClone(INITIAL_BOARD);
    }

    /**
     * ゲームをリセット
     */
    reset() {
        this.board = this.initializeBoard();
        this.currentTurn = PLAYER.SENTE;
        this.capturedPieces = {
            [PLAYER.SENTE]: [],
            [PLAYER.GOTE]: []
        };
        this.moveHistory = [];
        this.gameStarted = false;
        this.gameEnded = false;
        this.winner = null;
    }

    /**
     * 手番を切り替え
     */
    switchTurn() {
        this.currentTurn = this.currentTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
    }

    /**
     * 駒を取得
     * @param {number} row - 行
     * @param {number} col - 列
     * @returns {string|null} 駒
     */
    getPiece(row, col) {
        if (!this.isValidPosition(row, col)) return null;
        return this.board[row][col];
    }

    /**
     * 駒を配置
     * @param {number} row - 行
     * @param {number} col - 列
     * @param {string|null} piece - 駒
     */
    setPiece(row, col, piece) {
        if (this.isValidPosition(row, col)) {
            this.board[row][col] = piece;
        }
    }

    /**
     * 位置が有効かどうか
     * @param {number} row - 行
     * @param {number} col - 列
     * @returns {boolean} 有効な場合true
     */
    isValidPosition(row, col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    /**
     * 先手の駒かどうか
     * @param {string} piece - 駒
     * @returns {boolean} 先手の駒の場合true
     */
    isSente(piece) {
        if (!piece) return false;
        return piece === piece.toUpperCase();
    }

    /**
     * 後手の駒かどうか
     * @param {string} piece - 駒
     * @returns {boolean} 後手の駒の場合true
     */
    isGote(piece) {
        if (!piece) return false;
        return piece === piece.toLowerCase();
    }

    /**
     * 現在のプレイヤーの駒かどうか
     * @param {string} piece - 駒
     * @returns {boolean} 現在のプレイヤーの駒の場合true
     */
    isCurrentPlayerPiece(piece) {
        if (!piece) return false;
        if (this.currentTurn === PLAYER.SENTE) {
            return this.isSente(piece);
        } else {
            return this.isGote(piece);
        }
    }

    /**
     * 持ち駒を追加
     * @param {string} player - プレイヤー
     * @param {string} piece - 駒
     */
    addCapturedPiece(player, piece) {
        // 成り駒は元に戻す
        const basePiece = piece.replace('+', '');
        // 相手の駒を自分の駒に変換
        const ownPiece = player === PLAYER.SENTE ? basePiece.toUpperCase() : basePiece.toLowerCase();
        this.capturedPieces[player].push(ownPiece);
    }

    /**
     * 持ち駒を削除
     * @param {string} player - プレイヤー
     * @param {string} piece - 駒
     * @returns {boolean} 削除できた場合true
     */
    removeCapturedPiece(player, piece) {
        const index = this.capturedPieces[player].indexOf(piece);
        if (index !== -1) {
            this.capturedPieces[player].splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 手を記録
     * @param {Object} move - 手の情報
     */
    recordMove(move) {
        this.moveHistory.push({
            ...move,
            turn: this.currentTurn,
            timestamp: Date.now()
        });
    }

    /**
     * 状態のクローンを作成
     * @returns {GameState} クローンされた状態
     */
    clone() {
        const cloned = new GameState();
        cloned.board = deepClone(this.board);
        cloned.currentTurn = this.currentTurn;
        cloned.capturedPieces = deepClone(this.capturedPieces);
        cloned.moveHistory = deepClone(this.moveHistory);
        cloned.gameStarted = this.gameStarted;
        cloned.gameEnded = this.gameEnded;
        cloned.winner = this.winner;
        return cloned;
    }

    /**
     * ゲームを開始
     */
    startGame() {
        this.gameStarted = true;
        this.gameEnded = false;
        this.winner = null;
    }

    /**
     * ゲームを終了
     * @param {string} winner - 勝者
     */
    endGame(winner) {
        this.gameEnded = true;
        this.winner = winner;
    }
}
