document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const cells = document.querySelectorAll('.cell');
    const logContainer = document.getElementById('log-container');

    // 1. Handle Move Click
    cells.forEach(cell => {
        cell.addEventListener('click', async () => {
            const index = cell.dataset.index;
            
            // Backend API Call (Person 2's part)
            const response = await fetch('/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: index })
            });
            
            const data = await response.json();
            if (data.success) {
                updateBoard(data.board);
            }
        });
    });

    // 2. Update Board UI
    function updateBoard(boardArray) {
        cells.forEach((cell, i) => {
            cell.innerText = boardArray[i] === 0 ? '' : (boardArray[i] === 1 ? 'X' : 'O');
        });
    }

    // 3. Check Similarity (DAA)
    document.getElementById('similarity-btn').addEventListener('click', async () => {
        const response = await fetch('/check-similarity');
        const data = await response.json();
        
        document.getElementById('lcs-output').innerText = `Similarity: ${data.similarity}%`;
        document.getElementById('edit-dist-output').innerText = `Edit Distance: ${data.edit_distance}`;
        
        if (data.is_draw) {
            document.getElementById('draw-alert').classList.remove('hidden');
        } else {
            document.getElementById('draw-alert').classList.add('hidden');
        }
    });

    // 4. Run Semaphore Demo (OS)
    document.getElementById('semaphore-btn').addEventListener('click', async () => {
        logContainer.innerHTML = '<p>Running synchronization test...</p>';
        
        const response = await fetch('/run-semaphore');
        const data = await response.json();
        
        logContainer.innerHTML = ''; // Clear logs
        data.logs.forEach(log => {
            const p = document.createElement('p');
            p.innerText = `> ${log}`;
            logContainer.appendChild(p);
        });
    });

    // 5. Reset Game
    document.getElementById('reset-btn').addEventListener('click', async () => {
        await fetch('/reset');
        updateBoard([0,0,0,0,0,0,0,0,0]);
        document.getElementById('draw-alert').classList.add('hidden');
    });
});