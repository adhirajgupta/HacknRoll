(() => {
  const ROOT_ID = "crx-canvas-chat-root";
  const BACKEND_URL = "http://localhost:5000/message";
  const ARROW_SVG = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4l-7 9h5v7h4v-7h5l-7-9z" fill="white"/>
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
    return style;
  };

  const createPanel = () => {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="header">
        <div>Chatbot</div>
        <button class="close" aria-label="Close">A-</button>
      </div>
      <div class="messages" id="messages"></div>
      <div class="composer">
        <input id="input" type="text" placeholder="Type a message..." />
        <button class="send" id="sendBtn">Send</button>
      </div>
    `;

    return {
      panel,
      messagesEl: panel.querySelector("#messages"),
      inputEl: panel.querySelector("#input"),
      sendBtn: panel.querySelector("#sendBtn"),
      closeBtn: panel.querySelector(".close"),
    };
  };

  const createBar = () => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.title = "Open chat";
    bar.innerHTML = ARROW_SVG;
    return bar;
  };

  const appendMsg = (messagesEl, text, who) => {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const wireEvents = ({ panel, bar, messagesEl, inputEl, sendBtn, closeBtn }) => {
    const openPanel = () => {
      panel.classList.add("open");
      bar.style.display = "none";
      if (!panel.dataset.greeted) {
        appendMsg(messagesEl, "Hi! I'm a dummy chatbot. Ask me anything.", "bot");
        panel.dataset.greeted = "1";
      }
      setTimeout(() => inputEl.focus(), 0);
    };

    const closePanel = () => {
      panel.classList.remove("open");
      bar.style.display = "grid";
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
          appendMsg(messagesEl, data && data.reply ? data.reply[0]?.text : "Received your message.", "bot");
        })
        .catch((err) => {
          console.error("Failed to reach backend:", err);
          appendMsg(messagesEl, "Backend error: could not send message.", "bot");
        });
    };

    bar.addEventListener("click", openPanel);
    closeBtn.addEventListener("click", closePanel);
    sendBtn.addEventListener("click", send);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
      if (e.key === "Escape") closePanel();
    });
  };

  const mount = () => {
    if (!document.body) return;

    const shadow = createShadowRoot();
    shadow.appendChild(createStyle());

    const wrapper = document.createElement("div");
    const { panel, messagesEl, inputEl, sendBtn, closeBtn } = createPanel();
    const bar = createBar();

    wrapper.appendChild(panel);
    wrapper.appendChild(bar);
    shadow.appendChild(wrapper);

    wireEvents({ panel, bar, messagesEl, inputEl, sendBtn, closeBtn });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
