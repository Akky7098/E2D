import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await login({
        email: email.trim(),
        password,
      });

      navigate("/dashboard");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="brand-mark large">E2D</div>
          <h1>Bharat Special Steels</h1>
          <p>AI powered WhatsApp enquiry to dispatch automation.</p>
        </div>

        <div className="login-highlights">
          <div>
            <ShieldCheck size={22} />
            <span>Material availability tracking</span>
          </div>
          <div>
            <ShieldCheck size={22} />
            <span>Shed-wise WhatsApp automation</span>
          </div>
          <div>
            <ShieldCheck size={22} />
            <span>AI extracted enquiry flow</span>
          </div>
        </div>
      </div>

      <div className="login-card">
        <h2>Welcome back</h2>
        <p>Login to continue to E2D dashboard</p>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <div className="input-box">
            <Mail size={18} />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <label>Password</label>
          <div className="input-box">
            <Lock size={18} />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button className="primary-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;