import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquareText,
  ClipboardCheck,
  AlertTriangle,
  Warehouse,
  Users,
  ShieldCheck,
  Database,
} from "lucide-react";
import "./DashboardPage.css";

const modules = [
  {
    title: "Dashboard",
    desc: "Business overview",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Enquiry",
    desc: "WhatsApp & manual enquiries",
    path: "/enquiries",
    icon: MessageSquareText,
  },
  {
    title: "Material Check",
    desc: "Line-wise stock check",
    path: "/material-check",
    icon: ClipboardCheck,
  },
  {
    title: "Manual Review",
    desc: "AI unclear cases",
    path: "/manual-review",
    icon: AlertTriangle,
  },
  {
    title: "Sheds",
    desc: "Shed assignment",
    path: "/sheds",
    icon: Warehouse,
  },
  {
    title: "Grade Master",
    desc: "Grade/category rules",
    path: "/grade-master",
    icon: Database,
  },
  {
    title: "Users",
    desc: "Roles & access",
    path: "/users",
    icon: Users,
  },
  {
    title: "Approvals",
    desc: "Supervisor actions",
    path: "/approvals",
    icon: ShieldCheck,
  },
];

function DashboardPage() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="mobile-dashboard">
      <section className="dash-hero-card">
        <div className="dash-top-row">
          <div className="brand-pill">BHARAT E2D</div>
          <button className="bell-btn">🔔</button>
        </div>

        <p className="welcome-text">Welcome back,</p>
        <h1>{user?.name || "User"}</h1>
        <span className="role-pill">{user?.role || "Admin"}</span>

        <div className="workspace-card">
          <div>
            <strong>Today’s Workspace</strong>
            <p>Manage steel enquiries faster</p>
          </div>
          <span>⚡</span>
        </div>
      </section>

      <section className="quick-stats">
        <div>
          <span>Today</span>
          <strong>0</strong>
          <small>Enquiries</small>
        </div>
        <div>
          <span>Pending</span>
          <strong>0</strong>
          <small>Material Check</small>
        </div>
      </section>

      <div className="section-heading">
        <h2>Modules</h2>
        <p>Open required workspace</p>
      </div>

      <section className="module-grid">
        {modules.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.title}
              className="module-card"
              onClick={() => navigate(item.path)}
            >
              <div className="module-icon">
                <Icon size={22} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
}

export default DashboardPage;