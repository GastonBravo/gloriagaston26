class Card {
    constructor(suit, value, isJoker = false) {
        this.suit = suit; // 'Oros', 'Copas', 'Espadas', 'Bastos' (or 'Joker')
        this.value = value; // 1-12. Joker has value 0 or special.
        this.isJoker = isJoker;
    }

    toString() {
        if (this.isJoker) return 'Joker';
        return `${this.value} of ${this.suit}`;
    }
}

class Game {
    constructor() {
        this.players = {}; // { socketId: { hand: [], reserve: [], discards: [[],[],[],[]], id: 'p1' } }
        this.centralScales = [[], [], [], []]; // 4 scales
        this.drawPile = [];
        this.turn = null; // socketId of current player
        this.winner = null;
        this.status = 'waiting'; // waiting, playing, finished
    }

    addPlayer(id, name) {
        if (Object.keys(this.players).length >= 2) return false;
        this.players[id] = {
            id: id,
            name: name || `Player ${Object.keys(this.players).length + 1}`,
            hand: [],
            reserve: [],
            discards: [[], [], [], []],
            ready: false
        };
        return true;
    }

    startGame() {
        if (Object.keys(this.players).length !== 2) return false;

        // Create Deck (2 decks combined or 1? Rules say "mazo de cartas español". Usually for this game 2 decks are used or 1 big one.
        // "26 cards each" -> 2 players * 26 = 52 cards used just for setup. 
        // A standard Spanish deck has 40-50 cards. 52 > 50. 
        // So we need TWO decks.
        // Rules say: "Cada jugador inicia con 26 cartas".
        // Let's assume 2 decks of 50 cards = 100 cards.

        this.drawPile = this.createDeck(2);
        this.shuffle(this.drawPile);

        // Deal
        const playerIds = Object.keys(this.players);
        playerIds.forEach(pid => {
            const player = this.players[pid];
            // 20 for reserve
            for (let i = 0; i < 20; i++) player.reserve.push(this.drawPile.pop());
            // 6 for hand
            for (let i = 0; i < 6; i++) player.hand.push(this.drawPile.pop());
        });

        this.turn = playerIds[0];
        this.status = 'playing';
        return true;
    }

    createDeck(numDecks = 1) {
        const suits = ['Oros', 'Copas', 'Espadas', 'Bastos'];
        const cards = [];
        for (let d = 0; d < numDecks; d++) {
            for (const suit of suits) {
                for (let v = 1; v <= 12; v++) {
                    cards.push(new Card(suit, v));
                }
            }
            // Add 2 Jokers per deck
            cards.push(new Card('Joker', 13, true));
            cards.push(new Card('Joker', 13, true));
        }
        return cards;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // Move validation
    // Source: 'hand', 'reserve', 'discard'
    // SourceIndex: index in hand/discard
    // Target: 'scale'
    // TargetIndex: index of scale (0-3)
    playCard(playerId, source, sourceIndex, target, targetIndex) {
        if (this.status !== 'playing') return { success: false, message: 'Game not playing' };
        if (this.turn !== playerId) return { success: false, message: 'Not your turn' };

        const player = this.players[playerId];
        let card;

        // Locate card
        if (source === 'hand') {
            card = player.hand[sourceIndex];
        } else if (source === 'reserve') {
            // Can only play top card of reserve
            // Actually reserve is a stack, but maybe we just take the last one?
            // "solo la superior visible". Yes, last one.
            if (player.reserve.length === 0) return { success: false, message: 'Reserve empty' };
            card = player.reserve[player.reserve.length - 1]; // Peek
        } else if (source === 'discard') {
            const pile = player.discards[sourceIndex];
            if (!pile || pile.length === 0) return { success: false, message: 'Discard pile empty' };
            card = pile[pile.length - 1]; // Peek
        }

        if (!card) return { success: false, message: 'Card not found' };

        // Validate Move to Scale
        if (target === 'scale') {
            const scale = this.centralScales[targetIndex];
            const lastCard = scale.length > 0 ? scale[scale.length - 1] : null;

            let isValid = false;

            // Logic for scale: Ascending 1..12
            // If empty, must be 1 (As) or Joker? 
            // Rules: "Deben iniciar obligatoriamente con un AS (valor 1)" => Joker allowed? 
            // Rules: "COMODINES: Pueden sustituir cualquier valor excepto el As (1) y la Q (12)." 
            // So NO Joker on 1.

            const nextVal = lastCard ? (lastCard.value === 13 ? this.getVirtualValue(scale) + 1 : lastCard.value + 1) : 1;

            if (card.isJoker) {
                // Cannot be 1 or 12 (which is virtual 12).
                if (nextVal === 1 || nextVal === 12) isValid = false;
                else {
                    // "REGLA DE ADYACENCIA: Prohibido colocar dos comodines seguidos"
                    if (lastCard && lastCard.isJoker) isValid = false;
                    else isValid = true;
                }
            } else {
                if (card.value === nextVal) isValid = true;
            }

            if (isValid) {
                // Execute Move
                if (source === 'hand') player.hand.splice(sourceIndex, 1);
                else if (source === 'reserve') player.reserve.pop();
                else if (source === 'discard') player.discards[sourceIndex].pop();

                scale.push(card);

                // Check Win
                if (player.reserve.length === 0) {
                    this.status = 'finished';
                    this.winner = playerId;
                }

                // Refill Hand if empty? Rules don't strictly say immediate refill, but implied.
                // Usually in these games you verify hand at start of turn.
                // Rules: "repone la mano hasta tener 6 cartas naturales" -> implying immediate.
                this.refillHand(playerId);

                return { success: true };
            }
        }

        return { success: false, message: 'Invalid move' };
    }

    // Helper to determine value of top card even if joker
    getVirtualValue(scale) {
        if (scale.length === 0) return 0;
        // Iterate relevant cards to find value
        // Simple: scale length IS the value! (since 1,2,3... no skips)
        // Except if jokers are used. But Scale length tracks count.
        // If Scale[0] is As(1). Length 1.
        // If Scale[1] is 2. Length 2.
        // So virtual value = length.
        return scale.length;
    }

    discard(playerId, cardIndex, discardPileIndex) {
        if (this.status !== 'playing') return false;
        if (this.turn !== playerId) return false;

        const player = this.players[playerId];
        const card = player.hand[cardIndex];
        if (!card) return false;

        // Move to discard
        player.hand.splice(cardIndex, 1);
        player.discards[discardPileIndex].push(card);

        // Switch turn
        const ids = Object.keys(this.players);
        const nextIndex = (ids.indexOf(playerId) + 1) % ids.length;
        this.turn = ids[nextIndex];

        // New Turn Prep
        this.startTurn(this.turn);

        return true;
    }

    startTurn(playerId) {
        this.refillHand(playerId);
    }

    refillHand(playerId) {
        const player = this.players[playerId];
        while (player.hand.length < 6 && this.drawPile.length > 0) {
            const card = this.drawPile.pop();
            // "Si un jugador roba un comodín... se mueve automáticamente a su Reserva de Comodines y se repone"
            // Wait, rules said "Reserva de Comodines"? "se mueve automáticamente a su Reserva de Comodines"
            // Does this mean it leaves the hand? Yes.
            // And "repone la mano hasta tener 6 cartas naturales".
            if (card.isJoker) {
                // handle joker special rule?
                // For now, let's just put it in hand to verify logic first, or add a 'jokerReserve' property.
                // Detailed rules: "Si un jugador roba un comodín... se mueve automáticamente a su Reserva de Comodines"
                // This implies specific Joker Piles.
                if (!player.jokerReserve) player.jokerReserve = [];
                player.jokerReserve.push(card);
            } else {
                player.hand.push(card);
            }
        }
    }
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game, Card };
}
