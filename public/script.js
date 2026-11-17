/**
 * Gemini AI Chat Interface Client Script
 * Web Service Praktikum Week 10
 */

// State Management
const STORAGE_KEY = "gemini_chats_v1";
let chats = [];
let currentChatId = null;
let currentAbortController = null;
let isGenerating = false;

// DOM Elements
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const newChatBtn = document.getElementById("new-chat-btn");
const recentList = document.getElementById("recent-list");
const clearAllBtn = document.getElementById("clear-all-btn");

const chatViewport = document.getElementById("chat-viewport");
const welcomeScreen = document.getElementById("welcome-screen");
const messagesContainer = document.getElementById("messages-container");

const inputBoxContainer = document.getElementById("input-box-container");
const promptInput = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const toastNotification = document.getElementById("toast-notification");

// ==========================================
// Initialization
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  loadChatsFromStorage();
  setupEventListeners();
  setupSuggestions();
  autoResizeTextarea();

  if (chats.length > 0) {
    selectChat(chats[0].id);
  } else {
    createNewChat();
  }
});

// ==========================================
// Storage & Session Handling
// ==========================================
function loadChatsFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    chats = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Gagal memuat riwayat chat dari storage:", e);
    chats = [];
  }
}

function saveChatsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (e) {
    console.error("Gagal menyimpan ke localStorage:", e);
  }
}

function getCurrentChat() {
  return chats.find((c) => c.id === currentChatId);
}

function createNewChat() {
  if (isGenerating && currentAbortController) {
    currentAbortController.abort();
  }

  const newChat = {
    id: "chat_" + Date.now(),
    title: "Obrolan baru",
    createdAt: Date.now(),
    messages: [],
  };

  chats.unshift(newChat);
  currentChatId = newChat.id;
  saveChatsToStorage();

  renderSidebarList();
  renderChatMessages();
  promptInput.focus();

  // On mobile, close sidebar when clicking new chat
  closeMobileSidebar();
}

function selectChat(chatId) {
  if (isGenerating && currentAbortController) {
    currentAbortController.abort();
  }

  currentChatId = chatId;
  renderSidebarList();
  renderChatMessages();
  closeMobileSidebar();
}

function deleteChat(chatId, e) {
  if (e) e.stopPropagation();

  chats = chats.filter((c) => c.id !== chatId);
  saveChatsToStorage();

  if (chats.length === 0) {
    createNewChat();
  } else if (currentChatId === chatId) {
    selectChat(chats[0].id);
  } else {
    renderSidebarList();
  }

  showToast("Obrolan dihapus");
}

function clearAllChats() {
  if (chats.length === 0) return;
  if (!confirm("Hapus semua riwayat obrolan?")) return;

  if (isGenerating && currentAbortController) {
    currentAbortController.abort();
  }

  chats = [];
  saveChatsToStorage();
  createNewChat();
  showToast("Semua riwayat obrolan berhasil dihapus");
}

// ==========================================
// Sidebar & Navigation
// ==========================================
function renderSidebarList() {
  recentList.innerHTML = "";

  if (chats.length === 0 || (chats.length === 1 && chats[0].messages.length === 0)) {
    recentList.innerHTML = `<div class="recent-empty">Belum ada obrolan</div>`;
    return;
  }

  const validChats = chats.filter((c) => c.messages && c.messages.length > 0);
  if (validChats.length === 0) {
    recentList.innerHTML = `<div class="recent-empty">Belum ada obrolan</div>`;
    return;
  }

  validChats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = `recent-item ${chat.id === currentChatId ? "active" : ""}`;
    item.onclick = () => selectChat(chat.id);

    const titleSpan = document.createElement("span");
    titleSpan.className = "recent-item-title";
    titleSpan.textContent = chat.title || "Obrolan";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-chat-btn";
    deleteBtn.title = "Hapus";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" class="icon"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
    `;
    deleteBtn.onclick = (e) => deleteChat(chat.id, e);

    item.appendChild(titleSpan);
    item.appendChild(deleteBtn);
    recentList.appendChild(item);
  });
}

function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
}

function openMobileSidebar() {
  sidebar.classList.add("mobile-open");
  sidebarOverlay.classList.add("active");
}

function closeMobileSidebar() {
  sidebar.classList.remove("mobile-open");
  sidebarOverlay.classList.remove("active");
}

// ==========================================
// Rendering Messages
// ==========================================
function renderChatMessages() {
  const currentChat = getCurrentChat();

  if (!currentChat || currentChat.messages.length === 0) {
    welcomeScreen.style.display = "flex";
    messagesContainer.style.display = "none";
    messagesContainer.innerHTML = "";
    return;
  }

  welcomeScreen.style.display = "none";
  messagesContainer.style.display = "flex";
  messagesContainer.innerHTML = "";

  currentChat.messages.forEach((msg, idx) => {
    if (msg.role === "user") {
      appendUserMessageUI(msg.content);
    } else {
      appendGeminiMessageUI(msg.content, false, idx);
    }
  });

  scrollViewportToBottom();
}

function appendUserMessageUI(text) {
  const row = document.createElement("div");
  row.className = "message-row user";

  const bubble = document.createElement("div");
  bubble.className = "user-bubble";
  bubble.textContent = text;

  row.appendChild(bubble);
  messagesContainer.appendChild(row);
  scrollViewportToBottom();
}

function appendGeminiMessageUI(content = "", isStreaming = false, msgIndex = null) {
  const row = document.createElement("div");
  row.className = "message-row gemini";

  const avatar = document.createElement("div");
  avatar.className = "gemini-avatar";
  avatar.innerHTML = `
    <svg viewBox="0 0 24 24" class="gemini-sparkle-icon">
      <defs>
        <linearGradient id="gemini-sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4285F4"/>
          <stop offset="35%" stop-color="#9B72CB"/>
          <stop offset="70%" stop-color="#D96570"/>
          <stop offset="100%" stop-color="#1FA862"/>
        </linearGradient>
      </defs>
      <path fill="url(#gemini-sparkle-grad)" d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z"/>
    </svg>
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "gemini-content-wrapper";

  const body = document.createElement("div");
  body.className = "gemini-body";

  if (isStreaming) {
    body.innerHTML = renderMarkdown(content) + '<span class="typing-cursor"></span>';
  } else {
    body.innerHTML = renderMarkdown(content);
  }

  wrapper.appendChild(body);

  if (!isStreaming) {
    const actions = createMessageActions(content, msgIndex);
    wrapper.appendChild(actions);
  }

  row.appendChild(avatar);
  row.appendChild(wrapper);
  messagesContainer.appendChild(row);
  scrollViewportToBottom();

  return { row, body, wrapper };
}

function createMessageActions(rawContent, msgIndex) {
  const actions = document.createElement("div");
  actions.className = "message-actions";

  // Copy response button
  const copyBtn = document.createElement("button");
  copyBtn.className = "action-btn";
  copyBtn.title = "Salin respons";
  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" class="icon"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(rawContent).then(() => {
      showToast("Teks berhasil disalin ke clipboard!");
    });
  };

  // Thumbs up button
  const likeBtn = document.createElement("button");
  likeBtn.className = "action-btn";
  likeBtn.title = "Bagus";
  likeBtn.innerHTML = `<svg viewBox="0 0 24 24" class="icon"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>`;
  likeBtn.onclick = () => {
    likeBtn.style.color = "#4285f4";
    showToast("Terima kasih atas tanggapan Anda!");
  };

  // Thumbs down button
  const dislikeBtn = document.createElement("button");
  dislikeBtn.className = "action-btn";
  dislikeBtn.title = "Kurang bagus";
  dislikeBtn.innerHTML = `<svg viewBox="0 0 24 24" class="icon"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>`;
  dislikeBtn.onclick = () => {
    dislikeBtn.style.color = "#d96570";
    showToast("Tanggapan dicatat untuk evaluasi.");
  };

  // Regenerate button
  const regenBtn = document.createElement("button");
  regenBtn.className = "action-btn";
  regenBtn.title = "Buat ulang respons";
  regenBtn.innerHTML = `<svg viewBox="0 0 24 24" class="icon"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
  regenBtn.onclick = () => {
    regenerateLastResponse();
  };

  actions.appendChild(copyBtn);
  actions.appendChild(likeBtn);
  actions.appendChild(dislikeBtn);
  actions.appendChild(regenBtn);

  return actions;
}

function scrollViewportToBottom() {
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

// ==========================================
// Chat Submission & Streaming API Calls
// ==========================================
async function handleSend() {
  if (isGenerating) {
    // If currently generating, clicking the button acts as STOP
    if (currentAbortController) {
      currentAbortController.abort();
    }
    return;
  }

  const text = promptInput.value.trim();
  if (!text) return;

  promptInput.value = "";
  autoResizeTextarea();
  sendBtn.disabled = true;

  let currentChat = getCurrentChat();
  if (!currentChat) {
    createNewChat();
    currentChat = getCurrentChat();
  }

  // Update chat title if it's the first message
  if (currentChat.messages.length === 0) {
    currentChat.title = text.length > 30 ? text.slice(0, 30) + "..." : text;
  }

  // Add User Message to state and UI
  currentChat.messages.push({ role: "user", content: text });
  saveChatsToStorage();

  welcomeScreen.style.display = "none";
  messagesContainer.style.display = "flex";
  appendUserMessageUI(text);
  renderSidebarList();

  // Prepare Gemini placeholder UI
  isGenerating = true;
  setGeneratingUIState(true);
  currentAbortController = new AbortController();

  const { body, wrapper } = appendGeminiMessageUI("", true);

  let accumulatedResponse = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text }),
      signal: currentAbortController.signal,
    });

    if (!response.ok) {
      let errDetail = "Terjadi kesalahan";
      try {
        const errorJson = await response.json();
        errDetail = errorJson.error || errorJson.details || errDetail;
      } catch (e) {
        errDetail = await response.text();
      }
      throw new Error(errDetail);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") {
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.content) {
            accumulatedResponse += parsed.content;
            body.innerHTML =
              renderMarkdown(accumulatedResponse) + '<span class="typing-cursor"></span>';
            scrollViewportToBottom();
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (jsonErr) {
          console.warn("Parse line warning:", jsonErr);
        }
      }
    }

    // Finished stream normally
    if (!accumulatedResponse.trim()) {
      throw new Error("Respons AI kosong atau batas token habis saat berpikir.");
    }

    // Finished stream normally
    body.innerHTML = renderMarkdown(accumulatedResponse);
    currentChat.messages.push({ role: "gemini", content: accumulatedResponse });
    saveChatsToStorage();

    const actions = createMessageActions(accumulatedResponse, currentChat.messages.length - 1);
    wrapper.appendChild(actions);
  } catch (err) {
    if (err.name === "AbortError") {
      // Stopped by user
      if (accumulatedResponse) {
        body.innerHTML = renderMarkdown(accumulatedResponse);
        currentChat.messages.push({ role: "gemini", content: accumulatedResponse });
        saveChatsToStorage();
        wrapper.appendChild(
          createMessageActions(accumulatedResponse, currentChat.messages.length - 1),
        );
      } else {
        body.innerHTML = "<em>Generasi respons dihentikan.</em>";
      }
    } else {
      console.error("Chat error:", err);
      body.innerHTML = `
        <div class="error-bubble">
          <svg viewBox="0 0 24 24" class="icon" style="fill: #ff6b6b; min-width: 20px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          <div>
            <strong>Gagal mendapatkan respons:</strong><br>
            <span>${escapeHtml(err.message || "Pastikan GEMINI_API_KEY valid dan server aktif.")}</span>
          </div>
        </div>
      `;
    }
  } finally {
    isGenerating = false;
    currentAbortController = null;
    setGeneratingUIState(false);
    updateSendBtnState();
    scrollViewportToBottom();
  }
}

function regenerateLastResponse() {
  if (isGenerating) return;

  const currentChat = getCurrentChat();
  if (!currentChat || currentChat.messages.length === 0) return;

  // Find last user message
  let lastUserMsg = null;
  for (let i = currentChat.messages.length - 1; i >= 0; i--) {
    if (currentChat.messages[i].role === "user") {
      lastUserMsg = currentChat.messages[i].content;
      // remove following assistant message if present
      currentChat.messages = currentChat.messages.slice(0, i + 1);
      break;
    }
  }

  if (lastUserMsg) {
    saveChatsToStorage();
    renderChatMessages();

    // Trigger re-send
    promptInput.value = lastUserMsg;
    handleSend();
  }
}

function setGeneratingUIState(generating) {
  if (generating) {
    inputBoxContainer.classList.add("generating");
    sendBtn.disabled = false;
    sendBtn.title = "Hentikan pembuatan respons";
  } else {
    inputBoxContainer.classList.remove("generating");
    sendBtn.title = "Kirim pesan";
  }
}

function updateSendBtnState() {
  if (isGenerating) {
    sendBtn.disabled = false;
    return;
  }
  const hasText = promptInput.value.trim().length > 0;
  sendBtn.disabled = !hasText;
}

// ==========================================
// Textarea Auto Resize
// ==========================================
function autoResizeTextarea() {
  promptInput.style.height = "auto";
  const newHeight = Math.min(promptInput.scrollHeight, 180);
  promptInput.style.height = `${newHeight}px`;
}

// ==========================================
// Suggestions & Click Handlers
// ==========================================
function setupSuggestions() {
  const cards = document.querySelectorAll(".suggestion-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const promptText = card.getAttribute("data-prompt");
      if (promptText) {
        promptInput.value = promptText;
        autoResizeTextarea();
        updateSendBtnState();
        handleSend();
      }
    });
  });
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
  // Sidebar toggles
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
  }
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", openMobileSidebar);
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeMobileSidebar);
  }
  if (newChatBtn) {
    newChatBtn.addEventListener("click", createNewChat);
  }
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", clearAllChats);
  }

  // Input events
  promptInput.addEventListener("input", () => {
    autoResizeTextarea();
    updateSendBtnState();
  });

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener("click", handleSend);

  // Speech Recognition (Optional Web Speech API)
  if (micBtn) {
    micBtn.addEventListener("click", toggleSpeechInput);
  }

  // Global Code Block Copy Delegation
  document.addEventListener("click", (e) => {
    const copyCodeBtn = e.target.closest(".copy-code-btn");
    if (copyCodeBtn) {
      const pre = copyCodeBtn.closest(".code-block-wrapper").querySelector("pre code");
      if (pre) {
        navigator.clipboard.writeText(pre.innerText).then(() => {
          const originalHTML = copyCodeBtn.innerHTML;
          copyCodeBtn.innerHTML = `
            <svg viewBox="0 0 24 24" class="icon" style="fill:#34a853;"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
            Tersalin!
          `;
          setTimeout(() => {
            copyCodeBtn.innerHTML = originalHTML;
          }, 2000);
        });
      }
    }
  });
}

// ==========================================
// Voice Input (Web Speech API)
// ==========================================
let recognition = null;
let isRecording = false;

function toggleSpeechInput() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showToast("Web Speech API tidak didukung di browser ini.");
    return;
  }

  if (isRecording && recognition) {
    recognition.stop();
    return;
  }

  try {
    recognition = new SpeechRec();
    recognition.lang = "id-ID";
    recognition.interimResults = false;

    recognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add("recording");
      showToast("Mendengarkan suara...");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      promptInput.value += (promptInput.value ? " " : "") + transcript;
      autoResizeTextarea();
      updateSendBtnState();
    };

    recognition.onerror = (event) => {
      console.warn("Speech error:", event.error);
      showToast("Gagal mengenali suara: " + event.error);
    };

    recognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove("recording");
    };

    recognition.start();
  } catch (err) {
    console.error("Speech recognition error:", err);
    showToast("Tidak dapat mengakses mikrofon.");
  }
}

// ==========================================
// Toast Notification
// ==========================================
let toastTimer = null;
function showToast(message) {
  if (toastTimer) clearTimeout(toastTimer);
  toastNotification.textContent = message;
  toastNotification.classList.add("show");

  toastTimer = setTimeout(() => {
    toastNotification.classList.remove("show");
  }, 3000);
}

// ==========================================
// Lightweight Markdown Renderer
// ==========================================
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(md) {
  if (!md) return "";

  // 1. Extract and preserve code blocks
  const codeBlocks = [];
  let text = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({
      lang: lang || "code",
      code: escapeHtml(code.replace(/\n$/, "")),
    });
    return placeholder;
  });

  // 2. Escape standard HTML in prose
  text = escapeHtml(text);

  // 3. Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Headers
  text = text.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  text = text.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  text = text.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // 5. Bold & Italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // 6. Blockquote
  text = text.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

  // 7. Unordered Lists
  text = text.replace(/^\s*[\-\*]\s+(.*$)/gim, "<ul><li>$1</li></ul>");
  text = text.replace(/<\/ul>\s*<ul>/g, "");

  // 8. Ordered Lists
  text = text.replace(/^\s*\d+\.\s+(.*$)/gim, "<ol><li>$1</li></ol>");
  text = text.replace(/<\/ol>\s*<ol>/g, "");

  // 9. Tables
  text = text.replace(/((?:\|.+?\|\r?\n)+)/g, (tableMatch) => {
    const lines = tableMatch.trim().split("\n");
    if (lines.length < 2) return tableMatch;

    let tableHtml = "<table>";
    let isHeader = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Skip separator line e.g. |---|---|
      if (/^\|[\s\-:|]+\|$/.test(line)) {
        isHeader = false;
        continue;
      }

      const cells = line.split("|").slice(1, -1);
      tableHtml += "<tr>";
      cells.forEach((cell) => {
        const tag = isHeader ? "th" : "td";
        tableHtml += `<${tag}>${cell.trim()}</${tag}>`;
      });
      tableHtml += "</tr>";
    }

    tableHtml += "</table>";
    return tableHtml;
  });

  // 10. Paragraphs and line breaks
  const parts = text.split("\n\n");
  text = parts
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul>") ||
        trimmed.startsWith("<ol>") ||
        trimmed.startsWith("<blockquote>") ||
        trimmed.startsWith("<table>") ||
        trimmed.startsWith("__CODE_BLOCK_")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  // 11. Restore Code Blocks with Copy Button
  codeBlocks.forEach((item, index) => {
    const placeholder = `__CODE_BLOCK_${index}__`;
    const blockHtml = `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span>${item.lang}</span>
          <button class="copy-code-btn" type="button">
            <svg viewBox="0 0 24 24" class="icon"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            Salin kode
          </button>
        </div>
        <pre><code class="language-${item.lang}">${item.code}</code></pre>
      </div>
    `;
    text = text.replace(placeholder, blockHtml);
  });

  return text;
}
