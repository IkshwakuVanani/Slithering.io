/* client.js - Client-side game logic for the snake game */
(function(){
    // Canvas and context setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    // Adjust canvas to full window size
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  
    // Game state variables (client-side)
    const WORLD_WIDTH = 2000;
    const WORLD_HEIGHT = 2000;
    let playerId = null;
    let isAlive = true;
    let currentZoom = 1;
    let camX = 0, camY = 0;  // camera center in world coords
    // State data received from server
    let prevSnakes = {};
    let currSnakes = {};
    let foods = [];
    // Timestamp of last server update (for interpolation)
    let lastUpdateTime = performance.now();
    const SERVER_TICK = 1000/30; // ~33ms per server tick (30 FPS server updates)
  
    // Track mouse position for input (default to center)
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
  
    // Connect to the WebSocket server
    const socket = new WebSocket(`ws://${location.host}`);
    socket.onopen = () => {
      console.log("Connected to game server");
    };
    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (msg.type === 'init') {
        // Save assigned player info
        playerId = msg.id;
        // (We could also use msg.color or name if needed for UI)
      } else if (msg.type === 'update') {
        // Preserve previous state for interpolation
        prevSnakes = {};
        for (const id in currSnakes) {
          // Deep copy each snake's segments
          prevSnakes[id] = {
            id: currSnakes[id].id,
            color: currSnakes[id].color,
            segments: currSnakes[id].segments.map(pt => ({x: pt.x, y: pt.y}))
          };
        }
        // Update current state with new data
        currSnakes = {};
        msg.snakes.forEach(snake => {
          currSnakes[snake.id] = {
            id: snake.id,
            name: snake.name,
            color: snake.color,
            segments: snake.segments
          };
        });
        foods = msg.foods;
        lastUpdateTime = performance.now();
        // Update the leaderboard display
        const scoreList = document.getElementById('scoreList');
        scoreList.innerHTML = "";
        msg.leaderboard.forEach(entry => {
          const li = document.createElement('li');
          li.innerHTML = `<span style="color:${entry.color}">●</span> ${entry.name}: ${entry.score}`;
          scoreList.appendChild(li);
        });
        // If our player is no longer in the state, mark as dead (spectator)
        if (playerId && !(playerId in currSnakes)) {
          isAlive = false;
        }
      } else if (msg.type === 'dead') {
        // Received when our snake dies – show respawn overlay
        isAlive = false;
        document.getElementById('respawnOverlay').style.display = 'block';
      } else if (msg.type === 'error') {
        // Server-side error (e.g., server full)
        alert(msg.message || "Server error");
      }
    };
    socket.onclose = () => {
      console.log("Disconnected from server");
      alert("Disconnected from server.");
    };
  
    // Handle zoom toggle (Shift key or button)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        if (!e.repeat) {
          // Toggle zoom in/out
          currentZoom = (currentZoom === 1 ? 0.5 : 1);
          document.getElementById('zoomButton').innerText = 
            (currentZoom === 1 ? "Zoom Out" : "Zoom In");
        }
      } else if (e.key.toLowerCase() === 'r') {
        // Respawn on 'R' key
        if (!isAlive) {
          respawn();
        }
      }
    });
    document.getElementById('zoomButton').addEventListener('click', () => {
      currentZoom = (currentZoom === 1 ? 0.5 : 1);
      document.getElementById('zoomButton').innerText = 
        (currentZoom === 1 ? "Zoom Out" : "Zoom In");
    });
  
    // Respawn function: send request to server and reset state
    function respawn() {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'respawn' }));
      }
      // Hide overlay and mark player as alive (will get new state from server)
      document.getElementById('respawnOverlay').style.display = 'none';
      isAlive = true;
    }
    document.getElementById('respawnOverlay').addEventListener('click', respawn);
  
    // Send snake direction to server based on mouse position (regularly)
    function sendDirection() {
      if (socket.readyState !== WebSocket.OPEN || playerId === null || !isAlive) return;
      // Calculate direction vector relative to the player's snake (camera is centered on player)
      const dx = (mouseX - canvas.width / 2) / currentZoom;
      const dy = (mouseY - canvas.height / 2) / currentZoom;
      const len = Math.sqrt(dx*dx + dy*dy);
      let dirX = 0, dirY = 0;
      if (len > 0) {
        dirX = dx / len;
        dirY = dy / len;
      }
      const message = { type: 'dir', dx: dirX, dy: dirY };
      socket.send(JSON.stringify(message));
    }
    // Send input ~30 times per second
    setInterval(sendDirection, 33);
  
    // Render loop (60 FPS) – draws the game state
    function animate() {
      requestAnimationFrame(animate);
      // Clear the canvas
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  
      // Update camera position to follow the player (or remain at last position if dead)
      if (playerId && currSnakes[playerId]) {
        const mySnake = currSnakes[playerId];
        camX = mySnake.segments[0].x;
        camY = mySnake.segments[0].y;
      }
      // Apply camera transform (translate to center + zoom)
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(currentZoom, currentZoom);
      ctx.translate(-camX, -camY);
  
      // Draw food pellets
      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(food.x, food.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
  
      // Draw snakes (interpolate positions for smoothness)
      const now = performance.now();
      let t = (now - lastUpdateTime) / SERVER_TICK;
      if (t > 1) t = 1;
      for (const id in currSnakes) {
        const snake = currSnakes[id];
        const prevSnake = prevSnakes[id];
        let segmentsToDraw = [];
        if (prevSnake && prevSnake.segments.length) {
          // Interpolate between old and new segment positions
          const oldSegs = prevSnake.segments;
          const newSegs = snake.segments;
          // Duplicate or trim old segments array to match new length
          let oldSegsInterp = oldSegs.map(pt => ({x: pt.x, y: pt.y}));
          if (newSegs.length > oldSegsInterp.length) {
            while (oldSegsInterp.length < newSegs.length) {
              const tail = oldSegsInterp[oldSegsInterp.length - 1];
              oldSegsInterp.push({ x: tail.x, y: tail.y });
            }
          } else if (newSegs.length < oldSegsInterp.length) {
            oldSegsInterp = oldSegsInterp.slice(0, newSegs.length);
          }
          // Compute interpolated positions
          for (let s = 0; s < newSegs.length; s++) {
            const oldPt = oldSegsInterp[s] || newSegs[s];
            const newPt = newSegs[s];
            const interpX = oldPt.x + (newPt.x - oldPt.x) * t;
            const interpY = oldPt.y + (newPt.y - oldPt.y) * t;
            segmentsToDraw.push({ x: interpX, y: interpY });
          }
        } else {
          // No previous data (new snake or first update), use current positions
          segmentsToDraw = snake.segments;
        }
        // Draw snake's segments (tail first, head last)
        ctx.fillStyle = snake.color;
        for (let s = segmentsToDraw.length - 1; s >= 0; s--) {
          const seg = segmentsToDraw[s];
          const radius = 10;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, radius, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
  
      // Draw world boundary (boundary is a 2000x2000 square from (0,0) to (WORLD_WIDTH, WORLD_HEIGHT))
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  
      ctx.restore();
    }
    animate();
  })();
  