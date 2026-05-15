/**
 * ChatSaver popup.js
 * Manages the UI, storage, and export interactions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const chatList = document.getElementById('chat-list');
  const saveBtn = document.getElementById('save-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');
  const exportAllBtn = document.getElementById('export-all-btn');
  const searchInput = document.getElementById('search-input');
  const settingsBtn = document.getElementById('settings-btn');
  const statusMsg = document.getElementById('status-msg');
  const statusText = document.getElementById('status-text');

  let savedChats = [];

  // Load initial data
  const data = await chrome.storage.local.get(['chats']);
  savedChats = data.chats || [];

  renderChats();

  // --- Event Listeners ---

  saveBtn.addEventListener('click', handleSaveChat);
  
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all saved chats? This cannot be undone.')) {
      savedChats = [];
      chrome.storage.local.set({ chats: [] });
      renderChats();
      showStatus('History cleared', 'info');
    }
  });

  exportAllBtn.addEventListener('click', handleExportAll);

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    renderChats(term);
  });

  settingsBtn.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+S to Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSaveChat();
    }
    // Ctrl+F to Focus Search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // --- Core Functions ---

  /**
   * Handles the chat saving process.
   */
  async function handleSaveChat() {
    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="skeleton-text" style="width: 20px; height: 14px; margin: 0"></span> Saving...';

      // 1. Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.startsWith('http')) {
        showStatus('Cannot save from this page', 'error');
        return;
      }

      // 2. Inject content script if not already there and extract chat
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: "extractChat" });
      } catch (err) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        response = await chrome.tabs.sendMessage(tab.id, { action: "extractChat" });
      }

      if (!response || !response.success) {
        showStatus(response?.error || 'No chat found', 'error');
        return;
      }

      // 3. Create chat object
      const newChat = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        text: response.chatText,
        dateFormatted: formatDate(new Date())
      };

      // 4. Save to storage
      savedChats.unshift(newChat);
      await chrome.storage.local.set({ chats: savedChats });
      renderChats();
      showStatus('Chat Saved!', 'success');

    } catch (error) {
      console.error('Save failed:', error);
      showStatus('Save failed', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Current Chat`;
    }
  }

  /**
   * Renders the list of chats to the UI.
   */
  function renderChats(filter = '') {
    const filtered = savedChats.filter(chat => 
      chat.text.toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
      chatList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${filter ? '🔍' : '💬'}</div>
          <p>${filter ? 'No matches found.' : 'No chats saved yet.<br>Go to any AI and click Save Chat!'}</p>
        </div>
      `;
      return;
    }

    chatList.innerHTML = '';
    filtered.forEach((chat) => {
      const card = document.createElement('div');
      card.className = 'chat-card';
      
      const chatNum = savedChats.length - savedChats.indexOf(chat);
      const previewText = chat.text.substring(0, 120) + (chat.text.length > 120 ? '...' : '');

      card.innerHTML = `
        <div class="chat-header">
          <div class="chat-info">
            <span class="chat-number">Chat #${chatNum}</span>
            <span class="chat-time">${chat.timestamp}</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon download-chat" data-id="${chat.id}" data-tooltip="Download TXT">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button class="btn-icon delete-chat" data-id="${chat.id}" data-tooltip="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
        <div class="chat-preview">${previewText}</div>
        <div class="chat-actions">
          <button class="btn btn-primary btn-full restore-chat" data-id="${chat.id}" data-tooltip="Ctrl+R">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            Restore Context
          </button>
        </div>
      `;

      // Add event listeners
      card.querySelector('.delete-chat').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      card.querySelector('.download-chat').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadChatAsTxt(chat, chatNum);
      });

      card.querySelector('.restore-chat').addEventListener('click', () => {
        handleRestoreChat(chat.text);
      });

      chatList.appendChild(card);
    });
  }

  async function handleRestoreChat(text) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: "restoreChat", 
        chatText: text 
      });
      
      if (response && response.success) {
        showStatus('Context Restored!', 'success');
      } else {
        showStatus('Could not find input box', 'error');
      }
    } catch (err) {
      showStatus('Restoration failed', 'error');
    }
  }

  function deleteChat(id) {
    savedChats = savedChats.filter(c => c.id !== id);
    chrome.storage.local.set({ chats: savedChats });
    renderChats(searchInput.value.toLowerCase());
    showStatus('Deleted', 'info');
  }

  /**
   * Downloads a single chat as a .txt file.
   */
  function downloadChatAsTxt(chat, chatNum) {
    const filename = `ChatSaver_Chat${chatNum}_${chat.dateFormatted || formatDate(new Date())}.txt`;
    const blob = new Blob([chat.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Downloaded!', 'success');
  }

  /**
   * Exports all chats as a ZIP file containing individual .txt files.
   */
  async function handleExportAll() {
    if (savedChats.length === 0) {
      showStatus('No chats to export', 'error');
      return;
    }

    try {
      const zip = new JSZip();
      savedChats.forEach((chat, index) => {
        const chatNum = savedChats.length - index;
        const filename = `ChatSaver_Chat${chatNum}_${chat.dateFormatted || formatDate(new Date())}.txt`;
        zip.file(filename, chat.text);
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "ChatSaver_Export.zip";
      a.click();
      URL.revokeObjectURL(url);
      showStatus('ZIP Exported!', 'success');
    } catch (err) {
      console.error('ZIP failed:', err);
      showStatus('Export failed', 'error');
    }
  }

  function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Shows a temporary status message with animation.
   */
  function showStatus(text, type) {
    statusText.innerText = text;
    const checkmark = statusMsg.querySelector('.checkmark');
    
    if (type === 'success') {
      checkmark.style.backgroundColor = 'var(--accent-green)';
      checkmark.innerText = '✓';
      checkmark.classList.remove('hidden');
    } else if (type === 'error') {
      checkmark.style.backgroundColor = 'var(--accent-red)';
      checkmark.innerText = '!';
      checkmark.classList.remove('hidden');
    } else {
      checkmark.classList.add('hidden');
    }

    statusMsg.classList.add('show');
    setTimeout(() => {
      statusMsg.classList.remove('show');
    }, 2000);
  }
});
