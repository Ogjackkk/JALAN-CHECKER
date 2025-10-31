import { useState } from "react";
import { supabase } from "../supabaseClient";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const ForgotPasswordModal = ({ onClose }) => {
  const [identifier, setIdentifier] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("email");

  const handleSendOTP = async () => {
    let user;
    if (deliveryMethod === "email") {
      const { data } = await supabase
        .from("students")
        .select("email")
        .eq("email", identifier)
        .single();
      user = data;
      if (!user) {
        const { data: teacher } = await supabase
          .from("teachers")
          .select("email")
          .eq("email", identifier)
          .single();
        user = teacher;
      }
    } else {
      const { data } = await supabase
        .from("students")
        .select("phone_number")
        .eq("phone_number", identifier)
        .single();
      user = data;
    }
    if (!user) {
      setMessage("User not found.");
      return;
    }
    const otpCode = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("password_resets").insert([
      { user_email: user.email || "", user_phone: user.phone_number || "", otp: otpCode, expires_at: expires }
    ]);

    if (deliveryMethod === "phone") {
      try {
        const response = await fetch("http://localhost:5001/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: identifier, otp: otpCode }),
        });
        const result = await response.json();
        if (result.success) {
          setMessage("OTP sent to your phone!");
        } else {
          setMessage("Failed to send OTP: " + result.error);
        }
      } catch (err) {
        setMessage("Error sending OTP.");
      }
    } else {
      setMessage(`OTP sent! (Demo: ${otpCode})`);
    }
    setOtpSent(true);
  };

  const handleVerifyOTP = async () => {
    const { data: reset } = await supabase
      .from("password_resets")
      .select("*")
      .eq("user_email", identifier)
      .eq("otp", otp)
      .eq("used", false)
      .single();

    if (!reset || new Date(reset.expires_at) < new Date()) {
      setMessage("Invalid or expired OTP.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      email: identifier,
      password: newPassword,
    });
    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase
      .from("password_resets")
      .update({ used: true })
      .eq("id", reset.id);

    setMessage("Password changed! You can now log in.");
    setOtpSent(false);
  };

  return (
    <div className="modal">
      <button onClick={onClose}>Close</button>
      {!otpSent ? (
        <>
          <h3>Forgot Password</h3>
          <select value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value)}>
            <option value="email">Email</option>
            <option value="phone">Phone Number</option>
          </select>
          <input
            type="text"
            placeholder={deliveryMethod === "email" ? "Enter email" : "Enter phone number"}
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
          />
          <button onClick={handleSendOTP}>Send OTP</button>
        </>
      ) : (
        <>
          <h3>Enter OTP & New Password</h3>
          <input
            type="text"
            placeholder="OTP"
            value={otp}
            onChange={e => setOtp(e.target.value)}
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <button onClick={handleVerifyOTP}>Change Password</button>
        </>
      )}
      {message && <div>{message}</div>}
    </div>
  );
};

export default ForgotPasswordModal;