// ========================================================
// FlowerShop - Florist AI Chatbot
// Tích hợp AI Trợ Lý Tư Vấn qua Cloudflare Worker Backend
// ========================================================

let chatHistory = [];
let isChatbotBusy = false;

// Bật / tắt cửa sổ Chatbot
function toggleChatbot() {
  const win = document.getElementById('chatbot-window');
  if (!win) return;
  const isFlex = win.style.display === 'flex';
  win.style.display = isFlex ? 'none' : 'flex';
  if (!isFlex) {
    document.getElementById('chatbot-input')?.focus();
  }
}

// Gửi tin nhắn từ người dùng
async function sendChatMessage() {
  const input = document.getElementById('chatbot-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || isChatbotBusy) return;

  // Hiển thị tin nhắn người dùng
  appendChatMessage(text, 'user');
  input.value = '';

  // Bật trạng thái đang trả lời
  setChatbotLoading(true);

  // Lấy API key tuỳ chọn từ localStorage nếu có
  const customApiKey = localStorage.getItem('custom_gemini_api_key') || '';

  try {
    const res = await apiRequest('/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        message: text,
        apiKey: customApiKey
      })
    });

    setChatbotLoading(false);

    if (res.success && res.reply) {
      appendChatMessage(res.reply, 'bot', res.provider);
    } else {
      appendChatMessage('Xin lỗi bạn, trợ lý AI đang bận một chút. Bạn có thể hỏi lại hoặc gọi hotline 0362843621 để được hỗ trợ ngay nhé! 🌸', 'bot');
    }
  } catch (err) {
    setChatbotLoading(false);
    appendChatMessage('⚠️ Không thể kết nối đến Trợ lý AI. Vui lòng thử lại sau giây lát!', 'bot');
  }
}

// Gửi câu hỏi nhanh từ gợi ý (Chip)
function sendQuickPrompt(promptText) {
  const input = document.getElementById('chatbot-input');
  if (input) {
    input.value = promptText;
    sendChatMessage();
  }
}

// Thêm tin nhắn vào khung chat
function appendChatMessage(text, sender = 'bot', provider = null) {
  const container = document.getElementById('chatbot-messages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${sender}`;

  // Format Markdown đơn giản
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-light px-1 rounded text-danger">$1</code>')
    .replace(/\n/g, '<br>');

  let meta = '';
  if (sender === 'bot' && provider) {
    meta = `<div class="text-muted mt-1" style="font-size: 0.68rem;"><i class="fas fa-sparkles text-warning me-1"></i>${provider}</div>`;
  }

  msgDiv.innerHTML = formatted + meta;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// Hiệu ứng đang gõ
function setChatbotLoading(loading) {
  isChatbotBusy = loading;
  const sendBtn = document.getElementById('chatbot-send');
  const input = document.getElementById('chatbot-input');
  const loadingIndicator = document.getElementById('chatbot-loading-dots');

  if (sendBtn) sendBtn.disabled = loading;
  if (input) input.disabled = loading;

  if (loadingIndicator) {
    loadingIndicator.style.display = loading ? 'block' : 'none';
  }
}

// Hỗ trợ gõ Enter để gửi
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chatbot-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
});

