import {
    BOARD_SIZE,
    PIECE_NAMES,
    PLAYER,
    AI_LEVEL,
    PIECE_TYPE
} from './constants.js';
import { log } from './utils.js';

/**
 * 将棋ゲームのUI管理クラス
 */
export class UIManager {
    constructor(game) {
        this.game = game;
    }

    /**
     * ログ出力
     */
    log(level, message, data = null) {
        log(message, data, level);
    }

    /**
     * 盤面を描画
     */
    renderBoard() {
        const boardElement = document.getElementById('board');
        if (!boardElement) return;

        boardElement.innerHTML = '';

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                const piece = this.game.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${this.game.isSente(piece) ? 'sente' : 'gote'}`;
                    pieceElement.textContent = this.getPieceName(piece);
                    cell.appendChild(pieceElement);
                }

                cell.addEventListener('click', () => this.game.handleCellClick(row, col));
                boardElement.appendChild(cell);
            }
        }
    }

    /**
     * 駒の表示名を取得
     */
    getPieceName(piece) {
        return PIECE_NAMES[piece] || '';
    }

    /**
     * 移動可能な位置をハイライト
     */
    highlightMoves() {
        this.renderBoard();
        if (this.game.selectedCell) {
            const [row, col] = this.game.selectedCell;
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) cell.classList.add('selected');

            const possibleMoves = this.game.getPossibleMoves(row, col);
            possibleMoves.forEach(([r, c]) => {
                const moveCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (moveCell) moveCell.classList.add('possible-move');
            });
        }
    }

    /**
     * 打てる位置をハイライト
     */
    highlightDropPositions() {
        this.renderBoard();
        if (this.game.selectedCapturedPiece) {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (this.game.canDropPiece(this.game.selectedCapturedPiece.piece, row, col)) {
                        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        if (cell) cell.classList.add('possible-move');
                    }
                }
            }
        }
    }

    /**
     * ターン表示を更新
     */
    updateTurnIndicator() {
        const turnElement = document.getElementById('currentTurn');
        if (turnElement) {
            turnElement.textContent = this.game.currentTurn === PLAYER.SENTE ? '先手の番' : '後手の番';
        }
    }

    /**
     * 持ち駒表示を更新
     */
    updateCapturedPieces() {
        const topList = document.getElementById('capturedTopList');
        const bottomList = document.getElementById('capturedBottomList');

        if (!topList || !bottomList) return;

        topList.innerHTML = '';
        bottomList.innerHTML = '';

        // 持ち駒を集計
        const gotePieces = this.countPieces(this.game.capturedPieces.gote);
        const sentePieces = this.countPieces(this.game.capturedPieces.sente);

        // 後手の持ち駒を表示
        this.renderCapturedPieces(gotePieces, topList, PLAYER.GOTE);

        // 先手の持ち駒を表示
        this.renderCapturedPieces(sentePieces, bottomList, PLAYER.SENTE);
    }

    /**
     * 持ち駒を集計
     */
    countPieces(pieces) {
        const counts = {};
        pieces.forEach(piece => {
            counts[piece] = (counts[piece] || 0) + 1;
        });
        return counts;
    }

    /**
     * 持ち駒を描画
     */
    renderCapturedPieces(pieces, container, player) {
        Object.keys(pieces).forEach(piece => {
            const count = pieces[piece];
            const pieceElement = document.createElement('div');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = count > 1
                ? `${this.getPieceName(piece)}×${count}`
                : this.getPieceName(piece);
            pieceElement.dataset.piece = piece;

            if (this.game.selectedCapturedPiece &&
                this.game.selectedCapturedPiece.piece === piece &&
                this.game.selectedCapturedPiece.player === player) {
                pieceElement.classList.add('selected-captured');
            }

            pieceElement.addEventListener('click', () => this.game.handleCapturedPieceClick(piece, player));
            container.appendChild(pieceElement);
        });
    }

    /**
     * 成り選択モーダルを表示
     */
    showPromoteModal(piece) {
        const modal = document.getElementById('promoteModal');
        const pieceDisplay = document.getElementById('promotePieceName');
        if (modal && pieceDisplay) {
            pieceDisplay.textContent = this.getPieceName(piece);
            modal.classList.remove('hidden');
        }
    }

    /**
     * 成り選択モーダルを非表示
     */
    hidePromoteModal() {
        const modal = document.getElementById('promoteModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * AI思考中を表示
     */
    showAIThinking() {
        const thinkingElement = document.getElementById('aiThinking');
        if (thinkingElement) {
            thinkingElement.classList.remove('hidden');
        }
    }

    /**
     * AI思考中を非表示
     */
    hideAIThinking() {
        const thinkingElement = document.getElementById('aiThinking');
        if (thinkingElement) {
            thinkingElement.classList.add('hidden');
        }
    }

    /**
     * 設定要素の表示/非表示を更新するヘルパー関数
     */
    updateElementVisibility(element, shouldShow) {
        if (!element) return;
        if (shouldShow) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    }

    /**
     * AI設定UIの表示/非表示を更新
     */
    updateAISettingsVisibility() {
        // 先手の設定
        const aiLevelSente = this.game.aiLevelSente;
        const ollamaConfigSente = document.getElementById('ollamaConfigSente');
        const usiConfigSente = document.getElementById('usiConfigSente');

        // Ollamaが選ばれている時だけOllama設定を表示
        this.updateElementVisibility(ollamaConfigSente, aiLevelSente === AI_LEVEL.OLLAMA);
        // USIが選ばれている時だけUSI設定を表示
        this.updateElementVisibility(usiConfigSente, aiLevelSente === AI_LEVEL.USI);

        // 後手の設定
        const aiLevelGote = this.game.aiLevelGote;
        const ollamaConfigGote = document.getElementById('ollamaConfigGote');
        const usiConfigGote = document.getElementById('usiConfigGote');

        // Ollamaが選ばれている時だけOllama設定を表示
        this.updateElementVisibility(ollamaConfigGote, aiLevelGote === AI_LEVEL.OLLAMA);
        // USIが選ばれている時だけUSI設定を表示
        this.updateElementVisibility(usiConfigGote, aiLevelGote === AI_LEVEL.USI);
    }

    /**
     * USIエンジン名を表示に設定
     */
    setUSIEngineName(player, name, url) {
        const isSente = player === '先手' || player === 'sente';
        const elementId = isSente ? 'usiServerUrlSente' : 'usiServerUrlGote';
        const element = document.getElementById(elementId);

        if (element) {
            // 元のURLを保存（未保存の場合のみ）
            if (!element.dataset.originalUrl) {
                element.dataset.originalUrl = url;
            }
            element.value = name;
            element.title = `URL: ${url}`;
            element.readOnly = true;
            element.classList.add('engine-connected');
        }
    }

    /**
     * 特定のプレイヤーのUSIエンジン入力をリセット
     */
    resetSingleUSIEngineInput(player) {
        const isSente = player === '先手' || player === 'sente' || player === 'Sente';
        const elementId = isSente ? 'usiServerUrlSente' : 'usiServerUrlGote';
        const element = document.getElementById(elementId);

        if (element) {
            // readOnlyがtrue、またはエンジン名が表示されている場合、元のURLに戻す
            if (element.readOnly || element.classList.contains('engine-connected')) {
                const originalUrl = element.dataset.originalUrl || element.title.replace('URL: ', '') || 'http://localhost:8080';
                element.value = originalUrl;
                element.readOnly = false;
                element.title = 'USIサーバーのURLを入力してください';
                element.classList.remove('engine-connected');
            }
        }
    }

    /**
     * すべてのUSIエンジン入力をリセット
     */
    resetUSIEngineInputs() {
        ['Sente', 'Gote'].forEach(player => this.resetSingleUSIEngineInput(player));
    }

    /**
     * AI設定UIを遅延更新（確実に反映させるため）
     */
    scheduleAISettingsUpdate() {
        setTimeout(() => this.updateAISettingsVisibility(), 10);
        setTimeout(() => this.updateAISettingsVisibility(), 100);
    }

    /**
     * ゲーム終了メッセージを表示
     */
    showGameEndMessage() {
        const controls = document.querySelector('.move-history-controls');
        if (!controls) return;

        let message = '';
        if (this.game.winner === PLAYER.SENTE) {
            message = '🎉 先手の勝ち！';
        } else if (this.game.winner === PLAYER.GOTE) {
            message = '🎉 後手の勝ち！';
        } else {
            message = 'ゲーム終了（引き分け）';
        }

        let messageElement = document.getElementById('gameEndMessage');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'gameEndMessage';
            messageElement.className = 'game-end-message';
            controls.insertBefore(messageElement, controls.firstChild);
        }
        messageElement.textContent = message;
    }

    /**
     * 千日手メッセージを表示
     */
    showRepetitionMessage(type, loser) {
        const controls = document.querySelector('.move-history-controls');
        if (!controls) return;

        let message = '';
        if (type === '連続王手の千日手') {
            const loserName = loser === PLAYER.SENTE ? '先手' : '後手';
            message = `⚠️ ${type}：${loserName}の負け`;
        } else {
            message = `⚠️ ${type}：引き分け`;
        }

        let messageElement = document.getElementById('gameEndMessage');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'gameEndMessage';
            messageElement.className = 'game-end-message';
            controls.insertBefore(messageElement, controls.firstChild);
        }
        messageElement.textContent = message;
        messageElement.style.color = '#e74c3c';
    }

    /**
     * 再生モードを表示
     */
    showReplayMode() {
        this.showGameEndMessage();

        // 盤面と持ち駒の操作を無効化
        document.querySelectorAll('.cell, .captured-piece').forEach(element => {
            element.style.pointerEvents = 'none';
        });

        // 棋譜コントロールを強調表示
        const controls = document.querySelector('.move-history-controls');
        const panel = document.querySelector('.move-history-panel');
        if (controls) {
            controls.style.display = 'flex';
            controls.style.background = '#fff3cd';
            controls.style.border = '2px solid #ffc107';
        }
        if (panel) {
            panel.style.display = 'block';
            panel.style.background = '#fff3cd';
            panel.style.border = '2px solid #ffc107';
        }
    }

    /**
     * 再生モードを終了
     */
    exitReplayMode() {
        const messageElement = document.getElementById('gameEndMessage');
        if (messageElement) {
            messageElement.remove();
        }

        document.querySelectorAll('.cell, .captured-piece').forEach(element => {
            element.style.pointerEvents = '';
        });

        const controls = document.querySelector('.move-history-controls');
        const panel = document.querySelector('.move-history-panel');
        if (controls) {
            controls.style.background = '';
            controls.style.border = '';
        }
        if (panel) {
            panel.style.background = '';
            panel.style.border = '';
        }
    }

    /**
     * 棋譜コントロールを更新
     */
    updateMoveControls() {
        const prevBtn = document.getElementById('prevMoveBtn');
        const nextBtn = document.getElementById('nextMoveBtn');
        const firstBtn = document.getElementById('firstMoveBtn');
        const lastBtn = document.getElementById('lastMoveBtn');
        const counter = document.getElementById('moveCounter');

        const totalMoves = this.game.moveHistory.length;
        const currentMove = this.game.currentMoveIndex + 1;

        if (prevBtn) prevBtn.disabled = this.game.currentMoveIndex < 0;
        if (nextBtn) nextBtn.disabled = this.game.currentMoveIndex >= totalMoves - 1;
        if (firstBtn) firstBtn.disabled = this.game.currentMoveIndex < 0;
        if (lastBtn) lastBtn.disabled = this.game.currentMoveIndex >= totalMoves - 1;
        if (counter) {
            if (totalMoves === 0) {
                counter.textContent = `手数: 0 / 0`;
            } else {
                counter.textContent = `手数: ${currentMove} / ${totalMoves}`;
            }
        }
    }

    /**
     * 棋譜表示を更新
     */
    updateMoveHistoryDisplay() {
        const listElement = document.getElementById('moveHistoryList');
        if (!listElement) return;

        listElement.innerHTML = '';

        this.game.moveHistory.forEach((move, index) => {
            const moveElement = document.createElement('div');
            moveElement.className = `move-item ${index === this.game.currentMoveIndex ? 'current' : ''}`;

            let moveText = '';
            if (move.type === 'move') {
                const pieceName = this.getPieceName(move.piece);
                const fromPos = this.game.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                const promote = move.promoted ? '成' : '';
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
                if (move.captured) {
                    moveText += ` (${this.getPieceName(move.captured)}を取る)`;
                }
            } else if (move.type === 'drop') {
                const pieceName = this.getPieceName(move.piece);
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }

            moveElement.textContent = moveText;
            moveElement.addEventListener('click', () => {
                this.game.restoreFromHistory(index);
            });

            listElement.appendChild(moveElement);
        });
    }

    /**
     * 棋譜データモーダルを表示
     */
    showKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 棋譜データモーダルを非表示
     */
    hideKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // ファイル入力をリセット
        const input = document.getElementById('uploadKifuInput');
        if (input) {
            input.value = '';
        }
    }

    /**
     * 棋譜データの情報を表示
     */
    showKifuDataInfo(kifuData) {
        const infoElement = document.getElementById('kifuDataInfo');
        if (!infoElement) return;

        const winnerNames = {
            'sente': '先手',
            'gote': '後手',
            null: '引き分け'
        };

        const timestamp = kifuData.timestamp
            ? new Date(kifuData.timestamp).toLocaleString('ja-JP')
            : '不明';

        const winner = winnerNames[kifuData.winner] || '不明';
        const moveCount = kifuData.moves ? kifuData.moves.length : 0;

        // 既存の棋譜があるかチェック
        const hasExistingKifu = this.game.moveHistory.length > 0;
        const existingKifuWarning = hasExistingKifu
            ? `<div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; color: #856404;">
                <strong>⚠️ 注意:</strong> 既存の棋譜（${this.game.moveHistory.length}手）があります。この棋譜を読み込むと、既存の棋譜は上書きされます。
            </div>`
            : '';

        infoElement.innerHTML = `
            ${existingKifuWarning}
            <div style="margin-bottom: 15px;">
                <strong>手数:</strong> ${moveCount}手
            </div>
            <div style="margin-bottom: 15px;">
                <strong>勝者:</strong> ${winner}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>保存日時:</strong> ${timestamp}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>バージョン:</strong> ${kifuData.version || '不明'}
            </div>
        `;

        // モーダルを表示
        this.showKifuDataModal();
    }

    /**
     * 棋譜リストを表示
     */
    showKifuDataList(moves) {
        const listElement = document.getElementById('kifuDataList');
        if (!listElement) return;

        if (!moves || moves.length === 0) {
            listElement.innerHTML = '<div style="text-align: center; color: #666;">棋譜がありません</div>';
            return;
        }

        const formattedList = this.formatFullKifuList(moves);
        listElement.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; font-size: 1.1em;">全棋譜リスト（${moves.length}手）</div>
            <div style="font-size: 0.9em; line-height: 1.6;">
                ${formattedList}
            </div>
        `;
    }

    /**
     * 全棋譜リストをフォーマット
     */
    formatFullKifuList(moves) {
        if (!moves || moves.length === 0) return 'なし';

        return moves.map((move, index) => {
            let moveText = '';
            if (move.type === 'move') {
                const fromPos = this.game.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece || '');
                const promote = move.promoted ? '成' : '';
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
                if (move.captured) {
                    moveText += ` (${this.getPieceName(move.captured)}を取る)`;
                }
            } else if (move.type === 'drop') {
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece || '');
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }
            return `<div style="padding: 3px 0; border-bottom: 1px solid #eee;">${moveText}</div>`;
        }).join('');
    }

    /**
     * 棋譜データの情報を表示
     */
    showKifuDataInfo(kifuData) {
        const infoElement = document.getElementById('kifuDataInfo');
        if (!infoElement) return;

        const winnerNames = {
            'sente': '先手',
            'gote': '後手',
            null: '引き分け'
        };

        const timestamp = kifuData.timestamp
            ? new Date(kifuData.timestamp).toLocaleString('ja-JP')
            : '不明';

        const winner = winnerNames[kifuData.winner] || '不明';
        const moveCount = kifuData.moves ? kifuData.moves.length : 0;

        const hasExistingKifu = this.game.moveHistory.length > 0;
        const existingKifuWarning = hasExistingKifu
            ? `<div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; color: #856404;">
                <strong>⚠️ 注意:</strong> 既存の棋譜（${this.game.moveHistory.length}手）があります。この棋譜を読み込むと、既存の棋譜は上書きされます。
            </div>`
            : '';

        infoElement.innerHTML = `
            ${existingKifuWarning}
            <div style="margin-bottom: 15px;">
                <strong>手数:</strong> ${moveCount}手
            </div>
            <div style="margin-bottom: 15px;">
                <strong>勝者:</strong> ${winner}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>保存日時:</strong> ${timestamp}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>バージョン:</strong> ${kifuData.version || '不明'}
            </div>
        `;

        this.showKifuDataModal();
    }

    /**
     * 棋譜リストを表示
     */
    showKifuDataList(moves) {
        const listElement = document.getElementById('kifuDataList');
        if (!listElement) return;

        if (!moves || moves.length === 0) {
            listElement.innerHTML = '<div style="text-align: center; color: #666;">棋譜がありません</div>';
            return;
        }

        const formattedList = this.formatFullKifuList(moves);
        listElement.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; font-size: 1.1em;">全棋譜リスト（${moves.length}手）</div>
            <div style="font-size: 0.9em; line-height: 1.6;">
                ${formattedList}
            </div>
        `;
    }

    /**
     * 全棋譜リストをフォーマット
     */
    formatFullKifuList(moves) {
        if (!moves || moves.length === 0) return 'なし';

        return moves.map((move, index) => {
            let moveText = '';
            if (move.type === 'move') {
                const fromPos = this.game.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece || '');
                const promote = move.promoted ? '成' : '';
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
                if (move.captured) {
                    moveText += ` (${this.getPieceName(move.captured)}を取る)`;
                }
            } else if (move.type === 'drop') {
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece || '');
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }
            return `<div style="padding: 3px 0; border-bottom: 1px solid #eee;">${moveText}</div>`;
        }).join('');
    }

    /**
     * 棋譜のプレビューをフォーマット
     */
    formatKifuPreview(moves) {
        if (!moves || moves.length === 0) return 'なし';

        return moves.map((move, index) => {
            if (move.type === 'move') {
                const fromPos = this.game.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece);
                const promote = move.promoted ? '成' : '';
                return `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
            } else if (move.type === 'drop') {
                const toPos = this.game.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece);
                return `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }
            return '';
        }).join('<br>');
    }

    /**
     * 棋譜データモーダルを表示
     */
    showKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 棋譜データモーダルを非表示
     */
    hideKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        const input = document.getElementById('uploadKifuInput');
        if (input) {
            input.value = '';
        }
    }

    /**
     * UI全体を更新
     */
    updateUI() {
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.updateMoveControls();
    }
}
