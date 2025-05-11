# Multiplayer Slither.io-Style Snake Game

This is a real-time multiplayer snake game inspired by **Slither.io**, designed for up to 8 players over a Local Area Network (LAN). Players control a snake that grows by eating food pellets. The goal is to grow as long as possible without colliding into other snakes. The game features smooth real-time movement, mouse-based steering, zoom functionality, and a live leaderboard.

## Features

- **Real-Time Multiplayer:** Up to 8 players can join the game over a LAN and see each other move in real-time (using WebSockets for low-latency updates).
- **Smooth Snake Control:** Move your snake by pointing the mouse cursor – the snake smoothly follows the cursor direction.
- **Growing and Food:** Colored food dots spawn throughout the arena. Eating food makes your snake grow longer (increasing your score).
- **Collisions:** Snakes die if their head collides with another snake's body or head. Dead snakes turn into food that others can consume.
- **Zooming:** Press the **Shift** key or click the **Zoom** button to toggle zoom-out view, giving a wider perspective of the arena.
- **Respawn & Spectate:** After dying, you can instantly respawn by pressing **R** or clicking the screen. While dead, you can watch the game as a spectator.
- **Leaderboard:** A live leaderboard (top-right corner) shows player scores (snake lengths) in descending order.
- **Responsive Canvas:** The HTML5 canvas scales to the full browser window and adjusts on resize, so the game works on different screen sizes (desktop or laptop browsers).

## Project Structure

- **server.js:** Node.js server using Express and the `ws` WebSocket library. Manages game state, handles player connections, and broadcasts updates.
- **public/index.html:** The main HTML page containing the canvas and UI elements (scoreboard, zoom button, respawn overlay).
- **public/style.css:** CSS for layout and styling of the canvas and overlays.
- **public/client.js:** Client-side JavaScript for rendering the game, handling input, and maintaining synchronization with the server.
- **README.md:** Instructions for setup and play (this file).

## Requirements

- **Node.js** (v12+ recommended) installed on the host machine.
- A modern web browser (tested with the latest Chrome/Firefox) for each player.
- All players' devices should be connected to the same local network as the server.

## Setup and Running the Server

1. **Install Dependencies:** In the project directory, run `npm install express ws` to install the required Node.js packages.
2. **Start the Server:** Run `node server.js`. The server will start an HTTP/WebSocket server on port **8080** (default).
   - You should see a console message: `Server running on http://localhost:8080/`.
3. **Open the Game on Clients:** On any computer or device in the LAN, open a web browser and navigate to `http://<server-ip>:8080/`:
   - If you're playing on the same machine that runs the server, you can use `http://localhost:8080/`.
   - If using other devices, replace `<server-ip>` with the server machine's LAN IP address. For example, `http://192.168.1.100:8080/`.
4. **Join the Game:** The game will load in the browser. You should see your snake appear in the arena immediately upon connecting. Open the URL on multiple devices or browser tabs (up to 8) to add more players.

*Note:* The server will reject new connections beyond 8 players for performance. You can adjust this limit by changing `MAX_PLAYERS` in **server.js** if needed.

## Controls and Gameplay

- **Steering:** Move your mouse to control the direction of your snake. The snake will smoothly follow the cursor.
- **Zoom:** Press **Shift** or click the **Zoom Out/In** button to toggle the zoom level. Zooming out gives a broader view (useful for spotting other snakes or food), while zooming in returns to the normal view.
- **Objective:** Eat the colored food pellets (dots) scattered around to grow longer. Your current length (which is also your score) is displayed on the leaderboard.
- **Collisions:** Avoid running into other snakes. If your snake's head hits another snake's body (or head), your snake dies and your remaining body segments turn into food pellets for others to consume.
- **Death and Respawn:** If you die, a **"You died!"** message appears. You can respawn immediately by pressing the **"R" key** or clicking the screen. Upon respawn, you'll start as a new small snake at a random position, with your score reset.
- **Spectating:** While dead (before respawning), you can watch the game. The view remains at the spot where you died, and you can see other snakes moving, but you cannot control a snake until you respawn.
- **Leaderboard:** The top-right displays all active players' scores (snake lengths). It updates in real time as snakes grow or die. Each entry is labeled with the player's color (and a generic name like "Player 3"). When a player dies, they will disappear from the leaderboard until they respawn.

## Technical Notes

- The server maintains an authoritative game state (positions of all snake segments and food pieces) and steps the game at ~30 updates per second. It uses WebSockets to broadcast state updates to all clients.
- The client uses an animation loop (60 FPS) and interpolates positions between server updates for smooth motion of other players' snakes:contentReference[oaicite:2]{index=2}. This reduces jitter and makes movement appear fluid.
- All game logic such as movement, growth, and collision detection runs on the server:contentReference[oaicite:3]{index=3}. The client simply renders the state and sends user input (direction and respawn requests) to the server.
- Snake movement is implemented by continuously moving the head towards the cursor direction and advancing the body segments. When a snake eats food, its length increases gradually (the new segments are added over a few ticks for smooth growth).
- When a snake dies, the server generates new food pellets at the positions of the snake's body segments, creating a rewarding food cache for other players to grab.
- The world is bounded (snakes cannot move beyond the 2000x2000 area). Hitting the boundary will cause a snake to stop moving in that direction (you'll need to turn away).
- You can customize game parameters by editing constants in the code:
  - World size, snake speed, initial length, food count, etc., are defined at the top of **server.js** (and mirrored in **client.js** for rendering).
  - Colors for snakes and food are also defined (currently using a set of distinct colors and random hues for food).

Enjoy playing the game with your friends on your local network! Feel free to modify or extend the project – for example, adding sound effects, mobile touch controls, or more power-ups and game modes.
# Slithering.io

## Credits

Developed by Ikshwaku Vanani

Inspired by slither.io and other real-time .io games

Built using raw WebSockets, HTML5 Canvas, and Node.js

## License

MIT License — feel free to use, remix, and deploy!
