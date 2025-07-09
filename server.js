require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// Supabase配置
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 支付记录API
app.post('/api/payment', async (req, res) => {
  try {
    const { email, description, file_urls } = req.body;

    const { data, error } = await supabase
      .from('payments')
      .insert({
        email,
        description,
        file_urls,
        created_at: new Date()
      })
      .select();

    if (error) throw error;

    res.status(200).json({
      success: true,
      payment_id: data[0].id
    });
  } catch (error) {
    console.error('支付记录保存失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});