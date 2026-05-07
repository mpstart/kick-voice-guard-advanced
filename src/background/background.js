chrome.runtime.onInstalled.addListener(() => {
  console.log('%c🚀 Kick Voice Guard v2.0 instalada', 'color:#00ff9d');
});

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url.includes('kick.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { action: command });
    }
  });
});