// server.js - Node.js WebSocket server for the multiplayer snake game
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Configuration constants
const PORT = 8080;
const TICK_RATE = 30;               // server updates per second
const TICK_INTERVAL = 1000 / TICK_RATE;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const SNAKE_INITIAL_LENGTH = 10;
const SNAKE_SPEED = 4;             // movement speed (pixels per tick)
const SNAKE_RADIUS = 10;           // radius of snake segment (for collision)
const MAX_PLAYERS = 8;
const FOOD_INITIAL_COUNT = 100;
const FOOD_RADIUS = 5;
const GROW_PER_FOOD = 5;           // segments to grow per food eaten

// Predefined colors for snake skins (will cycle if more than colors length players)
const SNAKE_COLORS = ["#ff0000", "#00aa00", "#0000ff", "#ffa500", "#8000ff", "#00cccc", "#ff00ff", "#ffff00"];

// Data structures to hold game state
let nextPlayerId = 1;
const players = {};   // Map from player ID to player object

let foodIdCounter = 1;
let foods = [];

// Helper function: generate a random food color (bright colors via HSL)
function randomFoodColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 50%)`;
}

// Helper function: spawn a single food at a random location
function spawnFood() {
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    const color = randomFoodColor();
    foods.push({ id: foodIdCounter++, x: x, y: y, color: color });
}

// Initialize the food array with some food items
for (let i = 0; i < FOOD_INITIAL_COUNT; i++) {
    spawnFood();
}

// Helper function: create or reset a snake for a player
function createSnakeForPlayer(player) {
    // Find a random spawn position not too close to other snakes
    let spawnX, spawnY;
    const SAFE_DISTANCE = 100;
    let attempts = 0;
    while (true) {
        spawnX = Math.random() * WORLD_WIDTH;
        spawnY = Math.random() * WORLD_HEIGHT;
        // Check distance from all alive players' heads
        let safe = true;
        for (const pid in players) {
            if (!players[pid].alive) continue;
            const dx = players[pid].segments[0].x - spawnX;
            const dy = players[pid].segments[0].y - spawnY;
            if (Math.sqrt(dx*dx + dy*dy) < SAFE_DISTANCE) {
                safe = false;
                break;
            }
        }
        if (safe || attempts > 10) break;
        attempts++;
    }
    // Determine initial direction (random angle)
    const angle = Math.random() * 2 * Math.PI;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    // Create snake segments in a line opposite to direction
    const segments = [];
    const spacing = SNAKE_RADIUS * 2;  // segment spacing
    segments.push({ x: spawnX, y: spawnY }); // head
    for (let i = 1; i < SNAKE_INITIAL_LENGTH; i++) {
        // Position each subsequent segment behind the previous one
        const segX = spawnX - dirX * spacing * i;
        const segY = spawnY - dirY * spacing * i;
        segments.push({ x: segX, y: segY });
    }
    // Reset player state
    player.segments = segments;
    player.direction = { x: dirX, y: dirY };
    player.grow = 0;
    player.score = 0;
    player.alive = true;
}

// Set up Express app to serve static files
const app = express();
app.use(express.static('public'));
const server = http.createServer(app);

// Set up WebSocket server
const wss = new WebSocket.Server({ server });

// Handle new player connections
wss.on('connection', (ws) => {
    if (Object.keys(players).length >= MAX_PLAYERS) {
        // Reject connection if server is at capacity
        ws.send(JSON.stringify({ type: 'error', message: 'Server full' }));
        ws.close();
        return;
    }
    const playerId = nextPlayerId++;
    const playerName = "Player " + playerId;
    const playerColor = SNAKE_COLORS[(playerId - 1) % SNAKE_COLORS.length];
    // Create player object
    players[playerId] = {
        id: playerId,
        name: playerName,
        color: playerColor,
        ws: ws,
        segments: [],
        direction: { x: 0, y: 0 },
        score: 0,
        grow: 0,
        alive: false
    };
    // Attach playerId to WebSocket for easy lookup
    ws.playerId = playerId;
    // Initialize snake for this player
    createSnakeForPlayer(players[playerId]);
    // Send initialization info to the client
    const initData = {
        type: 'init',
        id: playerId,
        name: playerName,
        color: playerColor
    };
    ws.send(JSON.stringify(initData));

    // Handle incoming messages from this player
    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return;
        }
        const player = players[playerId];
        if (!player) return;
        if (msg.type === 'dir') {
            // Update player direction (mouse movement)
            if (player.alive && typeof msg.dx === 'number' && typeof msg.dy === 'number') {
                // Normalize direction vector just in case
                const len = Math.sqrt(msg.dx*msg.dx + msg.dy*msg.dy);
                if (len > 0) {
                    player.direction.x = msg.dx / len;
                    player.direction.y = msg.dy / len;
                }
            }
        } else if (msg.type === 'respawn') {
            // Respawn request
            if (!player.alive) {
                createSnakeForPlayer(player);
                // (The player will be included in the next state update broadcast)
                player.ws.send(JSON.stringify({ type: 'init', id: playerId, name: player.name, color: player.color }));
            }
        }
    });

    // Handle player disconnection
    ws.on('close', () => {
        const player = players[playerId];
        if (!player) return;
        // If player was alive, turn their snake into food
        if (player.alive) {
            for (let s = 0; s < player.segments.length; s += 2) {
                const segPos = player.segments[s];
                foods.push({ id: foodIdCounter++, x: segPos.x, y: segPos.y, color: randomFoodColor() });
            }
        }
        // Remove player from game state
        delete players[playerId];
    });
});

// Game update loop
function gameTick() {
    // Move each snake and handle wall boundaries
    for (const pid in players) {
        const player = players[pid];
        if (!player.alive) continue;
        const head = player.segments[0];
        // Compute new head position
        let newHeadX = head.x + player.direction.x * SNAKE_SPEED;
        let newHeadY = head.y + player.direction.y * SNAKE_SPEED;
        // Clamp to world boundaries
        if (newHeadX < 0) newHeadX = 0;
        if (newHeadX > WORLD_WIDTH) newHeadX = WORLD_WIDTH;
        if (newHeadY < 0) newHeadY = 0;
        if (newHeadY > WORLD_HEIGHT) newHeadY = WORLD_HEIGHT;
        // Only update if movement happened (avoid shrinking at wall)
        if (newHeadX !== head.x || newHeadY !== head.y) {
            // Insert new head at front of segments
            player.segments.unshift({ x: newHeadX, y: newHeadY });
            if (player.grow > 0) {
                // Consume one unit of growth instead of removing tail
                player.grow--;
            } else {
                // Remove last segment to maintain length
                player.segments.pop();
            }
        } else {
            // No movement (snake is against a wall), do not remove tail or consume growth
        }
    }

    // Collision detection: gather snakes to kill
    const toKill = new Set();
    const playerIds = Object.keys(players).filter(pid => players[pid].alive);
    // Head-to-body collisions
    for (let i = 0; i < playerIds.length; i++) {
        const A = players[playerIds[i]];
        const headA = A.segments[0];
        for (let j = 0; j < playerIds.length; j++) {
            if (i === j) continue;
            const B = players[playerIds[j]];
            // Check A's head against each segment of B (excluding B's head)
            for (let k = 0; k < B.segments.length; k++) {
                if (k === 0) continue; // skip B's head for now
                const segB = B.segments[k];
                const dx = headA.x - segB.x;
                const dy = headA.y - segB.y;
                if (Math.sqrt(dx*dx + dy*dy) < SNAKE_RADIUS * 2) {
                    toKill.add(A.id);
                    break;
                }
            }
            if (toKill.has(A.id)) break;
        }
    }
    // Head-to-head collisions
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            const A = players[playerIds[i]];
            const B = players[playerIds[j]];
            const dx = A.segments[0].x - B.segments[0].x;
            const dy = A.segments[0].y - B.segments[0].y;
            if (Math.sqrt(dx*dx + dy*dy) < SNAKE_RADIUS * 2) {
                // Both heads collided
                if (A.segments.length > B.segments.length) {
                    toKill.add(B.id);
                } else if (B.segments.length > A.segments.length) {
                    toKill.add(A.id);
                } else {
                    toKill.add(A.id);
                    toKill.add(B.id);
                }
            }
        }
    }
    // Process deaths
    toKill.forEach(id => {
        const player = players[id];
        if (player && player.alive) {
            player.alive = false;
            // Convert snake into food pieces
            for (let s = 0; s < player.segments.length; s += 2) {
                const segPos = player.segments[s];
                foods.push({ id: foodIdCounter++, x: segPos.x, y: segPos.y, color: randomFoodColor() });
            }
            player.segments = [];
            player.score = 0;
            // Notify the player (if still connected) of death
            if (player.ws && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify({ type: 'dead' }));
            }
        }
    });

    // Food consumption
    for (const pid in players) {
        const player = players[pid];
        if (!player.alive) continue;
        const head = player.segments[0];
        // Check collision with each food (iterate backwards since we may remove items)
        for (let f = foods.length - 1; f >= 0; f--) {
            const food = foods[f];
            const dx = head.x - food.x;
            const dy = head.y - food.y;
            if (Math.sqrt(dx*dx + dy*dy) < SNAKE_RADIUS + FOOD_RADIUS) {
                // Snake eats the food
                player.score += 1;
                player.grow += GROW_PER_FOOD;
                // Remove food and spawn a new one
                foods.splice(f, 1);
                spawnFood();
            }
        }
    }

    // Prepare state update message
    const snakesState = [];
    for (const pid in players) {
        const player = players[pid];
        if (!player.alive) continue;
        snakesState.push({
            id: player.id,
            name: player.name,
            color: player.color,
            score: player.segments.length,
            segments: player.segments
        });
    }
    // Sort leaderboard by score (descending)
    snakesState.sort((a, b) => b.score - a.score);
    const leaderboard = snakesState.map(s => ({ name: s.name, score: s.score, color: s.color }));

    const updateData = {
        type: 'update',
        snakes: snakesState,
        foods: foods,
        leaderboard: leaderboard
    };
    const updateJson = JSON.stringify(updateData);
    // Broadcast state to all connected clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(updateJson);
        }
    });
}

// Start the game loop
setInterval(gameTick, TICK_INTERVAL);

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/`);
});
