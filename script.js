// --- Global Variables ---
let wordsData = [];
let uniquePrefixes = new Set();
let uniqueRoots = new Set();
let uniqueSuffixes = new Set();
let currentGameIndex = -1;
let shuffledIndices = [];
let score = 0;
let totalWords = 0;
const EMPTY_COMPONENT_PLACEHOLDER = "[無]"; // Placeholder for empty parts
// Check for Speech Synthesis support
const synth = window.speechSynthesis;
const supportsSpeech = !!synth;

// --- DOM Elements ---
const fileInput = document.getElementById('csvFileInput');
const fileNameDisplay = document.getElementById('fileName');
const fileMessage = document.getElementById('fileMessage');
const loadError = document.getElementById('loadError');
const loadingIndicator = document.getElementById('loadingIndicator');
const gameArea = document.querySelector('.game-area');
const meaningDisplay = document.getElementById('meaning');
const prefixSelect = document.getElementById('prefixSelect');
const rootSelect = document.getElementById('rootSelect');
const suffixSelect = document.getElementById('suffixSelect');
const buildButton = document.getElementById('buildButton');
const nextButton = document.getElementById('nextButton');
const feedbackArea = document.getElementById('feedback');
const progressDisplay = document.getElementById('progress');
const scoreDisplay = document.getElementById('score');
const selectionDisplay = document.getElementById('selectionDisplay').querySelector('span'); // Target the span inside
const builtWordDisplay = document.getElementById('builtWordDisplay').querySelector('span'); // Target the span inside
const gameOverMessage = document.getElementById('gameOverMessage');
const finalScoreDisplay = document.getElementById('finalScore');
const totalWordsEndDisplay = document.getElementById('totalWordsEnd');
const pronounceButton = document.getElementById('pronounceButton'); // Get the new button


// --- Event Listeners ---
fileInput.addEventListener('change', handleFileSelect);
buildButton.addEventListener('click', handleBuildWord);
nextButton.addEventListener('click', handleNextWord);
prefixSelect.addEventListener('change', updateSelectionDisplay);
rootSelect.addEventListener('change', updateSelectionDisplay);
suffixSelect.addEventListener('change', updateSelectionDisplay);
// Add listener for the pronounce button
pronounceButton.addEventListener('click', handlePronounceWord);


// --- Functions ---

// Add a new function to handle pronunciation
function handlePronounceWord() {
    if (!supportsSpeech) {
        alert("抱歉，您的瀏覽器不支援語音合成功能。");
        return;
    }
    if (currentGameIndex < 0 || currentGameIndex >= totalWords) {
        return; // No word selected yet or game over
    }
    if (synth.speaking) {
        // Optional: Prevent spamming if already speaking
        // console.log('SpeechSynthesis.speaking');
        return;
    }

    const currentWordData = wordsData[shuffledIndices[currentGameIndex]];
    const wordToSpeak = currentWordData.Word;

    if (wordToSpeak) {
        const utterThis = new SpeechSynthesisUtterance(wordToSpeak);
        utterThis.lang = 'en-US'; // Set language to English (US). Adjust if needed (e.g., 'en-GB')
        utterThis.pitch = 1;
        utterThis.rate = 1;
        utterThis.onerror = function (event) {
            console.error('SpeechSynthesisUtterance.onerror', event);
            feedbackArea.textContent = '抱歉，發音時發生錯誤。';
            feedbackArea.className = 'feedback-box incorrect';
        };
        // console.log("Attempting to speak:", wordToSpeak);
        synth.speak(utterThis);
    } else {
        console.error("Cannot pronounce: Word is empty or undefined.");
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    resetGameVisuals();

    if (!file) {
        fileMessage.textContent = '未選擇任何檔案。';
        fileNameDisplay.textContent = '未選擇檔案';
        return;
    }

    fileNameDisplay.textContent = file.name;

    if (!file.name.toLowerCase().endsWith('.csv')) {
         loadError.textContent = '錯誤：請選擇一個 .csv 檔案。';
         resetGame();
         return;
    }

    loadingIndicator.style.display = 'block';
    fileMessage.textContent = '正在讀取檔案...';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            setTimeout(() => {
                parseCSV(e.target.result);
                if(wordsData.length > 0) {
                    fileMessage.textContent = `成功載入 ${file.name} (${totalWords} 個單字)。`;
                    gameArea.style.display = 'block';
                    nextButton.disabled = false;
                    nextButton.textContent = `▶️ 開始遊戲 (${totalWords}題)`;
                    gameOverMessage.style.display = 'none';
                    buildButton.disabled = true;
                    loadingIndicator.style.display = 'none';
                    // Check speech support and update button state/message
                    if (!supportsSpeech) {
                        pronounceButton.style.display = 'none'; // Hide button if not supported
                        console.warn("瀏覽器不支援 Speech Synthesis API");
                        // Optionally add a message somewhere
                    }
                } else {
                    loadError.textContent = '錯誤：CSV 檔案為空或格式不符。';
                    resetGame();
                    loadingIndicator.style.display = 'none';
                }
            }, 10);

        } catch (error) {
            console.error("解析 CSV 時發生錯誤:", error);
            loadError.textContent = `錯誤：無法解析檔案。請檢查 CSV 格式與 UTF-8 編碼。\n(${error.message})`;
            resetGame();
            loadingIndicator.style.display = 'none';
        }
    };
    reader.onerror = function() {
        console.error("讀取檔案時發生錯誤");
        loadError.textContent = '錯誤：讀取檔案時發生問題。';
        resetGame();
        loadingIndicator.style.display = 'none';
    };
    reader.readAsText(file, 'UTF-8');
}

function parseCSV(csvText) {
    wordsData = [];
    uniquePrefixes = new Set([EMPTY_COMPONENT_PLACEHOLDER]);
    uniqueRoots = new Set();
    uniqueSuffixes = new Set([EMPTY_COMPONENT_PLACEHOLDER]);
    score = 0;
    currentGameIndex = -1;
    totalWords = 0;

    const lines = csvText.trim().split(/\r?\n/);

    if (lines.length < 2) {
        throw new Error("CSV 檔案至少需要包含標頭和一行資料。");
    }

    const headerLine = lines[0].trim();
    const headers = headerLine.split(',').map(h => h.trim());
    const requiredHeaders = ['Word', 'Meaning', 'Prefix', 'Root', 'Suffix', 'Story'];
    const headerMap = {};
    let missingHeaders = [];

    requiredHeaders.forEach(reqHeader => {
        const index = headers.findIndex(h => h.toLowerCase() === reqHeader.toLowerCase());
        if (index === -1) {
            missingHeaders.push(reqHeader);
        } else {
            headerMap[reqHeader] = index;
        }
    });

    if (missingHeaders.length > 0) {
        throw new Error(`CSV 檔案缺少必要的標頭欄位: ${missingHeaders.join(', ')}`);
    }

    const csvLineRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(csvLineRegex).map(val => {
            val = val.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                return val.slice(1, -1).replace(/""/g, '"');
            }
            return val;
        });

        if (values.length !== headers.length) {
            console.warn(`警告：第 ${i + 1} 行欄位數 (${values.length}) 與標頭數 (${headers.length}) 不符，已跳過。內容: "${line}"`);
            continue;
        }

        const wordObj = {
            Word: values[headerMap['Word']],
            Meaning: values[headerMap['Meaning']],
            Prefix: values[headerMap['Prefix']],
            Root: values[headerMap['Root']],
            Suffix: values[headerMap['Suffix']],
            Story: values[headerMap['Story']]
        };

        if (!wordObj.Word || !wordObj.Meaning || !wordObj.Root) {
             console.warn(`警告：第 ${i + 1} 行缺少 Word, Meaning 或 Root 欄位，已跳過。內容: "${line}"`);
             continue;
        }

        wordsData.push(wordObj);
        uniquePrefixes.add(wordObj.Prefix || EMPTY_COMPONENT_PLACEHOLDER);
        uniqueRoots.add(wordObj.Root);
        uniqueSuffixes.add(wordObj.Suffix || EMPTY_COMPONENT_PLACEHOLDER);
    }

    totalWords = wordsData.length;
    if (totalWords === 0) {
         throw new Error("CSV 檔案解析後沒有有效的單字資料。");
    }

    populateDropdowns();
    updateStatusDisplay();
}

function populateDropdowns() {
    const sortedPrefixes = Array.from(uniquePrefixes).sort((a, b) => sortComponents(a, b));
    const sortedRoots = Array.from(uniqueRoots).sort();
    const sortedSuffixes = Array.from(uniqueSuffixes).sort((a, b) => sortComponents(a, b));

    fillSelectWithOptions(prefixSelect, sortedPrefixes);
    fillSelectWithOptions(rootSelect, sortedRoots);
    fillSelectWithOptions(suffixSelect, sortedSuffixes);
}

function sortComponents(a, b) {
    if (a === EMPTY_COMPONENT_PLACEHOLDER) return -1;
    if (b === EMPTY_COMPONENT_PLACEHOLDER) return 1;
    return a.localeCompare(b);
}

function fillSelectWithOptions(selectElement, options) {
    selectElement.innerHTML = '';
    options.forEach(optionText => {
        const option = document.createElement('option');
        option.value = optionText;
        option.textContent = optionText;
        selectElement.appendChild(option);
    });
    if (options.length > 0) {
        const placeholderIndex = options.findIndex(opt => opt === EMPTY_COMPONENT_PLACEHOLDER);
        selectElement.selectedIndex = (placeholderIndex !== -1) ? placeholderIndex : 0;
    }
}

 function updateStatusDisplay() {
     progressDisplay.textContent = `第 ${currentGameIndex + 1} / ${totalWords} 題`;
     scoreDisplay.textContent = `得分: ${score}`;
 }

function handleNextWord() {
    if (currentGameIndex === -1) {
        shuffledIndices = Array.from(wordsData.keys()).sort(() => Math.random() - 0.5);
        nextButton.textContent = '下一題 ▶️';
        fileInput.disabled = true;
        document.querySelector('.file-label').style.cursor = 'not-allowed';
        document.querySelector('.file-label').style.opacity = '0.6';
    }

    currentGameIndex++;

    if (currentGameIndex >= totalWords) {
        showGameOver();
        return;
    }

    // Cancel any ongoing speech before loading the next word
    if (supportsSpeech && synth.speaking) {
        synth.cancel();
    }

    const currentWordData = wordsData[shuffledIndices[currentGameIndex]];
    meaningDisplay.textContent = currentWordData.Meaning;

    feedbackArea.textContent = '';
    feedbackArea.className = 'feedback-box';
    builtWordDisplay.textContent = '...';
    builtWordDisplay.style.color = 'var(--primary-color)';

    selectDefaultOption(prefixSelect);
    selectDefaultOption(rootSelect);
    selectDefaultOption(suffixSelect);

    updateSelectionDisplay();
    updateStatusDisplay();

    buildButton.disabled = false;
    nextButton.disabled = true;
    pronounceButton.disabled = !supportsSpeech; // Enable pronounce button if supported

    gameArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectDefaultOption(selectElement) {
     const options = Array.from(selectElement.options);
     const placeholderIndex = options.findIndex(opt => opt.value === EMPTY_COMPONENT_PLACEHOLDER);
     selectElement.selectedIndex = (placeholderIndex !== -1) ? placeholderIndex : 0;
}

function updateSelectionDisplay() {
     const selectedPrefix = prefixSelect.value || '[?]';
     const selectedRoot = rootSelect.value || '[?]';
     const selectedSuffix = suffixSelect.value || '[?]';
     selectionDisplay.textContent = `[${selectedPrefix}] + [${selectedRoot}] + [${selectedSuffix}]`;
     selectionDisplay.style.color = 'var(--primary-color)';
}


function handleBuildWord() {
    if (currentGameIndex < 0 || currentGameIndex >= totalWords) return;

    const selectedPrefixValue = prefixSelect.value;
    const selectedRootValue = rootSelect.value;
    const selectedSuffixValue = suffixSelect.value;

    const actualPrefix = selectedPrefixValue === EMPTY_COMPONENT_PLACEHOLDER ? "" : selectedPrefixValue;
    const actualRoot = selectedRootValue;
    const actualSuffix = selectedSuffixValue === EMPTY_COMPONENT_PLACEHOLDER ? "" : selectedSuffixValue;

    const builtWord = actualPrefix + actualRoot + actualSuffix;
    builtWordDisplay.textContent = `${builtWord}`;

    const correctWordInfo = wordsData[shuffledIndices[currentGameIndex]];
    const correctWord = correctWordInfo.Word;

    feedbackArea.textContent = '';
    feedbackArea.className = 'feedback-box';

    if (builtWord === correctWord) {
        score++;
        feedbackArea.innerHTML = `<span class="icon">✅</span> <strong>成功！</strong> ${correctWord} 的確是「${correctWordInfo.Meaning}」。<br><strong>拆解：</strong>${correctWordInfo.Story}`;
        feedbackArea.classList.add('correct');
        builtWordDisplay.style.color = 'var(--success-color)';
        scoreDisplay.style.transition = 'transform 0.3s ease';
        scoreDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => { scoreDisplay.style.transform = 'scale(1)'; }, 300);

		buildButton.disabled = true;
		nextButton.disabled = false;

    } else {
		const correctPrefixDisplay = correctWordInfo.Prefix || EMPTY_COMPONENT_PLACEHOLDER;
		const correctRootDisplay = correctWordInfo.Root;
		const correctSuffixDisplay = correctWordInfo.Suffix || EMPTY_COMPONENT_PLACEHOLDER;
		feedbackArea.innerHTML = `<span class="icon">❌</span> <strong>錯誤！</strong> 製造的單字不正確。<br><strong>提示：</strong>${correctWordInfo.Story}<br><strong>正解提示：</strong>${correctPrefixDisplay} + ${correctRootDisplay} + ${correctSuffixDisplay} (但正確單字本身先不顯示)`;
		feedbackArea.classList.add('incorrect');
		builtWordDisplay.style.color = 'var(--danger-color)';

        // Allow retrying, so don't disable build or enable next here
    }

	updateStatusDisplay();
}

function showGameOver() {
    gameArea.style.display = 'none';
    finalScoreDisplay.textContent = score;
    totalWordsEndDisplay.textContent = totalWords;
    gameOverMessage.style.display = 'block';
    pronounceButton.disabled = true; // Disable pronounce button at game over
    // Cancel any speech if game ends abruptly
    if (supportsSpeech && synth.speaking) {
        synth.cancel();
    }
    gameOverMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

 function resetGameVisuals() {
     loadError.textContent = '';
     fileMessage.textContent = '請選擇包含單字資料的 CSV 檔案 (UTF-8 編碼)。';
     gameArea.style.display = 'none';
     gameOverMessage.style.display = 'none';
     fileInput.disabled = false;
     const fileLabel = document.querySelector('.file-label');
     if(fileLabel) {
        fileLabel.style.cursor = 'pointer';
        fileLabel.style.opacity = '1';
     }
     fileNameDisplay.textContent = '未選擇檔案';
     nextButton.textContent = '▶️ 開始遊戲';
     nextButton.disabled = true;
     buildButton.disabled = true;
     pronounceButton.disabled = true; // Disable pronounce button on reset
     pronounceButton.style.display = 'inline-block'; // Ensure it's visible initially (unless hidden later for non-support)
     loadingIndicator.style.display = 'none';
     // Cancel any ongoing speech on reset
    if (supportsSpeech && synth.speaking) {
        synth.cancel();
    }
 }

 function resetGame() {
     wordsData = [];
     uniquePrefixes = new Set();
     uniqueRoots = new Set();
     uniqueSuffixes = new Set();
     currentGameIndex = -1;
     shuffledIndices = [];
     score = 0;
     totalWords = 0;

     fileInput.value = '';

     resetGameVisuals();

     prefixSelect.innerHTML = '';
     rootSelect.innerHTML = '';
     suffixSelect.innerHTML = '';

     updateStatusDisplay();
     updateSelectionDisplay();
      builtWordDisplay.textContent = '...';
      builtWordDisplay.style.color = 'var(--primary-color)';
      feedbackArea.textContent = '';
      feedbackArea.className = 'feedback-box';
 }

 // Initial setup call
 resetGameVisuals();
 updateSelectionDisplay();