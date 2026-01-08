import { BOARD_SIZE, PLAYER, AI_LEVEL, PIECE_NAMES, INITIAL_BOARD } from './constants.js';

export class ShogiUI {
    constructor(game) {
        this.game = game;
        this.pendingKifuData = null;
        this.container = document.body; // Event bus target
        this.setupEventListeners();
    }

    trigger(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        this.container.dispatchEvent(event);
    }

    renderBoard(board) {
        const boardElement = document.getElementById('board');
        if (!boardElement) return;

        boardElement.innerHTML = '';
        const boardData = board.board;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                const piece = boardData[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${this.game.isSente(piece) ? 'sente' : 'gote'}`;
                    pieceElement.textContent = this.getPieceName(piece);
                    cell.appendChild(pieceElement);
                }

                cell.addEventListener('click', () => this.trigger('cell-click', { row, col }));
                boardElement.appendChild(cell);
            }
        }
    }

    getPieceName(piece) {
        return PIECE_NAMES[piece] || '';
    }

    updateTurnIndicator(turn) {
        const turnElement = document.getElementById('currentTurn');
        if (turnElement) {
            turnElement.textContent = turn === PLAYER.SENTE ? '先手の番' : '後手の番';
        }
    }

    updateCapturedPieces(capturedPieces, selectedCapturedPiece) {
        const topList = document.getElementById('capturedTopList');
        const bottomList = document.getElementById('capturedBottomList');

        if (!topList || !bottomList) return;

        topList.innerHTML = '';
        bottomList.innerHTML = '';

        const gotePieces = this.countPieces(capturedPieces[PLAYER.GOTE]);
        const sentePieces = this.countPieces(capturedPieces[PLAYER.SENTE]);

        this.renderCapturedPiecesList(gotePieces, topList, PLAYER.GOTE, selectedCapturedPiece);
        this.renderCapturedPiecesList(sentePieces, bottomList, PLAYER.SENTE, selectedCapturedPiece);
    }

    countPieces(pieces) {
        const counts = {};
        pieces.forEach(piece => {
            counts[piece] = (counts[piece] || 0) + 1;
        });
        return counts;
    }

    renderCapturedPiecesList(pieces, container, player, selectedCapturedPiece) {
        Object.keys(pieces).forEach(piece => {
            const count = pieces[piece];
            const pieceElement = document.createElement('div');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = count > 1
                ? `${this.getPieceName(piece)}×${count}`
                : this.getPieceName(piece);
            pieceElement.dataset.piece = piece;

            if (selectedCapturedPiece &&
                selectedCapturedPiece.piece === piece &&
                selectedCapturedPiece.player === player) {
                pieceElement.classList.add('selected-captured');
            }

            pieceElement.addEventListener('click', () => this.trigger('captured-click', { piece, player }));
            container.appendChild(pieceElement);
        });
    }

    highlightMoves(possibleMoves, selectedCell) {
        // Clear previous
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.possible-move').forEach(el => el.classList.remove('possible-move'));

        if (selectedCell) {
            // Handle both object {row, col} and array [row, col] for backward compatibility during refactor
            const row = selectedCell.row !== undefined ? selectedCell.row : selectedCell[0];
            const col = selectedCell.col !== undefined ? selectedCell.col : selectedCell[1];

            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) cell.classList.add('selected');

            possibleMoves.forEach((move) => {
                // move can be [r, c] (old) or object (new)? 
                // Rules usually return objects {type, from..., to...} or arrays?
                // Rules.getPossibleMoves returns array of molecules? No, usually array of moves.
                // game.handleCellClick calls ui.highlightMoves(possibleMoves, selectedCell).
                // rules.getPossibleMoves returns array of [row, col].
                let r, c;
                if (Array.isArray(move)) {
                    [r, c] = move;
                } else {
                    r = move.toRow;
                    c = move.toCol;
                }
                const moveCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (moveCell) moveCell.classList.add('possible-move');
            });
        }
    }

    highlightDropPositions(availableDrops) {
        document.querySelectorAll('.possible-move').forEach(el => el.classList.remove('possible-move'));
        availableDrops.forEach((pos) => {
            let r, c;
            if (Array.isArray(pos)) {
                [r, c] = pos;
            } else {
                r = pos.row;
                c = pos.col;
            }
            const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (cell) cell.classList.add('possible-move');
        });
    }

    showPromoteModal(piece) {
        const modal = document.getElementById('promoteModal');
        const pieceName = document.getElementById('promotePieceName');
        if (modal && pieceName) {
            pieceName.textContent = `${this.getPieceName(piece)}を成りますか？`;
            modal.classList.remove('hidden');
        }
    }

    hidePromoteModal() {
        const modal = document.getElementById('promoteModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showAIThinking() {
        const aiThinking = document.getElementById('aiThinking');
        if (aiThinking) aiThinking.classList.remove('hidden');
    }

    hideAIThinking() {
        const aiThinking = document.getElementById('aiThinking');
        if (aiThinking) aiThinking.classList.add('hidden');
    }

    showKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) modal.classList.remove('hidden');
    }

    hideKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) modal.classList.add('hidden');
    }

    showKifuDataInfo(infoHTML) {
        const el = document.getElementById('kifuDataInfo');
        if (el) el.innerHTML = infoHTML;
    }

    showKifuDataList(htmlContent) {
        const el = document.getElementById('kifuDataList');
        if (el) el.innerHTML = htmlContent;
    }

    // AI Config Getter
    getAIConfig(player) {
        const suffix = player === PLAYER.SENTE ? 'Sente' : 'Gote';
        const levelEl = document.getElementById(`aiLevel${suffix}`);
        const modelEl = document.getElementById(`ollamaModel${suffix}`);
        const usiEl = document.getElementById(`usiServerUrl${suffix}`);
        const endpointEl = document.getElementById(`ollamaEndpoint${suffix}`); // Might be null

        return {
            level: levelEl ? levelEl.value : AI_LEVEL.HUMAN,
            ollamaEndpoint: endpointEl ? endpointEl.value : null,
            ollamaModel: modelEl ? modelEl.value : 'gemma2:2b',
            usiUrl: usiEl ? usiEl.value : null
        };
    }

    setupEventListeners() {
        // Helper to bind events
        const bind = (id, eventType, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(eventType, handler);
        };
        const click = (id, handler) => bind(id, 'click', handler);
        const change = (id, handler) => bind(id, 'change', handler);

        click('resetBtn', () => {
            if (this.game.moveHistory.length > 0 && !this.game.gameOver) {
                if (confirm('現在のゲームを終了して新しく始めますか？')) {
                    this.trigger('game-reset');
                }
            } else {
                this.trigger('game-reset');
            }
        });

        change('aiLevelSente', (e) => this.trigger('config-change', { player: 'sente', key: 'aiLevel', value: e.target.value }));
        change('aiLevelGote', (e) => this.trigger('config-change', { player: 'gote', key: 'aiLevel', value: e.target.value }));

        change('ollamaModelSente', (e) => this.trigger('config-change', { player: 'sente', key: 'ollamaModel', value: e.target.value }));
        change('ollamaModelGote', (e) => this.trigger('config-change', { player: 'gote', key: 'ollamaModel', value: e.target.value }));

        change('usiServerUrlSente', (e) => this.trigger('config-change', { player: 'sente', key: 'usiUrl', value: e.target.value }));
        change('usiServerUrlGote', (e) => this.trigger('config-change', { player: 'gote', key: 'usiUrl', value: e.target.value }));



        click('exitGameBtn', () => this.trigger('exit-game'));

        click('promoteYesBtn', () => this.trigger('promote-response', { promote: true }));
        click('promoteNoBtn', () => this.trigger('promote-response', { promote: false }));

        click('prevMoveBtn', () => this.trigger('history-nav', { direction: 'prev' }));
        click('nextMoveBtn', () => this.trigger('history-nav', { direction: 'next' }));
        click('firstMoveBtn', () => this.trigger('history-nav', { direction: 'first' }));
        click('lastMoveBtn', () => this.trigger('history-nav', { direction: 'last' }));

        click('downloadKifuBtn', () => this.downloadKifu(this.game.moveHistory));

        click('uploadKifuBtn', () => {
            const input = document.getElementById('uploadKifuInput');
            if (input) input.click();
        });

        change('uploadKifuInput', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleKifuFileSelect(file);
            }
        });

        click('loadKifuBtn', () => {
            if (this.pendingKifuData) {
                this.trigger('load-kifu', this.pendingKifuData);
                this.hideKifuDataModal();
            }
        });

        click('cancelKifuBtn', () => this.hideKifuDataModal());
    }

    updateElementVisibility(element, shouldShow) {
        if (element) {
            const newDisplay = shouldShow ? 'flex' : 'none';
            element.style.setProperty('display', newDisplay, 'important');
        }
    }

    updateAIConfigVisibility(player, level) {
        const suffix = player === PLAYER.SENTE ? 'Sente' : 'Gote';
        const ollamaConfig = document.getElementById(`ollamaConfig${suffix}`);
        const usiConfig = document.getElementById(`usiConfig${suffix}`);

        this.updateElementVisibility(ollamaConfig, level === AI_LEVEL.OLLAMA);
        this.updateElementVisibility(usiConfig, level === AI_LEVEL.USI);
    }

    positionToNotation(row, col) {
        const colNames = ['９', '８', '７', '６', '５', '４', '３', '２', '１'];
        const rowNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
        return colNames[col] + rowNames[row];
    }

    showReplayMode() {
        this.showGameEndMessage(this.game.winner);
        document.querySelectorAll('.cell, .captured-piece').forEach(element => {
            element.style.pointerEvents = 'none';
        });
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
        this.updateMoveControls(this.game.currentMoveIndex, this.game.moveHistory.length);
    }

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

    showGameEndMessage(winner) {
        const controls = document.querySelector('.move-history-controls');
        if (!controls) return;

        let message = '';
        if (winner === PLAYER.SENTE) {
            message = '🎉 先手の勝ち！';
        } else if (winner === PLAYER.GOTE) {
            message = '🎉 後手の勝ち！';
        } else {
            message = 'ゲーム終了';
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

    updateMoveControls(currentMoveIndex, totalMoves) {
        const prevBtn = document.getElementById('prevMoveBtn');
        const nextBtn = document.getElementById('nextMoveBtn');
        const firstBtn = document.getElementById('firstMoveBtn');
        const lastBtn = document.getElementById('lastMoveBtn');
        const counter = document.getElementById('moveCounter');

        if (prevBtn) prevBtn.disabled = currentMoveIndex < 0;
        if (nextBtn) nextBtn.disabled = currentMoveIndex >= totalMoves - 1;
        if (firstBtn) firstBtn.disabled = currentMoveIndex < 0;
        if (lastBtn) lastBtn.disabled = currentMoveIndex >= totalMoves - 1;
        if (counter) {
            if (totalMoves === 0) {
                counter.textContent = `手数: 0 / 0`;
            } else {
                counter.textContent = `手数: ${currentMoveIndex + 1} / ${totalMoves}`;
            }
        }
    }

    updateMoveHistoryDisplay(moveHistory, currentMoveIndex) {
        const listElement = document.getElementById('moveHistoryList');
        if (!listElement) return;

        listElement.innerHTML = '';

        moveHistory.forEach((move, index) => {
            const moveElement = document.createElement('div');
            moveElement.className = `move-item ${index === currentMoveIndex ? 'current' : ''}`;

            let moveText = '';
            if (move.type === 'move') {
                const pieceName = this.getPieceName(move.piece);
                const fromPos = this.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                const promote = move.promoted ? '成' : '';
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
                if (move.captured) {
                    moveText += ` (${this.getPieceName(move.captured)}を取る)`;
                }
            } else if (move.type === 'drop') {
                const pieceName = this.getPieceName(move.piece);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }

            moveElement.textContent = moveText;
            moveElement.addEventListener('click', () => {
                this.game.restoreFromHistory(index);
            });

            listElement.appendChild(moveElement);
        });
    }

    downloadKifu(moveHistory) {
        const json = JSON.stringify({ moves: moveHistory, initial: INITIAL_BOARD });
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shogi_kifu_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    handleKifuFileSelect(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                this.pendingKifuData = json;
                this.showKifuDataInfo(`読み込み成功: ${json.moves ? json.moves.length : 0} 手`);
                this.showKifuDataModal();
            } catch (err) {
                alert('棋譜ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    }

    updateEngineName(player, name, author) {
        const id = player === PLAYER.SENTE ? 'usiEngineNameSente' : 'usiEngineNameGote';
        const el = document.getElementById(id);
        if (el) {
            el.value = name + (author ? ` (${author})` : '');
        }
    }
}
