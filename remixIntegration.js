// mafiboFarcadeIntegration.js
// Script to integrate Farcade SDK into MAFIBO index.html

const fs = require('fs');
const path = require('path');

const config = {
    indexTemplate: 'index.html',
    outputFile: 'index.farcade.html',
};

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return null;
    }
}

function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content);
        console.log(`Successfully created file: ${filePath}`);
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error.message);
    }
}

function injectFarcadeSDK(html) {
    console.log('Injecting Farcade SDK script tag...');
    const farcadeScriptTag = '    <script src="https://cdn.jsdelivr.net/npm/@farcade/game-sdk@latest/dist/index.min.js"></script>';
    // Inject the Farcade SDK script right before the closing </head> tag
    return html.replace(/<\/head>/, `${farcadeScriptTag}\n</head>`);
}

function injectFarcadeGameLogic(html) {
    console.log('Injecting Farcade SDK game logic...');

    let modifiedHtml = html;

    // 1. Inject ready() call when play button is created and interactive
    const playButtonPattern = /(document\.getElementById\('playButton'\)\.addEventListener\('click', startGame\);)/;
    modifiedHtml = modifiedHtml.replace(playButtonPattern, (match) => {
        return `${match}

        // Farcade SDK: Signal that the game is fully loaded and ready to play
        if (window.FarcadeSDK) {
            window.FarcadeSDK.singlePlayer.actions.ready();
            console.log('Farcade SDK: Game ready signal sent.');
        }`;
    });

    // 2. Inject gameOver() call and prevent auto-restart when Farcade is present
    const gameOverPattern = /(if \(player\.level <= 0\) \{[\s\S]*?gameRunning = false;[\s\S]*?\/\/ Keep music playing even on game over[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?location\.reload\(\);[\s\S]*?\}, 100\);[\s\S]*?\})/;
    modifiedHtml = modifiedHtml.replace(gameOverPattern, (match) => {
        return match.replace(/setTimeout\(\(\) => \{[\s\S]*?location\.reload\(\);[\s\S]*?\}, 100\);/, `setTimeout(() => {
                            // Farcade SDK: Call gameOver with score, don't auto-restart if Farcade is present
                            if (window.FarcadeSDK) {
                                window.FarcadeSDK.singlePlayer.actions.gameOver({ score: player.score });
                                console.log('Farcade SDK: Game over signal sent with score:', player.score);
                                // Don't reload - wait for Farcade play_again signal
                            } else {
                                // Normal behavior: auto-restart
                                location.reload();
                            }
                        }, 100);`);
    });

    // 3. Inject gameOver() call and prevent auto-restart in victory logic
    const victoryPattern = /(} else \{[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?document\.body\.removeChild\(levelDisplay\);[\s\S]*?\/\/ Victory - just reload without popup[\s\S]*?location\.reload\(\);[\s\S]*?\}, 1000\);[\s\S]*?\})/;
    modifiedHtml = modifiedHtml.replace(victoryPattern, (match) => {
        return match.replace(/\/\/ Victory - just reload without popup[\s\S]*?location\.reload\(\);/, `// Farcade SDK: Call gameOver with final score, don't auto-restart if Farcade is present
                            if (window.FarcadeSDK) {
                                window.FarcadeSDK.singlePlayer.actions.gameOver({ score: targetScore });
                                console.log('Farcade SDK: Victory signal sent with final score:', targetScore);
                                // Don't reload - wait for Farcade play_again signal
                            } else {
                                // Normal behavior: auto-restart
                                location.reload();
                            }`);
    });

    // 4. Inject event handlers after the canvas event listeners are set up
    const canvasListenersPattern = /(document\.getElementById\('playButton'\)\.addEventListener\('click', startGame\);)/;
    modifiedHtml = modifiedHtml.replace(canvasListenersPattern, (match) => {
        return `${match}

        // Farcade SDK: Register event handlers for 'play_again' and 'toggle_mute'
        if (window.FarcadeSDK) {
            // Handle play again requests from Farcade
            window.FarcadeSDK.on('play_again', () => {
                console.log('Farcade SDK: Play again requested.');
                // Simply reload the page to restart the game
                location.reload();
            });

            // Handle mute/unmute requests from Farcade
            window.FarcadeSDK.on('toggle_mute', (data) => {
                console.log('Farcade SDK: Mute toggle requested, isMuted:', data.isMuted);
                
                if (data.isMuted) {
                    // Mute the music
                    if (currentTrack) {
                        currentTrack.volume = 0;
                    }
                    if (nextTrack) {
                        nextTrack.volume = 0;
                    }
                } else {
                    // Unmute the music
                    if (currentTrack) {
                        currentTrack.volume = 0.7;
                    }
                    if (nextTrack) {
                        nextTrack.volume = 0.7;
                    }
                }
                
                console.log('Farcade SDK: Music mute state set to:', data.isMuted);
            });

            console.log('Farcade SDK: Event handlers registered.');
        }`;
    });

    return modifiedHtml;
}

async function integrateFarcade() {
    console.log('Starting MAFIBO Farcade integration process...');

    let htmlContent = readFile(config.indexTemplate);
    if (!htmlContent) {
        console.error('Could not read HTML template. Aborting.');
        return;
    }

    // Step 1: Inject Farcade SDK script tag
    htmlContent = injectFarcadeSDK(htmlContent);

    // Step 2: Inject Farcade SDK game logic (ready, gameOver, play_again, toggle_mute)
    htmlContent = injectFarcadeGameLogic(htmlContent);

    writeFile(config.outputFile, htmlContent);

    console.log('MAFIBO Farcade integration complete! Output file:', config.outputFile);
    console.log('The integrated version will:');
    console.log('- Signal ready when the play button is set up');
    console.log('- Submit the score when the game ends (victory or defeat)');
    console.log('- Handle play again requests by reloading the page');
    console.log('- Handle mute/unmute requests via the custom music system');
}

// Execute the integration function
integrateFarcade();