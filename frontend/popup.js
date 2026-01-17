chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  document.getElementById("inject").onclick = () => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_POPUP" });
  };
});
    