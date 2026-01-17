(() => {
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

  if (document.getElementById(ROOT_ID)) return;
  console.log("Content script loaded");

  const createShadowRoot = () => {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.position = "fixed";
    root.style.right = "18px";
    root.style.bottom = "18px";
    root.style.zIndex = "2147483647";
    document.documentElement.appendChild(root);
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

  const appendMsg = (messagesEl, text, who) => {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.innerHTML = formatText(text);
    messagesEl.appendChild(div);
    // Smooth scroll to bottom
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior: 'smooth'
    });
  };

  const wireEvents = ({ panel, bar, messagesEl, inputEl, sendBtn, closeBtn, maximizeBtn }) => {
    const openPanel = () => {
      panel.classList.add("open");
      bar.style.display = "none";
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
    };

    const toggleMaximize = () => {
      panel.classList.toggle("maximized");
      const isMaximized = panel.classList.contains("maximized");
      maximizeBtn.innerHTML = isMaximized ? MINIMIZE_SVG : MAXIMIZE_SVG;
      maximizeBtn.setAttribute("aria-label", isMaximized ? "Minimize" : "Maximize");
    };

    const send = () => {
      const text = (inputEl.value || "").trim();
      if (!text) return;

      appendMsg(messagesEl, text, "user");
      inputEl.value = "";

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
              appendMsg(messagesEl, text, "bot");
            });
          } else {
            appendMsg(messagesEl, replyText, "bot");
          }
        })
        .catch((err) => {
          console.error("Failed to reach backend:", err);
          appendMsg(messagesEl, "Backend error: could not send message.", "bot");
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
  };

  const mount = () => {
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
