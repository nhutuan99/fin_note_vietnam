// Script kiểm thử cục bộ: Gửi tín hiệu giao dịch mô phỏng đến API webhook
// Cách chạy:
// 1. Khởi động worker cục bộ: cd worker && npx wrangler dev
// 2. Chạy script này: node scratch/test_trading_signal.js

const fetch = require('node-fetch'); // Nếu node phiên bản cũ cần cài node-fetch, hoặc dùng global.fetch trên Node 18+

const API_PORT = 8787; // Cổng mặc định của wrangler dev
const API_URL = `http://localhost:${API_PORT}/api/webhook/trading-signal`;

const USER_ID = 'test-user-123'; // ID người dùng thử nghiệm
const WEBHOOK_SECRET = 'test_webhook_secret_123'; // Đặt trùng với TELEGRAM_WEBHOOK_SECRET trong .dev.vars

const mockTelegramMessage = `[🚀 PULSE PHASE DETECTION ALGORITHM ]
[Alert: 6 tiếng/lần]

₿ CRYPTO
BTC $76,885 | -1.04% | 35/100 | Pre Bear
┌— Top Strength ——————————————————————————————┐
│ ALLO +19.93% | 82/100 | Pre Bull            │
│ PLUME +16.77% | 80/100 | Pre Bull           │
│ ZBT +5.14% | 79/100 | Pre Bull              │
│ WLD +14.13% | 78/100 | Pre Bull             │
│ EIGEN +11.18% | 75/100 | Pre Bull           │
│ TIA +9.79% | 75/100 | Pre Bull              │
│ CFG +5.65% | 71/100 | Pre Bull              │
│ BCH +0.13% | 68/100 | Pre Bull              │
└—————————————————————————————————————————————┘

📈 VNSTOCK
VNINDEX 1,877.13 | +0.19% | 41/100 | Pre Bear
┌— Top Strength ——————————————————————————————┐
│ MSB +1.05% | 69/100 | Pre Bull              │
│ POW +0.37% | 69/100 | Accum                 │
│ HPG -0.38% | 69/100 | FOMO                  │
│ MSN -0.52% | 69/100 | FOMO                  │
│ NVL -0.64% | 69/100 | FOMO                  │
│ DCM 0.00% | 68/100 | FOMO                   │
│ ACB -0.22% | 68/100 | Accum                 │
│ NT2 +0.22% | 67/100 | FOMO                  │
└—————————————————————————————————————————————┘

💱 FOREX / GOLD
DXY 99.31 | -0.07% | 67/100 | Accum
┌— Top Movers ————————————————————————————————┐
│ NZDUSD -0.52% | 70/100 | Pre Bear           │
│ USDCAD +0.30% | 69/100 | Pre Bull           │
│ USDJPY +0.21% | 68/100 | Pre Bull           │
│ DXY -0.07% | 67/100 | Accum                 │
│ AUDUSD -0.45% | 47/100 | Pre Bear           │
│ USDCHF -0.06% | 45/100 | Pre Bear           │
│ XAUUSD +0.13% | 45/100 | Pre Bear           │
│ GBPUSD -0.06% | 44/100 | Pre Bull           │
└—————————————————————————————————————————————┘

🛠 PLAYBOOK (AI Recommend)
- Giữ size nhỏ, chờ xác nhận.
- Chọn setup rõ trend.
- TRÁNH: FOMO, đuổi lệnh, đoán đáy.`;

async function testWebhook() {
  console.log(`Gửi tín hiệu mô phỏng đến: ${API_URL}`);
  console.log(`User ID: ${USER_ID}`);
  
  const payload = {
    userId: USER_ID,
    text: mockTelegramMessage
  };

  try {
    const res = await fetch(`${API_URL}?userId=${USER_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    console.log(`Mã trạng thái phản hồi: ${status}`);

    const data = await res.json();
    console.log('Kết quả trả về từ API:', JSON.stringify(data, null, 2));

    if (res.ok && data.success) {
      console.log('\n✅ KIỂM THỬ THÀNH CÔNG!');
      console.log(`Ghi chú mới được tạo: "${data.data.title}" (ID: ${data.data.noteId})`);
    } else {
      console.log('\n❌ KIỂM THỬ THẤT BẠI!');
    }
  } catch (err) {
    console.error('Lỗi khi gửi yêu cầu:', err.message);
    console.log('\n💡 Lưu ý: Hãy đảm bảo bạn đã khởi chạy `npx wrangler dev` trong thư mục `worker/` trước khi chạy script.');
  }
}

testWebhook();
