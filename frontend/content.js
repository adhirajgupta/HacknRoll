(() => {
  if (window.__CRX_CANVAS_CHAT_INITIALIZED__) return;
  window.__CRX_CANVAS_CHAT_INITIALIZED__ = true;

  const ROOT_ID = "crx-canvas-chat-root";
  const BACKEND_URL = "http://localhost:5000/message";
  const ARROW_SVG = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4l-7 9h5v7h4v-7h5l-7-9z" fill="currentColor"/>
    </svg>
  `;
  const CLOSE_SVG = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  const MAXIMIZE_SVG = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  const MINIMIZE_SVG = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
const STATUS_STEPS = [
    "Thinking…",
    "Obtaining information…",
    "Delving into course files…",
    "Extracting relevant data…",
    "Formulating response…",  
  ];
const STORAGE_KEYS = {
  open: "crx-chat-open",
  history: "crx-chat-history",
};
let messagesState = [];

  console.log("Content script loaded");

  const createShadowRoot = () => {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.style.position = "fixed";
      root.style.right = "18px";
      root.style.bottom = "18px";
      root.style.zIndex = "2147483647";
      document.documentElement.appendChild(root);
    }
    return root.attachShadow({ mode: "open" });
  };

  const createStyle = () => {
    const style = document.createElement("style");
    style.textContent = `
      * {
        box-sizing: border-box;
      }

      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
      }

      @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }

      .bar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
        color: #fff;
        display: grid;
        place-items: center;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(76, 175, 80, 0.35), 0 4px 12px rgba(76, 175, 80, 0.25);
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        animation: float 3s ease-in-out infinite;
      }

      .bar:hover {
        transform: scale(1.08) translateY(-2px);
        background: linear-gradient(135deg, #66BB6A 0%, #81C784 100%);
        box-shadow: 0 12px 32px rgba(76, 175, 80, 0.4), 0 6px 16px rgba(76, 175, 80, 0.3);
        animation: none;
      }

      .bar:active {
        transform: scale(0.95) translateY(0px);
        animation: bounce 0.3s ease;
      }

      .panel {
        width: 440px;
        height: 640px;
        margin-bottom: 12px;
        border-radius: 28px;
        background: linear-gradient(to bottom, #ffffff 0%, #f8fdf9 100%);
        backdrop-filter: blur(30px);
        box-shadow: 0 24px 64px rgba(76, 175, 80, 0.2), 0 12px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(76, 175, 80, 0.1);
        overflow: hidden;
        display: none;
        border: 2px solid rgba(76, 175, 80, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
        opacity: 0;
        transform: translateY(12px) scale(0.95) rotate(-1deg);
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }

      .panel.open {
        display: flex;
        flex-direction: column;
        opacity: 1;
        transform: translateY(0) scale(1) rotate(0deg);
        animation: panelBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }

      @keyframes panelBounce {
        0% { transform: translateY(12px) scale(0.95) rotate(-1deg); }
        50% { transform: translateY(-4px) scale(1.02) rotate(0.5deg); }
        100% { transform: translateY(0) scale(1) rotate(0deg); }
      }

      .panel.maximized {
        width: 90vw;
        height: 85vh;
        max-width: 1200px;
        max-height: 900px;
      }

      .header {
        padding: 18px 24px;
        background: linear-gradient(135deg, #E8F5E9 0%, #F1F8F4 100%);
        color: #2E7D32;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid rgba(76, 175, 80, 0.2);
        letter-spacing: -0.02em;
        position: relative;
        overflow: hidden;
      }

      .header::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
        animation: shimmer 3s infinite;
      }

      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }

      .header-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .close, .maximize {
        background: rgba(76, 175, 80, 0.1);
        border: none;
        color: #4CAF50;
        cursor: pointer;
        padding: 8px;
        line-height: 1;
        border-radius: 12px;
        display: grid;
        place-items: center;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        width: 32px;
        height: 32px;
        position: relative;
      }

      .close:hover, .maximize:hover {
        background: rgba(76, 175, 80, 0.2);
        color: #388E3C;
        transform: scale(1.1) rotate(5deg);
      }

      .close:active, .maximize:active {
        background: rgba(76, 175, 80, 0.3);
        transform: scale(0.9) rotate(-5deg);
      }

      .messages {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
        background: linear-gradient(to bottom, #ffffff 0%, #fafafa 100%);
        scroll-behavior: smooth;
        position: relative;
      }

      .messages::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(to bottom, rgba(232, 245, 233, 0.3), transparent);
        pointer-events: none;
      }

      .messages::-webkit-scrollbar {
        width: 10px;
      }

      .messages::-webkit-scrollbar-track {
        background: rgba(232, 245, 233, 0.2);
        border-radius: 10px;
      }

      .messages::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #4CAF50, #66BB6A);
        border-radius: 10px;
        border: 2px solid transparent;
        background-clip: padding-box;
      }

      .messages::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #66BB6A, #81C784);
        background-clip: padding-box;
      }

      .msg {
        max-width: 85%;
        padding: 14px 18px;
        border-radius: 24px;
        margin: 10px 0;
        font-size: 15px;
        line-height: 1.5;
        word-wrap: break-word;
        white-space: pre-wrap;
        animation: messagePop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        letter-spacing: -0.01em;
        position: relative;
      }

      @keyframes messagePop {
        0% {
          opacity: 0;
          transform: translateY(10px) scale(0.9);
        }
        50% {
          transform: translateY(-2px) scale(1.02);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .user {
        background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
        color: #fff;
        margin-left: auto;
        border-bottom-right-radius: 8px;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3), 0 2px 4px rgba(76, 175, 80, 0.2);
        transform-origin: right bottom;
      }

      .user:hover {
        transform: scale(1.02);
        transition: transform 0.2s ease;
      }

      .user strong {
        color: #fff;
        font-weight: 600;
      }

      .bot {
        background: linear-gradient(135deg, #E8F5E9 0%, #F1F8F4 100%);
        color: #2E7D32;
        margin-right: auto;
        border-bottom-left-radius: 8px;
        border: 2px solid rgba(76, 175, 80, 0.2);
        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.15);
        transform-origin: left bottom;
      }

      .bot:hover {
        transform: scale(1.02);
        transition: transform 0.2s ease;
        border-color: rgba(76, 175, 80, 0.3);
      }

       .bot strong {
        color: #1B5E20;
        font-weight: 600;
      }

      .msg.loading {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .spinner {
        width: 16px;
        height: 16px;
        border: 3px solid rgba(46, 125, 50, 0.25);
        border-top-color: #2E7D32;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
        flex-shrink: 0;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .composer {
        display: flex;
        gap: 12px;
        padding: 20px 24px;
        border-top: 2px solid rgba(76, 175, 80, 0.15);
        background: linear-gradient(to top, #ffffff 0%, #F8FDF9 100%);
        backdrop-filter: blur(20px);
      }

      input {
        flex: 1;
        border: 2px solid rgba(76, 175, 80, 0.3);
        border-radius: 20px;
        padding: 12px 18px;
        font-size: 15px;
        outline: none;
        background: #ffffff;
        color: #2E7D32;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        font-family: inherit;
        letter-spacing: -0.01em;
        -webkit-appearance: none;
        appearance: none;
      }

      input:focus {
        border-color: #4CAF50;
        background: #F8FDF9;
        box-shadow: 0 0 0 6px rgba(76, 175, 80, 0.15), 0 4px 12px rgba(76, 175, 80, 0.2);
        transform: scale(1.02);
      }

      input::placeholder {
        color: #81C784;
      }

      button.send {
        border: none;
        border-radius: 20px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
        color: #fff;
        cursor: pointer;
        font-size: 15px;
        font-weight: 600;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3), 0 2px 4px rgba(76, 175, 80, 0.2);
        font-family: inherit;
        letter-spacing: -0.01em;
        position: relative;
        overflow: hidden;
      }

      button.send::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        transition: width 0.6s, height 0.6s;
      }

      button.send:hover:not(:disabled) {
        background: linear-gradient(135deg, #66BB6A 0%, #81C784 100%);
        box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4), 0 4px 8px rgba(76, 175, 80, 0.3);
        transform: translateY(-2px) scale(1.05);
      }

      button.send:hover:not(:disabled)::before {
        width: 300px;
        height: 300px;
      }

      button.send:active:not(:disabled) {
        background: linear-gradient(135deg, #388E3C 0%, #4CAF50 100%);
        transform: scale(0.95);
        box-shadow: 0 2px 6px rgba(76, 175, 80, 0.3);
      }

      button.send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
        background: #BDBDBD;
      }
    `;
    return style;
  };

  const createPanel = () => {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="header">
        <div>Chatbot</div>
        <div class="header-buttons">
          <button class="maximize" aria-label="Maximize">${MAXIMIZE_SVG}</button>
          <button class="close" aria-label="Close">${CLOSE_SVG}</button>
        </div>
      </div>
      <div class="messages" id="messages"></div>
      <div class="composer">
        <input id="input" type="text" placeholder="Type a message..." autocomplete="off" />
        <button class="send" id="sendBtn">Send</button>
      </div>
    `;

    return {
      panel,
      messagesEl: panel.querySelector("#messages"),
      inputEl: panel.querySelector("#input"),
      sendBtn: panel.querySelector("#sendBtn"),
      closeBtn: panel.querySelector(".close"),
      maximizeBtn: panel.querySelector(".maximize"),
    };
  };

  const createBar = () => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.title = "Open chat";
    bar.innerHTML = ARROW_SVG;
    return bar;
  };

  const formatText = (text) => {
    // Escape HTML to prevent XSS
    const escapeHtml = (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    let escaped = escapeHtml(text);
    // Convert *text* to <strong>text</strong>
    // Match *text* but not **text** or ***text***
    escaped = escaped.replace(/\*([^*]+?)\*/g, '<strong>$1</strong>');
    return escaped;
  };

  const persistHistory = () => {
    try {
      chrome.storage?.local?.set({ [STORAGE_KEYS.history]: messagesState });
    } catch (e) {
      try {
        sessionStorage.setItem(STORAGE_KEYS.history, JSON.stringify(messagesState));
      } catch (err) {}
    }
  };

  const loadHistory = (cb) => {
    const fallback = () => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEYS.history);
        cb(raw ? JSON.parse(raw) : []);
      } catch (e) {
        cb([]);
      }
    };
    try {
      chrome.storage?.local?.get(STORAGE_KEYS.history, (res) => {
        if (res && res[STORAGE_KEYS.history]) cb(res[STORAGE_KEYS.history]);
        else fallback();
      });
    } catch (e) {
      fallback();
    }
  };

  const appendMsg = (messagesEl, text, who, { persist = true } = {}) => {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.innerHTML = formatText(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior: 'smooth'
    });
    if (persist) {
      messagesState.push({ role: who, text });
      persistHistory();
    }
  };

  const wireEvents = ({ panel, bar, messagesEl, inputEl, sendBtn, closeBtn, maximizeBtn }) => {
    let loadingInterval = null;
    let loadingEl = null;
    let openState = false;

    const clearLoading = () => {
      if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
      }
      if (loadingEl && loadingEl.parentNode) {
        loadingEl.parentNode.removeChild(loadingEl);
      }
      loadingEl = null;
      sendBtn.disabled = false;
    };

    const showLoadingMessage = () => {
      clearLoading();
      const div = document.createElement("div");
      div.className = "msg bot loading";

      const spinner = document.createElement("div");
      spinner.className = "spinner";

      const text = document.createElement("span");
      text.textContent = STATUS_STEPS[0];

      div.appendChild(spinner);
      div.appendChild(text);
      messagesEl.appendChild(div);
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });

      let idx = 0;
      loadingInterval = setInterval(() => {
        if(idx === STATUS_STEPS.length - 1) {
          idx = STATUS_STEPS.length - 1;
        } else {
          idx = (idx + 1) % STATUS_STEPS.length;
          text.textContent = STATUS_STEPS[idx];
        }
      }, 3200);

      loadingEl = div;
      sendBtn.disabled = true;
    };

    const replaceLoadingWith = (replyText) => {
      clearLoading();
      appendMsg(messagesEl, replyText, "bot");
    };

    const replaceLoadingWithError = () => {
      clearLoading();
      appendMsg(messagesEl, "Something went wrong. Please try again.", "bot");
    };

    const openPanel = () => {
      panel.classList.add("open");
      bar.style.display = "none";
      openState = true;
      try {
        chrome.storage?.local?.set({ "crx-chat-open": true });
      } catch (e) {
        try {
          sessionStorage.setItem("crx-chat-open", "1");
        } catch (err) {}
      }
      if (!panel.dataset.greeted) {
        appendMsg(messagesEl, "Hi! I'm AskMyCanvas. Ask me anything.", "bot");
        panel.dataset.greeted = "1";
      }
      setTimeout(() => inputEl.focus(), 0);
    };

    const closePanel = () => {
      panel.classList.remove("open");
      panel.classList.remove("maximized");
      bar.style.display = "grid";
      maximizeBtn.innerHTML = MAXIMIZE_SVG;
      clearLoading();
      openState = false;
      try {
        chrome.storage?.local?.set({ "crx-chat-open": false });
      } catch (e) {
        try {
          sessionStorage.setItem("crx-chat-open", "0");
        } catch (err) {}
      }
    };

    const toggleMaximize = () => {
      panel.classList.toggle("maximized");
      const isMaximized = panel.classList.contains("maximized");
      maximizeBtn.innerHTML = isMaximized ? MINIMIZE_SVG : MAXIMIZE_SVG;
      maximizeBtn.setAttribute("aria-label", isMaximized ? "Minimize" : "Maximize");
    };

    const restoreOpenState = () => {
      const applyState = (val) => {
        if (val === true || val === "1" || val === "true") {
          openPanel();
        }
      };
      try {
        chrome.storage?.local?.get("crx-chat-open", (res) => {
          if (res && typeof res["crx-chat-open"] !== "undefined") {
            applyState(res["crx-chat-open"]);
          } else {
            try {
              applyState(sessionStorage.getItem("crx-chat-open"));
            } catch (e) {}
          }
        });
      } catch (err) {
        try {
          applyState(sessionStorage.getItem("crx-chat-open"));
        } catch (e) {}
      }
    };

    loadHistory((history) => {
      if (Array.isArray(history)) {
        messagesState = history;
        if (history.length) {
          history.forEach((m) => appendMsg(messagesEl, m.text, m.role, { persist: false }));
          panel.dataset.greeted = "1";
        }
      }
    });

    const send = () => {
      const text = (inputEl.value || "").trim();
      if (!text) return;
      if (loadingEl) return; // prevent overlapping requests

      appendMsg(messagesEl, text, "user");
      inputEl.value = "";
      showLoadingMessage();

      console.log("Sending message to backend:", text);

      fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then((res) => res.json())
        .then((data) => {
            console.log("Received response from backend:", data);
          const replyText = data && data.reply ? (data.reply?.text || data.reply) : "Received your message.";
          if (Array.isArray(replyText)) {
            replyText.forEach(item => {
              const text = typeof item === 'string' ? item : (item?.text || item?.content || JSON.stringify(item));
              replaceLoadingWith(text);
            });
          } else {
            replaceLoadingWith(replyText);
          }
        })
        .catch((err) => {
          console.error("Failed to reach backend:", err);
          replaceLoadingWithError();
        });
    };

    bar.addEventListener("click", openPanel);
    closeBtn.addEventListener("click", closePanel);
    maximizeBtn.addEventListener("click", toggleMaximize);
    sendBtn.addEventListener("click", send);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
      if (e.key === "Escape") closePanel();
    });

    restoreOpenState();
  };

  const injectIfMissing = () => {
    if (document.getElementById(ROOT_ID)) return;
    if (!document.body) return;

    const shadow = createShadowRoot();
    shadow.appendChild(createStyle());

    const wrapper = document.createElement("div");
    const { panel, messagesEl, inputEl, sendBtn, closeBtn, maximizeBtn } = createPanel();
    const bar = createBar();

    wrapper.appendChild(panel);
    wrapper.appendChild(bar);
    shadow.appendChild(wrapper);

    wireEvents({ panel, bar, messagesEl, inputEl, sendBtn, closeBtn, maximizeBtn });
  };

  const observeRootRemoval = () => {
    const observer = new MutationObserver(() => {
      if (!document.getElementById(ROOT_ID)) {
        injectIfMissing();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  const hookHistory = () => {
    const fire = () => {
      const evt = new Event("crx-url-change");
      window.dispatchEvent(evt);
    };
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      fire();
    };
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      fire();
    };
    window.addEventListener("popstate", fire);
    window.addEventListener("crx-url-change", injectIfMissing);
  };

  const init = () => {
    injectIfMissing();
    observeRootRemoval();
    hookHistory();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
