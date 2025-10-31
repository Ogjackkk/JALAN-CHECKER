const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

const accountSid = 'AC34329ceb2ec585b53cf5579ec00e850a';
const authToken = '9703442b26d81f8bac08437490333a82';
const twilioPhone = 'YOUR_TWILIO_PHONE_NUMBER';

const client = twilio(accountSid, authToken);

app.post('/send-otp', async (req, res) => {
  const { phone, otp } = req.body;
  try {
    await client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: twilioPhone,
      to: phone
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(5001, () => console.log('Twilio OTP server running on port 5001'));