import './style.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PlayScene } from './scenes/PlayScene';

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#1a1a1a',
  parent: 'game-container',
  scene: [BootScene, PlayScene]
};

new Phaser.Game(config);