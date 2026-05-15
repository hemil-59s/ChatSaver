/**
 * ChatSaver content.js
 * Handles chat extraction and restoration for various AI platforms.
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractChat") {
    const chatData = extractChatData();
    sendResponse(chatData);
  } else if (request.action === "restoreChat") {
    const success = restoreChatToInput(request.chatText);
    sendResponse({ success });
  }
  return true; // Keep the message channel open for async responses
});

/**
 * Extracts chat messages from the current page based on platform-specific selectors.
 * @returns {Object} { success: boolean, chatText: string, error: string }
 */
function extractChatData() {
  const hostname = window.location.hostname;
  let messages = [];

  // Define platform-specific selectors
  const platforms = {
    "claude.ai": [
      { user: '[data-testid="human-turn"]', ai: '[data-testid="ai-turn"]' },
      { user: '[class*="human"]', ai: '[class*="assistant"]' },
      { user: '.prose', ai: '.prose' } // Fallback
    ],
    "chatgpt.com": [
      { user: '[data-message-author-role="user"]', ai: '[data-message-author-role="assistant"]' }
    ],
    "chat.openai.com": [
      { user: '[data-message-author-role="user"]', ai: '[data-message-author-role="assistant"]' }
    ],
    "gemini.google.com": [
      { user: 'user-query', ai: 'model-response' }
    ],
    "grok.com": [
      { user: '[class*="userMessage"]', ai: '[class*="assistantMessage"]' }
    ],
    "x.com": [
      { user: '[class*="userMessage"]', ai: '[class*="assistantMessage"]' }
    ],
    "perplexity.ai": [
      { user: '[class*="query-text"]', ai: '[class*="prose"]' }
    ],
    "copilot.microsoft.com": [
      { user: '[class*="user-message"]', ai: '[class*="ai-message"]' }
    ],
    "chat.deepseek.com": [
      { user: '[class*="human"]', ai: '[class*="assistant"]' }
    ]
  };

  // Find matching platform or use universal fallback
  let platformSelectors = null;
  for (const domain in platforms) {
    if (hostname.includes(domain)) {
      platformSelectors = platforms[domain];
      break;
    }
  }

  if (platformSelectors) {
    for (const selectorPair of platformSelectors) {
      const userMsgs = document.querySelectorAll(selectorPair.user);
      const aiMsgs = document.querySelectorAll(selectorPair.ai);
      
      if (userMsgs.length > 0 || aiMsgs.length > 0) {
        // We found something. Now we need to interleave them or extract in order.
        // Most platforms have a common container for turns.
        messages = extractOrderedMessages(selectorPair.user, selectorPair.ai);
        if (messages.length > 0) break;
      }
    }
  }

  // Universal fallback if no platform matches or no messages found
  if (messages.length === 0) {
    const fallbackSelectors = [
      '[class*="message"]', '[class*="chat"]', '[class*="conversation"]', '[class*="bubble"]', '[class*="turn"]'
    ];
    
    for (const selector of fallbackSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 3) {
        elements.forEach(el => {
          const text = el.innerText.trim();
          if (text) {
            // Try to guess role based on class or content
            const role = (el.className.toLowerCase().includes('user') || el.className.toLowerCase().includes('human')) ? 'You' : 'AI';
            messages.push(`${role}: ${text}`);
          }
        });
        break;
      }
    }
  }

  // Last resort: document.body.innerText
  if (messages.length === 0) {
    const text = document.body.innerText.trim();
    if (text.length > 100) {
      messages.push(`Chat Content:\n${text}`);
    }
  }

  if (messages.length === 0) {
    return { success: false, error: "No chat found on this page" };
  }

  return { success: true, chatText: messages.join('\n\n') };
}

/**
 * Attempts to extract messages in chronological order by looking at the DOM structure.
 */
function extractOrderedMessages(userSelector, aiSelector) {
  const allElements = document.querySelectorAll(`${userSelector}, ${aiSelector}`);
  const messages = [];
  
  allElements.forEach(el => {
    const isUser = el.matches(userSelector);
    const role = isUser ? "You" : "AI";
    const text = el.innerText.trim();
    if (text) {
      messages.push(`${role}: ${text}`);
    }
  });
  
  return messages;
}

/**
 * Restores chat text into the active AI input box.
 * @param {string} chatText 
 * @returns {boolean} success
 */
function restoreChatToInput(chatText) {
  const formattedText = `--- Previous Chat Context ---\n\n${chatText}\n\n--- Continue Here ---\n\n`;
  
  // Find potential input elements
  const selectors = [
    'textarea',
    'div[contenteditable="true"]',
    'input[type="text"]',
    '[role="textbox"]'
  ];
  
  let inputElement = null;
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    // Prefer visible and focused or large elements
    for (const el of elements) {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        inputElement = el;
        break;
      }
    }
    if (inputElement) break;
  }

  if (!inputElement) return false;

  try {
    inputElement.focus();
    
    // Try to use execCommand for better compatibility with framework-based inputs
    const selection = window.getSelection();
    if (inputElement.isContentEditable) {
      inputElement.innerText = formattedText;
    } else {
      inputElement.value = formattedText;
    }
    
    // Trigger input events so the website's JS knows the value changed
    const inputEvent = new Event('input', { bubbles: true });
    inputElement.dispatchEvent(inputEvent);
    const changeEvent = new Event('change', { bubbles: true });
    inputElement.dispatchEvent(changeEvent);
    
    return true;
  } catch (e) {
    console.error("ChatSaver: Restoration failed", e);
    return false;
  }
}
