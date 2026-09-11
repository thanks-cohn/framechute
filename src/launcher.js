const workspaceUrl = chrome.runtime.getURL("src/workspace.html");

async function openFrameChute() {
  try {
    await chrome.tabs.create({ url: workspaceUrl });
    window.close();
  } catch (error) {
    console.error("FrameChute launcher could not create a tab:", error);
    const opened = window.open(workspaceUrl, "_blank", "noopener");
    if (opened) window.close();
    else document.body.textContent = "FrameChute could not open a tab. Open the extension again or allow pop-ups for this browser session.";
  }
}

void openFrameChute();
