/**
 * Dealer.js - Motor de Lógica para el juego "26"
 * 
 * Basado en las reglas de marco_rtce.md (RTCE)
 */

export const CARD_MAP = {
    // CLUBS
    'CLUB-1': { value: 1, suit: 'CLUBS', isJoker: false },
    'CLUB-2': { value: 2, suit: 'CLUBS', isJoker: false },
    'CLUB-3': { value: 3, suit: 'CLUBS', isJoker: false },
    'CLUB-4': { value: 4, suit: 'CLUBS', isJoker: false },
    'CLUB-5': { value: 5, suit: 'CLUBS', isJoker: false },
    'CLUB-6': { value: 6, suit: 'CLUBS', isJoker: false },
    'CLUB-7': { value: 7, suit: 'CLUBS', isJoker: false },
    'CLUB-8': { value: 8, suit: 'CLUBS', isJoker: false },
    'CLUB-9': { value: 9, suit: 'CLUBS', isJoker: false },
    'CLUB-10': { value: 10, suit: 'CLUBS', isJoker: false },
    'CLUB-11-JACK': { value: 11, suit: 'CLUBS', isJoker: false },
    'CLUB-12-QUEEN': { value: 12, suit: 'CLUBS', isJoker: false },
    'CLUB-13-KING': { value: 13, suit: 'CLUBS', isJoker: true },

    // DIAMONDS
    'DIAMOND-1': { value: 1, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-2': { value: 2, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-3': { value: 3, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-4': { value: 4, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-5': { value: 5, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-6': { value: 6, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-7': { value: 7, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-8': { value: 8, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-9': { value: 9, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-10': { value: 10, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-11-JACK': { value: 11, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-12-QUEEN': { value: 12, suit: 'DIAMONDS', isJoker: false },
    'DIAMOND-13-KING': { value: 13, suit: 'DIAMONDS', isJoker: true },

    // HEARTS
    'HEART-1': { value: 1, suit: 'HEARTS', isJoker: false },
    'HEART-2': { value: 2, suit: 'HEARTS', isJoker: false },
    'HEART-3': { value: 3, suit: 'HEARTS', isJoker: false },
    'HEART-4': { value: 4, suit: 'HEARTS', isJoker: false },
    'HEART-5': { value: 5, suit: 'HEARTS', isJoker: false },
    'HEART-6': { value: 6, suit: 'HEARTS', isJoker: false },
    'HEART-7': { value: 7, suit: 'HEARTS', isJoker: false },
    'HEART-8': { value: 8, suit: 'HEARTS', isJoker: false },
    'HEART-9': { value: 9, suit: 'HEARTS', isJoker: false },
    'HEART-10': { value: 10, suit: 'HEARTS', isJoker: false },
    'HEART-11-JACK': { value: 11, suit: 'HEARTS', isJoker: false },
    'HEART-12-QUEEN': { value: 12, suit: 'HEARTS', isJoker: false },
    'HEART-13-KING': { value: 13, suit: 'HEARTS', isJoker: true },

    // SPADES
    'SPADE-1': { value: 1, suit: 'SPADES', isJoker: false },
    'SPADE-2': { value: 2, suit: 'SPADES', isJoker: false },
    'SPADE-3': { value: 3, suit: 'SPADES', isJoker: false },
    'SPADE-4': { value: 4, suit: 'SPADES', isJoker: false },
    'SPADE-5': { value: 5, suit: 'SPADES', isJoker: false },
    'SPADE-6': { value: 6, suit: 'SPADES', isJoker: false },
    'SPADE-7': { value: 7, suit: 'SPADES', isJoker: false },
    'SPADE-8': { value: 8, suit: 'SPADES', isJoker: false },
    'SPADE-9': { value: 9, suit: 'SPADES', isJoker: false },
    'SPADE-10': { value: 10, suit: 'SPADES', isJoker: false },
    'SPADE-11-JACK': { value: 11, suit: 'SPADES', isJoker: false },
    'SPADE-12-QUEEN': { value: 12, suit: 'SPADES', isJoker: false },
    'SPADE-13-KING': { value: 13, suit: 'SPADES', isJoker: true },

    // JOKERS
    'JOKER-1': { value: 0, suit: 'NONE', isJoker: true },
    'JOKER-2': { value: 0, suit: 'NONE', isJoker: true },
    'JOKER-3': { value: 0, suit: 'NONE', isJoker: true },
};

export class Dealer {
    constructor() {
        this.deck = [];
        this.players = {
            human: { hand: [], reserve: [], wildcards: [], discards: [[], [], [], []] },
            opponent: { hand: [], reserve: [], wildcards: [], discards: [[], [], [], []] }
        };
        this.resetDeck();
    }

    /**
     * Crea un mazo barajado con 2 mazos completos (110 cartas aprox)
     */
    resetDeck() {
        const singleDeck = Object.keys(CARD_MAP);
        this.deck = [...singleDeck, ...singleDeck]; // Duplicamos para tener 2 mazos
        this.shuffle(this.deck);
    }

    /**
     * Algoritmo Fisher-Yates para barajar
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Reparte la configuración inicial para ambos jugadores
     */
    dealGame() {
        this.resetDeck();

        // Repartir al Humano
        this.players.human.reserve = this.deck.splice(-20);
        this.refillHand(this.players.human.hand, this.players.human.wildcards);

        // Repartir al Oponente
        this.players.opponent.reserve = this.deck.splice(-20);
        this.refillHand(this.players.opponent.hand, this.players.opponent.wildcards);

        return this.players;
    }

    /**
     * Rellena la mano hasta tener 6 cartas naturales.
     * Los comodines encontrados se mueven a la pila de comodines.
     */
    refillHand(hand, wildcards) {
        while (hand.length < 6 && this.deck.length > 0) {
            const cardKey = this.deck.pop();
            const card = CARD_MAP[cardKey];

            if (card.isJoker) {
                wildcards.push(cardKey);
            } else {
                hand.push(cardKey);
            }
        }
    }

    /**
     * Finaliza el turno. Actualmente solo sirve de hook para lógica futura.
     */
    endTurn() {
        return { message: "Turno finalizado." };
    }

    /**
     * Valida si una carta puede ser colocada en una escala
     * @param {Array} currentScale Array de keys de cartas actualmente en la escala
     * @param {string} newCardKey Key de la carta a colocar
     * @returns {Object} { valid: boolean, reason: string }
     */
    validateMove(currentScale, newCardKey) {
        const newCard = CARD_MAP[newCardKey];

        // Regla: Una nueva escala DEBE empezar con un AS
        if (currentScale.length === 0) {
            if (newCard.value === 1) return { valid: true };
            return { valid: false, reason: "Una escala debe iniciar obligatoriamente con un AS (1)." };
        }

        const lastCardKey = currentScale[currentScale.length - 1];
        const lastCard = CARD_MAP[lastCardKey];
        const lastEffectiveValue = this.getEffectiveValue(currentScale);

        // Regla: No se pueden usar comodines para el AS ni para la QUEEN
        // Pero el AS ya está validado arriba. Validamos si la nueva carta es el final (Q=12)
        const nextValue = lastEffectiveValue + 1;

        if (nextValue === 12 && newCard.isJoker) {
            return { valid: false, reason: "No se puede usar un comodín para sustituir a la REINA (12)." };
        }

        // Regla de Adyacencia: Prohibido dos comodines seguidos
        if (lastCard.isJoker && newCard.isJoker) {
            return { valid: false, reason: "Regla de Adyacencia: No se pueden colocar dos comodines seguidos." };
        }

        // Si es natural, debe ser el valor siguiente
        if (!newCard.isJoker && newCard.value !== nextValue) {
            return { valid: false, reason: `Movimiento inválido. Se esperaba un ${nextValue} o un comodín.` };
        }

        // Si la escala ya está completa (llegó a 12), no se puede añadir más
        if (lastEffectiveValue >= 12) {
            return { valid: false, reason: "La escala ya está terminada (llegó a la Reina)." };
        }

        return { valid: true };
    }

    /**
     * Calcula qué valor representa la última carta de la escala
     */
    getEffectiveValue(scale) {
        if (scale.length === 0) return 0;
        // En este juego, como es incremental 1 a 1, el valor efectivo es simplemente el largo de la escala
        return scale.length;
    }
}