(() => {
  // Avoid injecting twice
  console.log("Content script loaded");
  if (document.getElementById("crx-canvas-chat-root")) return;

  // Some pages can have weird timing; ensure body exists
  const mount = () => {
    if (!document.body) return;

    // Root container (in the normal DOM)
    const root = document.createElement("div");
    root.id = "crx-canvas-chat-root";
    root.style.position = "fixed";
    root.style.right = "18px";
    root.style.bottom = "18px";
    root.style.zIndex = "2147483647"; // very high
    document.documentElement.appendChild(root);

    // Shadow DOM to isolate styles
    const shadow = root.attachShadow({ mode: "open" });

    // Styles
    const style = document.createElement("style");
    style.textContent = `
      .bar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #66b5ff;
        color: #fff;
        display: grid;
        place-items: center;
        cursor: pointer;
        box-shadow: 0 10px 28px rgba(0,0,0,0.25);
        user-select: none;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        font-size: 22px;
      }

      .panel {
        width: 320px;
        height: 380px;
        margin-bottom: 10px;
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 12px 36px rgba(0,0,0,0.25);
        overflow: hidden;
        display: none;
        border: 1px solid rgba(0,0,0,0.08);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }

      .panel.open { display: flex; flex-direction: column; }

      .header {
        padding: 10px 12px;
        background: #111;
        color: #fff;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .close {
        background: transparent;
        border: none;
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        padding: 2px 6px;
        line-height: 1;
      }

      .messages {
        flex: 1;
        padding: 10px;
        overflow: auto;
        background: #fafafa;
      }

      .msg {
        max-width: 85%;
        padding: 8px 10px;
        border-radius: 12px;
        margin: 6px 0;
        font-size: 13px;
        line-height: 1.25;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .user {
        background: #111;
        color: #fff;
        margin-left: auto;
        border-bottom-right-radius: 6px;
      }

      .bot {
        background: #e9e9e9;
        color: #111;
        margin-right: auto;
        border-bottom-left-radius: 6px;
      }

      .composer {
        display: flex;
        gap: 8px;
        padding: 10px;
        border-top: 1px solid rgba(0,0,0,0.08);
        background: #fff;
      }

      input {
        flex: 1;
        border: 1px solid rgba(0,0,0,0.2);
        border-radius: 10px;
        padding: 10px;
        font-size: 13px;
        outline: none;
      }

      button.send {
        border: none;
        border-radius: 10px;
        padding: 10px 12px;
        background: #111;
        color: #fff;
        cursor: pointer;
        font-size: 13px;
      }

      button.send:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
    shadow.appendChild(style);

    const arrowSvg = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4l-7 9h5v7h4v-7h5l-7-9z" fill="white"/>
      </svg>
    `;

    // UI
    const wrapper = document.createElement("div");

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="header">
        <div>Chatbot</div>
        <button class="close" aria-label="Close">×</button>
      </div>
      <div class="messages" id="messages"></div>
      <div class="composer">
        <input id="input" type="text" placeholder="Type a message..." />
        <button class="send" id="sendBtn">Send</button>
      </div>
    `;

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.title = "Open chat";
    bar.innerHTML = arrowSvg;

    wrapper.appendChild(panel);
    wrapper.appendChild(bar);
    shadow.appendChild(wrapper);

    const messagesEl = panel.querySelector("#messages");
    const inputEl = panel.querySelector("#input");
    const sendBtn = panel.querySelector("#sendBtn");
    const closeBtn = panel.querySelector(".close");

    const appendMsg = (text, who) => {
      const div = document.createElement("div");
      div.className = `msg ${who}`;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const openPanel = () => {
      panel.classList.add("open");
      bar.innerHTML = arrowSvg;
      bar.title = "Close chat";
      // greet once
      if (!panel.dataset.greeted) {
        appendMsg("Hi! I'm a dummy chatbot. Ask me anything.", "bot");
        panel.dataset.greeted = "1";
      }
      setTimeout(() => inputEl.focus(), 0);
    };

    const closePanel = () => {
      panel.classList.remove("open");
      bar.innerHTML = arrowSvg;
      bar.title = "Open chat";
    };

    const togglePanel = () => {
      if (panel.classList.contains("open")) closePanel();
      else openPanel();
    };

    const send = () => {
      const text = (inputEl.value || "").trim();
      if (!text) return;

      appendMsg(text, "user");
      inputEl.value = "";

      // Dummy response
      window.setTimeout(() => {
        appendMsg(`Dummy reply: I received "${text}"`, "bot");
      }, 350);
    };

    bar.addEventListener("click", togglePanel);
    closeBtn.addEventListener("click", closePanel);

    sendBtn.addEventListener("click", send);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
      if (e.key === "Escape") closePanel();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
