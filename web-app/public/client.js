const socket = io();
let myId = null;
let gameState = null;
let selectedSource = null; // { type: 'hand'|'reserve'|'discard', index: 0, pileIndex: 0 }

const joinBtn = document.getElementById('join-btn');
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const myIdSpan = document.getElementById('my-id');
const statusP = document.getElementById('status');
// const joinBtn ... already declared at top

socket.on('connect', () => {
    statusP.textContent = "Conectado al servidor. Introduzca su nombre.";
    statusP.style.color = "lightgreen";
    joinBtn.disabled = false;
});

socket.on('connect_error', (err) => {
    statusP.textContent = "Error de conexión con el servidor (Socket.IO).";
    statusP.style.color = "salmon";
    console.error('Socket Connection Error:', err);
    joinBtn.disabled = true;
});

joinBtn.addEventListener('click', () => {
    if (!socket.connected) {
        alert("No hay conexión con el servidor.");
        return;
    }
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim();
    if (!name) {
        alert('Por favor, ingresa tu nombre.');
        return;
    }
    socket.emit('join', { name: name });
});

socket.on('joined', (data) => {
    myId = data.playerId;
    // myIdSpan.textContent = myId; // Remove ID display
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

socket.on('player_update', (data) => {
    document.getElementById('status').textContent = `Jugadores conectados: ${data.count}/2`;
});

socket.on('game_start', (data) => {
    console.log('Game Started', data);
    gameState = data.newState;
    renderGame();
});

socket.on('game_update', (data) => {
    console.log('Game Update', data);
    gameState = data.newState;
    renderGame();
});

socket.on('error', (msg) => {
    alert(msg);
    selectedSource = null;
    renderGame(); // Clear selection visuals
});

socket.on('game_reset', (msg) => {
    alert(msg);
    location.reload();
});

function renderGame() {
    if (!gameState) return;

    const myData = gameState.players[myId];
    const opponentId = Object.keys(gameState.players).find(id => id !== myId);
    const oppData = gameState.players[opponentId];

    // Status
    const isMyTurn = gameState.turn === myId;
    turnIndicator.style.display = isMyTurn ? 'inline' : 'none';

    // Update Turn Text
    if (isMyTurn) {
        turnIndicator.textContent = "ES TU TURNO";
        document.body.classList.add('my-turn-bg');
    } else {
        turnIndicator.style.display = 'inline';
        turnIndicator.textContent = oppData ? `Turno de ${oppData.name}` : "Esperando...";
        turnIndicator.style.color = "#ccc";
        turnIndicator.style.animation = "none";
        document.body.classList.remove('my-turn-bg');
    }

    // Update Name Displays
    document.getElementById('my-name-display').textContent = myData.name;
    if (oppData) {
        document.getElementById('opp-name-display').textContent = oppData.name;
    } else {
        document.getElementById('opp-name-display').textContent = 'Esperando Oponente...';
    }

    // My Hand
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = '';
    myData.hand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        cardEl.onclick = () => selectSource('hand', index);
        if (selectedSource && selectedSource.type === 'hand' && selectedSource.index === index) {
            cardEl.classList.add('selected');
        }
        handDiv.appendChild(cardEl);
    });

    // My Reserve
    document.getElementById('my-reserve-count').textContent = myData.reserve.length;
    const reserveTop = document.getElementById('my-reserve-top');
    reserveTop.innerHTML = '';
    if (myData.reserve.length > 0) {
        const topCard = myData.reserve[myData.reserve.length - 1];
        const cardEl = createCardElement(topCard);
        cardEl.onclick = (e) => { e.stopPropagation(); selectSource('reserve', 0); };
        if (selectedSource && selectedSource.type === 'reserve') {
            cardEl.classList.add('selected');
        }
        reserveTop.appendChild(cardEl);
    }

    // My Jokers
    document.getElementById('my-joker-count').textContent = (myData.jokerReserve || []).length;


    // My Discards
    const myMsgDiscards = document.getElementById('my-discards');
    myMsgDiscards.innerHTML = '';
    myData.discards.forEach((pile, pileIndex) => {
        const pileDiv = document.createElement('div');
        pileDiv.className = 'pile';
        pileDiv.onclick = () => handleDiscardClick(pileIndex);

        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            const cardEl = createCardElement(topCard);
            pileDiv.appendChild(cardEl);

            // Allow selecting from discard to play to scale (if valid source)
            // But discard piles are also targets for discarding (end turn)
            // Logic: If I have a card selected from Hand/Reserve/Discard -> Clicking discard pile MEANS "Discard here" (if source is Hand).
            // Wait, can I play FROM discard TO scale? Yes.
            // So if I click discard and nothing is selected, I select it as source.
            // If I click discard and HAND card is selected, I discard there.
        }
        myMsgDiscards.appendChild(pileDiv);
    });

    // Central Scales
    const scalesContainer = document.getElementById('scales-container');
    scalesContainer.innerHTML = '';
    gameState.centralScales.forEach((scale, index) => {
        const scaleDiv = document.createElement('div');
        scaleDiv.className = 'scale';
        scaleDiv.onclick = () => playToScale(index);

        if (scale.length > 0) {
            const topCard = scale[scale.length - 1];
            scaleDiv.appendChild(createCardElement(topCard));
            const count = document.createElement('div');
            count.textContent = `(${scale.length})`;
            count.style.position = 'absolute';
            count.style.bottom = '-20px';
            scaleDiv.appendChild(count);
        } else {
            const count = document.createElement('div');
            count.textContent = `(0)`;
            count.style.position = 'absolute'; // fix layout
            scaleDiv.appendChild(count);
        }
        scalesContainer.appendChild(scaleDiv);
    });

    // Opponent (simplified view)
    if (oppData) {
        document.getElementById('opp-reserve-count').textContent = oppData.reserve.length;
        const oppHandDiv = document.getElementById('opp-hand');
        oppHandDiv.textContent = `${oppData.hand.length} cards`;

        const oppDiscards = document.getElementById('opp-discards');
        oppDiscards.innerHTML = '';
        oppData.discards.forEach(pile => {
            const pileDiv = document.createElement('div');
            pileDiv.className = 'pile';
            if (pile.length > 0) {
                pileDiv.appendChild(createCardElement(pile[pile.length - 1]));
            }
            oppDiscards.appendChild(pileDiv);
        });
    }
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card`; // remove suit class as we use image

    const img = document.createElement('img');
    let filename = '';

    // Map Spanish Suits to French SVGs found in assets
    // Oros -> Diamond (Gold/Diamonds)
    // Copas -> Heart (Cups/Hearts)
    // Espadas -> Spade (Swords/Spades)
    // Bastos -> Club (Clubs/Clubs)

    // Validate value mapping: 
    // Spanish 1-7, 10-12 usually. But this game uses 1-12.
    // SVGs have: 1-13. 
    // 1 -> 1 (As)
    // 11 -> Jack? 12 -> Queen? 13 -> King?
    // In our Logic: 11, 12.
    // So:
    // 1..10 -> 1..10
    // 11 -> 11-JACK? Or just 11? 
    // Reviewing file list: "CLUB-11-JACK.svg".
    // So 11 maps to 11-JACK, 12 to 12-QUEEN.

    if (card.isJoker) {
        // JOKER-1.svg
        filename = 'JOKER-1.svg';
    } else {
        let suitMap = {
            'Oros': 'DIAMOND',
            'Copas': 'HEART',
            'Espadas': 'SPADE',
            'Bastos': 'CLUB'
        };
        let sv = card.value;
        if (sv === 11) sv = '11-JACK';
        if (sv === 12) sv = '12-QUEEN';
        if (sv === 13) sv = '13-KING'; // logic 1-12, but maybe logic uses 13?

        filename = `${suitMap[card.suit]}-${sv}.svg`;
    }

    img.src = `assets/${filename}`;
    img.style.width = '100%';
    img.style.height = '100%';

    el.appendChild(img);
    // el.textContent = ... remove text content
    return el;
}

function selectSource(type, index) {
    if (gameState.turn !== myId) return;

    // Toggle selection
    if (selectedSource && selectedSource.type === type && selectedSource.index === index) {
        selectedSource = null;
    } else {
        selectedSource = { type, index };
    }
    renderGame();
}

function handleDiscardClick(pileIndex) {
    if (gameState.turn !== myId) return;

    if (selectedSource && selectedSource.type === 'hand') {
        // ACTION: Discard card from hand to pileIndex
        socket.emit('discard', { cardIndex: selectedSource.index, discardPileIndex: pileIndex });
        selectedSource = null;
    } else if (!selectedSource) {
        // Select this discard pile as SOURCE
        // But only if it has cards
        const myData = gameState.players[myId];
        if (myData.discards[pileIndex].length > 0) {
            selectSource('discard', pileIndex);
        }
    }
}

function playToScale(scaleIndex) {
    if (!selectedSource) return;

    socket.emit('play_card', {
        source: selectedSource.type,
        sourceIndex: selectedSource.index,
        target: 'scale',
        targetIndex: scaleIndex
    });
    // Don't clear selection immediately? Game update will redraw.
    // Ideally clear on success, but here rely on server 'game_update' or 'error'.
}

function toggleCheatSheet() {
    const modal = document.getElementById('cheat-sheet-modal');
    modal.classList.toggle('hidden');
}
