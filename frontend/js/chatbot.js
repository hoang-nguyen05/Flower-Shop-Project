// ========================================================
// FlowerShop - Florist AI Chatbot
// Tích hợp Kiến Trúc Enterprise AI (8 Trụ Cột)
// Model: Google Gemini 3.6 Flash / 3.5 Flash + Cloudflare RAG
// ========================================================

let chatHistory = [];
let isChatbotBusy = false;
let thinkingInterval = null;

// 1. Bật / tắt cửa sổ Chatbot
function toggleChatbot() {
  const win = document.getElementById('chatbot-window');
  if (!win) return;
  const isFlex = win.style.display === 'flex';
  win.style.display = isFlex ? 'none' : 'flex';
  if (!isFlex) {
    document.getElementById('chatbot-input')?.focus();
    scrollChatToBottom();
  }
}

// 2. Gửi tin nhắn từ người dùng
async function sendChatMessage() {
  const input = document.getElementById('chatbot-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || isChatbotBusy) return;

  // Hiển thị tin nhắn người dùng
  appendChatMessage(text, 'user');
  input.value = '';

  // Thêm vào lịch sử hội thoại
  chatHistory.push({ role: 'user', content: text });
  if (chatHistory.length > 8) {
    chatHistory = chatHistory.slice(-8); // Giữ 4-8 lượt gần nhất
  }

  // Bật trạng thái đang suy nghĩ & soạn tin nhắn
  showThinkingIndicator();

  try {
    const res = await apiRequest('/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(0, -1) // Gửi kèm lịch sử trước đó
      })
    });

    hideThinkingIndicator();

    if (res.success && res.reply) {
      appendChatMessage(res.reply, 'bot', res.provider, res.latencyMs);
      chatHistory.push({ role: 'model', content: res.reply });
    } else {
      appendChatMessage('Xin lỗi bạn, trợ lý Florist AI đang bận một chút. Bạn có thể hỏi lại hoặc gọi hotline 0362843621 để được thợ hoa hỗ trợ ngay nhé! 🌸', 'bot');
    }
  } catch (err) {
    hideThinkingIndicator();
    appendChatMessage('⚠️ Không thể kết nối đến Trợ lý AI. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau giây lát!', 'bot');
  }
}

// 3. Gửi câu hỏi nhanh từ gợi ý (Chip)
function sendQuickPrompt(promptText) {
  const input = document.getElementById('chatbot-input');
  if (input) {
    input.value = promptText;
    sendChatMessage();
  }
}

// 4. Hiển thị Trạng thái Đang Suy Nghĩ / Đang Soạn Tin (Thinking Indicator)
function showThinkingIndicator() {
  isChatbotBusy = true;
  const container = document.getElementById('chatbot-messages');
  const sendBtn = document.getElementById('chatbot-send');
  const input = document.getElementById('chatbot-input');

  if (sendBtn) sendBtn.disabled = true;
  if (input) input.disabled = true;

  // Xóa thinking cũ nếu có
  const oldIndicator = document.getElementById('chatbot-thinking-indicator');
  if (oldIndicator) oldIndicator.remove();

  if (!container) return;

  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'chat-msg bot thinking';
  thinkingDiv.id = 'chatbot-thinking-indicator';
  thinkingDiv.innerHTML = `
    <div class="typing-indicator">
      <span></span><span></span><span></span>
    </div>
    <div class="thinking-status" id="thinking-status-text">
      🌸 Florist AI đang đọc tin nhắn...
    </div>
  `;
  container.appendChild(thinkingDiv);
  scrollChatToBottom();

  // Chu kỳ đổi trạng thái để người dùng biết AI đang làm gì (RAG / Suy luận)
  const statusTexts = [
    '🌸 Florist AI đang đọc tin nhắn...',
    '🔍 Đang tra cứu danh mục & giá hoa...',
    '🌿 Kiểm tra tình trạng tồn kho & ưu đãi...',
    '✍️ Đang soạn câu trả lời cho bạn...'
  ];
  let step = 0;
  if (thinkingInterval) clearInterval(thinkingInterval);
  thinkingInterval = setInterval(() => {
    step = (step + 1) % statusTexts.length;
    const label = document.getElementById('thinking-status-text');
    if (label) label.textContent = statusTexts[step];
  }, 1400);
}

// 5. Tắt Trạng thái Đang Suy Nghĩ
function hideThinkingIndicator() {
  isChatbotBusy = false;
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = null;
  }
  const indicator = document.getElementById('chatbot-thinking-indicator');
  if (indicator) indicator.remove();

  const sendBtn = document.getElementById('chatbot-send');
  const input = document.getElementById('chatbot-input');
  if (sendBtn) sendBtn.disabled = false;
  if (input) {
    input.disabled = false;
    input.focus();
  }
}

// Helper chống XSS bằng cách mã hóa ký tự HTML an toàn
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 6. Thêm tin nhắn vào khung chat & Format Markdown an toàn
function appendChatMessage(text, sender = 'bot', provider = null, latencyMs = null) {
  const container = document.getElementById('chatbot-messages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${sender}`;

  // 1. Chống XSS: Luôn escape HTML trước khi render
  const safeText = escapeHtml(text);

  // 2. Format Markdown an toàn (Bold, Italic, Code, List, Newline)
  let formatted = safeText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-light px-1 rounded text-danger">$1</code>')
    .replace(/^- (.*$)/gim, '• $1')
    .replace(/\n/g, '<br>');

  let meta = '';
  if (sender === 'bot') {
    const timeStr = latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '';
    const provStr = provider || 'Florist AI';
    meta = `
      <div class="latency-badge">
        <i class="fas fa-bolt text-warning"></i>
        ${timeStr ? `<span>${timeStr}</span> • ` : ''}
        <span>${provStr}</span>
      </div>
    `;
  }

  msgDiv.innerHTML = formatted + meta;
  container.appendChild(msgDiv);
  scrollChatToBottom();
}

// 7. Cuộn mượt mà xuống cuối khung chat
function scrollChatToBottom() {
  const container = document.getElementById('chatbot-messages');
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// 8. Lắng nghe phím Enter
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
