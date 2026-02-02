import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    create() {
        const { width, height } = this.scale;

        // Comprobación de sesión - CAMBIO ESPECÍFICO 1
        const savedName = localStorage.getItem('26_player_name');
        if (savedName) {
            this.scene.start('PlayScene', { playerName: savedName });
            return;
        }

        // Fondo neón
        this.add.rectangle(0, 0, width, height, 0x1a1a1a).setOrigin(0);

        this.add.text(width / 2, height / 3, 'BIENVENIDO A 26', {
            fontSize: '64px',
            color: '#00d4ff',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2, 'Haz clic para ingresar tu nombre y comenzar', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            const playerName = prompt("¿Cuál es tu nombre?", "Jugador 1");
            if (playerName) {
                // Guardado de sesión - CAMBIO ESPECÍFICO 2
                localStorage.setItem('26_player_name', playerName);
                this.scene.start('PlayScene', { playerName });
            }
        });
    }
}
