import Phaser from 'phaser';
import { io } from 'socket.io-client';
import { Dealer, CARD_MAP } from '../logic/Dealer';

export class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
        this.dealer = new Dealer();
        this.centralScales = [[], [], [], []];
        this.players = null;
        this.dropZones = [];
        this.discardZones = [];
        this.messageBuffer = [];
        this.displayDuration = 2000;
        this.isMessageDisplaying = false;
        this.playerName = 'Jugador 1';
        this.socket = null;
        this.isWaiting = true;
        this.turn = 'p1'; // Manejado por servidor
    }

    init(data) {
        this.playerName = data.playerName || 'Jugador 1';
    }

    preload() {
        const facePath = 'assets/FACES (BORDERED)/STANDARD BORDERED/Single Cards (One Per FIle)/';
        const cardKeys = Object.keys(CARD_MAP).filter(k => k.includes('-'));

        // Cargar todas las caras
        cardKeys.forEach(key => {
            this.load.svg(key, facePath + key + '.svg');
        });

        // Cargar Jockers explícitamente por si acaso
        ['JOKER-1', 'JOKER-2', 'JOKER-3'].forEach(k => {
            this.load.svg(k, facePath + k + '.svg');
        });

        // Asset de reverso único para evitar glitches con hojas de assets múltiples
        this.load.svg('cardBack', 'assets/single_back.svg');

        // Cargar Efectos de Sonido (SFX)
        this.load.audio('cardFlip', 'assets/audio/flipcard.mp3');
        this.load.audio('cardTable', 'assets/audio/pounding-cards-on-table.mp3');
        this.load.audio('cardShuffleBridge', 'assets/audio/shuffleandbridge.mp3');
        this.load.audio('cardShuffleFlip', 'assets/audio/shuffleandcardflip.mp3');

        // Infografía de reglas
        this.load.image('rulesInfo', 'assets/infografia.jpg');
    }

    create() {
        const { width, height } = this.sys.game.config;

        // Estética: Fondo degradado
        this.cameras.main.setBackgroundColor('#1a1a1a');

        this.players = this.dealer.dealGame();

        this.createDropZones();
        this.createDiscardZones();
        this.renderBoard();
        this.setupDragLogic();

        // Botón de Sesión - CAMBIO ESPECÍFICO 3
        const editBtn = this.add.text(width - 50, height - 30, '✎ Editar Nombre', {
            fontSize: '14px',
            color: '#aaaaaa'
        }).setOrigin(1, 1).setInteractive({ useHandCursor: true });

        editBtn.on('pointerdown', () => {
            const newName = prompt("Nuevo nombre:", this.playerName);
            if (newName) {
                localStorage.setItem('26_player_name', newName);
                this.scene.start('PlayScene', { playerName: newName });
            }
        });

        // Botón de Reglas - NUEVO
        const rulesBtn = this.add.text(width - 180, height - 30, '❔ Cómo Jugar', {
            fontSize: '14px',
            color: '#00d4ff'
        }).setOrigin(1, 1).setInteractive({ useHandCursor: true });

        rulesBtn.on('pointerdown', () => this.showRules());

        // Inicializar sonidos
        this.sfx = {
            flip: this.sound.add('cardFlip'),
            snap: this.sound.add('cardTable'),
            shuffle: this.sound.add('cardShuffleBridge'),
            complete: this.sound.add('cardShuffleFlip')
        };

        this.setupSocket();
    }

    setupSocket() {
        // En producción (Render), el socket se conecta al mismo host
        this.socket = io();
        this.showMessage("Conectando al servidor...", "#ffffff");

        this.socket.emit('join_game', this.playerName);

        this.socket.on('waiting_opponent', () => {
            this.showMessage("Esperando oponente...", "#00d4ff");
        });

        this.socket.on('game_start', (data) => {
            this.isWaiting = false;
            this.playerRole = data.role; // 'p1' o 'p2'
            this.players = {
                human: data.yourState,
                opponent: {
                    hand: Array(data.oppCount.hand).fill('cardBack'),
                    reserve: Array(data.oppCount.reserve).fill('cardBack'),
                    wildcards: [],
                    discards: [[], [], [], []]
                }
            };
            this.currentTurn = (data.role === 'p1') ? 'human' : 'opponent';
            this.renderBoard();
            this.showMessage(`¡Contra ${data.opponentName}!`, "#00ff00");
            this.sfx.shuffle.play();
        });

        this.socket.on('move_confirmed', () => {
            this.sfx.snap.play({ volume: 0.6 });
        });

        this.socket.on('game_update', (data) => {
            this.handleOpponentMove(data.move);
            this.sfx.snap.play({ volume: 0.4, rate: 1.2 });
        });
    }

    handleOpponentMove(move) {
        // SFX Movimiento Oponente
        this.sfx.flip.play();
        this.showMessage("El oponente movió", "#ffaa00");
        // Nota: Aquí se implementaría la actualización visual detallada del tablero
    }

    createDropZones() {
        const { width, height } = this.sys.game.config;
        // Shifted further to the right to avoid AI discard zones
        const startX = width / 2 - (170 * 1.5) + 60;
        const spacing = 170;
        const y = height / 2; // Más centrado verticalmente

        for (let i = 0; i < 4; i++) {
            const zone = this.add.rectangle(startX + (i * spacing), y, 120, 170, 0x1d1d1d)
                .setStrokeStyle(2, 0x00d4ff, 0.5)
                .setInteractive()
                .setAlpha(0.6);

            zone.input.dropZone = true;
            zone.setData('type', 'scale');
            zone.setData('index', i);

            this.add.text(startX + (i * spacing), y - 100, `Escala ${i + 1}`, {
                fontSize: '12px',
                color: '#00d4ff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.dropZones.push(zone);
        }
    }

    createDiscardZones() {
        const { width, height } = this.scale.displaySize;

        // Zonas de la IA (Superior Izquierda, cerca del nombre)
        for (let i = 0; i < 4; i++) {
            const zoneX = 110 + (i % 2) * 120;
            const zoneY = 100 + Math.floor(i / 2) * 170;

            const zone = this.add.rectangle(zoneX, zoneY, 110, 160, 0x1d1d1d)
                .setStrokeStyle(2, 0xffaa00, 0.4)
                .setAlpha(0.3);
            zone.setData('type', 'discard');
            zone.setData('owner', 'opponent');
            zone.setData('index', i);
            this.discardZones.push(zone);
        }

        // Zonas de Gaston (Derecha)
        for (let i = 0; i < 4; i++) {
            const zone = this.add.rectangle(width - 90, 200 + (i * 125), 110, 160, 0x1d1d1d)
                .setStrokeStyle(3, 0xffaa00, 0.6)
                .setInteractive();
            zone.input.dropZone = true;
            zone.setData('type', 'discard');
            zone.setData('owner', 'human');
            zone.setData('index', i);
            this.discardZones.push(zone);
        }
    }

    renderBoard() {
        // Limpiamos todo menos las zonas base
        this.children.getAll().filter(child => child.type === 'Sprite' || child.type === 'Text').forEach(child => {
            if (!child.text || !child.text.includes('Escala')) child.destroy();
        });

        this.renderHumanState();
        this.renderOpponentState(); // REGLA 2: Llamada a la función de oponente
        this.renderCentralScales();
    }

    // REGLA 2: Función específica para el estado del oponente
    renderOpponentState() {
        const { width } = this.scale.displaySize;
        const opp = this.players.opponent;
        const centerX = width / 2;

        // Nombre Oponente
        this.add.text(centerX, 20, "IA-Master26", {
            fontSize: '18px', color: '#ff0055', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        // Mano del Oponente (Abanico Dinámico)
        this.createOpponentHandVisual(opp.hand.length);

        // Pila de Reserva + Comodines (Esquina superior derecha)
        if (opp.reserve.length > 0) {
            const topKey = opp.reserve[opp.reserve.length - 1];
            const resX = width - 80;
            const resY = 100;

            this.add.sprite(resX, resY, topKey).setDisplaySize(90, 130).setOrigin(0.5);
            this.add.text(resX, 20, `Pila: ${opp.reserve.length}`, { fontSize: '14px', color: '#fff' }).setOrigin(0.5, 0);

            if (opp.wildcards.length > 0) {
                // Usamos un rectángulo simple color oro para los comodines para evitar confusión con el reverso
                const wildIcon = this.add.rectangle(resX - 60, resY + 20, 40, 60, 0xd4af37)
                    .setStrokeStyle(2, 0xffffff)
                    .setOrigin(0.5);
                this.add.text(resX - 60, resY + 20, 'W', { fontSize: '24px', color: '#000', fontStyle: 'bold' }).setOrigin(0.5);
                this.add.text(resX - 60, resY + 60, `x${opp.wildcards.length}`, { fontSize: '14px', color: '#ff0' }).setOrigin(0.5);
            }
        }

        // Renderizar descartes IA (Izquierda)
        opp.discards.forEach((col, index) => {
            if (col.length > 0) {
                const zone = this.discardZones[index];
                this.add.sprite(zone.x, zone.y, col[col.length - 1]).setDisplaySize(80, 110);
            }
        });
    }

    createOpponentHandVisual(count) {
        const { width } = this.scale.displaySize;
        const centerX = width / 2;
        const y = 20; // Más arriba
        const arcRadius = 300; // Radio más pequeño para que la curva sea más cerrada y visible

        const maxRotation = 15; // grados
        const startAngle = (90 - maxRotation) * (Math.PI / 180); // Cambiamos la orientación del arco
        const endAngle = (90 + maxRotation) * (Math.PI / 180);
        const step = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;

        for (let i = 0; i < count; i++) {
            const angle = count > 1 ? startAngle + (i * step) : Math.PI * 0.5;
            // El centro del círculo está en (centerX, y - arcRadius)
            const cardX = centerX + Math.cos(angle) * arcRadius;
            const cardY = (y - arcRadius + 150) + Math.sin(angle) * arcRadius;

            this.add.sprite(cardX, cardY, 'cardBack')
                .setDisplaySize(80, 115)
                .setRotation(angle - Math.PI / 2)
                .setOrigin(0.5);
        }
    }

    renderHumanState() {
        const { width, height } = this.scale.displaySize;
        const hum = this.players.human;

        // Nombre Humano (Esquina inferior izquierda)
        this.add.text(50, height - 170, this.playerName, {
            fontSize: '18px', color: '#00d4ff', fontStyle: 'bold'
        }).setOrigin(0, 1);

        // Mano Activa en Abanico - CAMBIO ESPECÍFICO 1
        const handStartY = height - 120;
        const count = hum.hand.length;
        const mid = (count - 1) / 2;

        hum.hand.forEach((cardKey, index) => {
            const relativeIdx = index - mid;
            const rotation = relativeIdx * 0.1;
            const offsetX = relativeIdx * 80; // Espaciado horizontal
            const offsetY = Math.abs(relativeIdx) * 15; // Curvatura (baja en extremos)

            const card = this.createDraggableCard(width / 2 + offsetX, handStartY + offsetY, cardKey, 'human-hand');
            card.setRotation(rotation);
            card.setData('originalRotation', rotation);
            if (card.getData('shadow')) {
                card.getData('shadow').setRotation(rotation);
            }
        });

        // Reserva + Comodines (Esquina inferior derecha)
        if (hum.reserve.length > 0) {
            const resX = width - 80;
            const resY = height - 120;
            const topRes = hum.reserve[hum.reserve.length - 1];
            this.createDraggableCard(resX, resY, topRes, 'human-reserve');
            this.add.text(resX, height - 170, `Pila: ${hum.reserve.length}`, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5, 1);

            if (hum.wildcards.length > 0) {
                const topWild = hum.wildcards[hum.wildcards.length - 1];
                this.createDraggableCard(resX - 60, resY - 40, topWild, 'human-wildcard');
                this.add.text(resX - 60, resY - 90, `W:${hum.wildcards.length}`, { fontSize: '10px', color: '#ff0' }).setOrigin(0.5, 1);
            }
        }

        // Renderizar descartes Gaston (Derecha)
        hum.discards.forEach((col, index) => {
            if (col.length > 0) {
                const zone = this.discardZones[index + 4]; // Las zonas 4-7 son de Gaston
                this.createDraggableCard(zone.x, zone.y, col[col.length - 1], `human-discard-${index}`);
            }
        });
    }

    renderCentralScales() {
        this.centralScales.forEach((scale, index) => {
            if (scale.length > 0) {
                const topKey = scale[scale.length - 1];
                const zone = this.dropZones[index];
                this.add.sprite(zone.x, zone.y, topKey).setDisplaySize(120, 170);
                this.add.text(zone.x, zone.y + 100, `V: ${this.dealer.getEffectiveValue(scale)}`, { fontSize: '12px', color: '#0f0' }).setOrigin(0.5);
            }
        });
    }

    createDraggableCard(x, y, key, origin) {
        // Sombra (dropShadow visual)
        const shadow = this.add.sprite(x + 5, y + 5, key)
            .setDisplaySize(110, 160)
            .setTint(0x000000)
            .setAlpha(0.3);

        const card = this.add.sprite(x, y, key)
            .setDisplaySize(110, 160)
            .setInteractive({ draggable: true });

        card.setData('shadow', shadow);
        card.setData('key', key);
        card.setData('origin', origin);
        card.setData('originalX', x);
        card.setData('originalY', y);
        card.setData('originalRotation', 0);

        return card;
    }

    setupDragLogic() {
        this.input.on('dragstart', (pointer, gameObject) => {
            if (this.currentTurn !== 'human' || this.isAIThinking) {
                gameObject.x = gameObject.getData('originalX');
                gameObject.y = gameObject.getData('originalY');
                return;
            }
            // Reset rotation and scale up - CAMBIO ESPECÍFICO 2
            gameObject.setRotation(0);
            gameObject.setScale(1.1);
            if (gameObject.getData('shadow')) {
                gameObject.getData('shadow').setRotation(0).setScale(1.1);
            }

            this.children.bringToTop(gameObject);
            gameObject.setAlpha(0.8);
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = dragY;
            if (gameObject.getData('shadow')) {
                gameObject.getData('shadow').x = dragX + 10;
                gameObject.getData('shadow').y = dragY + 10;
            }
        });

        this.input.on('dragend', (pointer, gameObject, dropped) => {
            gameObject.setAlpha(1);
            if (!dropped) {
                this.returnCard(gameObject);
            }
        });

        this.input.on('drop', (pointer, gameObject, dropZone) => {
            const cardKey = gameObject.getData('key');
            const type = dropZone.getData('type');
            const index = dropZone.getData('index');
            const origin = gameObject.getData('origin');

            if (type === 'scale') {
                this.handleScaleDrop(gameObject, cardKey, index, origin);
            } else if (type === 'discard') {
                this.handleDiscardDrop(gameObject, cardKey, index, origin);
            }

            // Emitir movimiento al servidor - CAMBIO ESPECÍFICO 2
            this.socket.emit('player_move', {
                cardKey,
                targetType: type,
                targetIndex: index,
                origin
            });
        });
    }

    handleScaleDrop(gameObject, cardKey, scaleIndex, origin) {
        const targetScale = this.centralScales[scaleIndex];
        const result = this.dealer.validateMove(targetScale, cardKey);

        if (result.valid) {
            targetScale.push(cardKey);
            this.removeFromPlayerOrigin(cardKey, origin, 'human');

            // ELIMINADO: El sonido ahora suena en 'move_confirmed'

            if (this.dealer.getEffectiveValue(targetScale) === 12) {
                this.centralScales[scaleIndex] = [];
                this.showMessage("¡Escala Completada!", "#00ff00");
                // SFX Completar Escala
                this.sfx.complete.play({ volume: 0.8 });
            }

            if (this.players.human.hand.length === 0) {
                this.dealer.refillHand(this.players.human.hand, this.players.human.wildcards);
                this.showMessage("¡Mano vacía! Robando...", "#ffff00");
            }

            this.renderBoard();
        } else {
            this.showMessage(result.reason, "#ff0000");
            // SFX Movimiento Inválido (raspado)
            this.sfx.flip.play({ rate: 0.5, volume: 0.4 });
            this.returnCard(gameObject);
        }
    }

    handleDiscardDrop(gameObject, cardKey, discardIndex, origin) {
        if (!origin.includes('hand')) {
            this.showMessage("Solo descartes de la mano activa.", "#ff0000");
            return this.returnCard(gameObject);
        }

        this.players.human.discards[discardIndex].push(cardKey);
        this.players.human.hand = this.players.human.hand.filter(k => k !== cardKey);

        this.tweens.add({
            targets: gameObject,
            scale: 0,
            duration: 300,
            onComplete: () => {
                this.sfx.snap.play({ rate: 0.8 });
                // En multijugador, el servidor gestiona el cambio de turno
                // Por ahora solo actualizamos localmente lo básico
            }
        });
    }

    removeFromPlayerOrigin(cardKey, origin, playerType) {
        const p = this.players[playerType];
        if (origin.includes('hand')) {
            p.hand = p.hand.filter(k => k !== cardKey);
        } else if (origin.includes('reserve')) {
            p.reserve.pop();
        } else if (origin.includes('wildcard')) {
            p.wildcards.pop();
        } else if (origin.includes('discard-')) {
            const idx = parseInt(origin.split('-').pop());
            p.discards[idx].pop();
        }
    }

    // New state variables for AI
    isAIThinking = false;
    opponentMoveDelay = 800; // Milliseconds

    endTurn() {
        if (this.currentTurn === 'human') {
            this.currentTurn = 'opponent';
            this.dealer.refillHand(this.players.human.hand, this.players.human.wildcards);
            this.renderBoard();
            this.showMessage("Turno del Oponente", "#ffaa00");
            this.time.delayedCall(this.opponentMoveDelay, () => this.executeOpponentTurn());
        } else {
            this.currentTurn = 'human';
            this.dealer.refillHand(this.players.opponent.hand, this.players.opponent.wildcards);
            this.renderBoard();
            this.showMessage("Tu Turno", "#00ff00");
            // SFX Robo de Carta / Inicio Turno
            this.sfx.shuffle.play({ volume: 0.5 });
        }
    }

    async executeOpponentTurn() {
        this.isAIThinking = true;
        let moved = true;

        while (moved) {
            moved = false;
            const opp = this.players.opponent;

            // 1. Intentar jugar la carta de RESERVA (Prioridad máxima)
            if (opp.reserve.length > 0) {
                const reserveKey = opp.reserve[opp.reserve.length - 1];
                const move = this.findValidMove(reserveKey);
                if (move) {
                    await this.performOpponentMove(reserveKey, move.scaleIndex, 'reserve');
                    moved = true;
                    continue;
                }
            }

            // 2. Intentar jugar desde la MANO
            for (let i = 0; i < opp.hand.length; i++) {
                const cardKey = opp.hand[i];
                const move = this.findValidMove(cardKey);
                if (move) {
                    await this.performOpponentMove(cardKey, move.scaleIndex, 'hand');
                    moved = true;
                    break; // Reiniciar escaneo para priorizar reserva siempre
                }
            }

            // 3. Intentar jugar Comodines si es posible (Opcional, pero ayuda a la fluidez)
            if (!moved && opp.wildcards.length > 0) {
                const wildKey = opp.wildcards[opp.wildcards.length - 1];
                const move = this.findValidMove(wildKey);
                if (move) {
                    await this.performOpponentMove(wildKey, move.scaleIndex, 'wildcard');
                    moved = true;
                }
            }
        }

        // FIN DE JUGADAS: Descarte obligatorio para terminar turno
        await this.opponentDiscard();
        this.isAIThinking = false;
        this.endTurn();
    }

    findValidMove(cardKey) {
        for (let i = 0; i < this.centralScales.length; i++) {
            const result = this.dealer.validateMove(this.centralScales[i], cardKey);
            if (result.valid) return { scaleIndex: i };
        }
        return null;
    }

    async performOpponentMove(cardKey, scaleIndex, origin) {
        // Efecto visual: Carta del oponente aparece y viaja a la escala
        const targetZone = this.dropZones[scaleIndex];
        const tempSprite = this.add.sprite(512, 100, cardKey).setDisplaySize(110, 160).setDepth(1000);

        return new Promise(resolve => {
            this.tweens.add({
                targets: tempSprite,
                x: targetZone.x,
                y: targetZone.y,
                duration: 600,
                onComplete: () => {
                    this.centralScales[scaleIndex].push(cardKey);
                    this.removeFromPlayerOrigin(cardKey, origin, 'opponent');

                    // SFX Movimiento IA
                    this.sfx.snap.play({ volume: 0.4, rate: 1.2 });

                    if (this.dealer.getEffectiveValue(this.centralScales[scaleIndex]) === 12) {
                        this.centralScales[scaleIndex] = [];
                        this.sfx.complete.play({ volume: 0.5 });
                    }

                    tempSprite.destroy();
                    this.renderBoard();
                    this.time.delayedCall(this.opponentMoveDelay, resolve);
                }
            });
        });
    }

    async opponentDiscard() {
        const opp = this.players.opponent;
        if (opp.hand.length > 0) {
            const cardKey = opp.hand.pop();
            return new Promise(resolve => {
                this.showMessage("Jugador 2 descartó", "#ffaa00");
                this.time.delayedCall(800, resolve);
            });
        }
    }

    returnCard(gameObject) {
        const shadow = gameObject.getData('shadow');
        const originalRotation = gameObject.getData('originalRotation') || 0;

        this.tweens.add({
            targets: gameObject,
            x: gameObject.getData('originalX'),
            y: gameObject.getData('originalY'),
            rotation: originalRotation,
            scale: 1,
            duration: 200,
            ease: 'Power2'
        });
        if (shadow) {
            this.tweens.add({
                targets: shadow,
                x: gameObject.getData('originalX') + 5,
                y: gameObject.getData('originalY') + 5,
                rotation: originalRotation,
                scale: 1,
                duration: 200,
                ease: 'Power2'
            });
        }
    }

    showMessage(text, color = '#ffffff') {
        this.messageBuffer.push({ text, color });
        if (!this.isMessageDisplaying) {
            this.displayNextMessage();
        }
    }

    displayNextMessage() {
        if (this.messageBuffer.length === 0) {
            this.isMessageDisplaying = false;
            return;
        }

        this.isMessageDisplaying = true;
        const { text, color } = this.messageBuffer.shift();

        const msgBox = this.add.text(512, 384, text, {
            fontSize: '32px',
            color: color,
            backgroundColor: '#000000aa',
            padding: { x: 20, y: 10 },
            align: 'center',
            wordWrap: { width: 600 }
        }).setOrigin(0.5).setDepth(3000).setAlpha(0);

        this.tweens.add({
            targets: msgBox,
            alpha: 1,
            duration: 300,
            yoyo: true,
            hold: this.displayDuration,
            onComplete: () => {
                msgBox.destroy();
                this.displayNextMessage();
            }
        });
    }

    showError(text, x, y) {
        this.showMessage(text, "#ff0000");
    }

    showRules() {
        const { width, height } = this.scale.displaySize;
        const modal = this.add.container(0, 0).setDepth(5000);
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0).setInteractive();
        const info = this.add.image(width / 2, height / 2, 'rulesInfo').setInteractive();

        // Auto-escalado de la infografía
        const scale = Math.min((width * 0.85) / info.width, (height * 0.85) / info.height);
        info.setScale(scale);

        // Botón de cerrar (Círculo rojo con X)
        const closeBtn = this.add.text(width / 2 + (info.displayWidth / 2), height / 2 - (info.displayHeight / 2), '✕', {
            fontSize: '28px', color: '#fff', backgroundColor: '#f00', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        modal.add([bg, info, closeBtn]);
        const hide = () => modal.destroy();
        bg.on('pointerdown', hide);
        closeBtn.on('pointerdown', hide);

        modal.setAlpha(0);
        this.tweens.add({ targets: modal, alpha: 1, duration: 300 });
    }
}