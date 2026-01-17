console.log("content.js loaded");

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SHOW_POPUP") {
    // Prevent duplicate popups
    if (document.getElementById("my-extension-popup")) return;

    const popup = document.createElement("div");
    popup.id = "my-extension-popup";

    popup.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #111;
        color: white;
        padding: 14px 18px;
        border-radius: 8px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.3);
        font-family: system-ui, Arial;
        z-index: 999999;
        max-width: 260px;
      ">
        <div style="font-size: 14px; margin-bottom: 8px;">
          👋 Hello from your Chrome Extension!
        </div>
        <button id="close-popup" style="
          background: #444;
          border: none;
          color: white;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
        ">
          Close
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    popup.querySelector("#close-popup").onclick = () => {
      popup.remove();
    };
  }
});
