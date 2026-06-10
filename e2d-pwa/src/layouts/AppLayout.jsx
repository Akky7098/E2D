import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquareText,
  ClipboardCheck,
  Users,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/enquiries", label: "Enquiry", icon: MessageSquareText },
  { path: "/material-check", label: "Material", icon: ClipboardCheck },
  { path: "/users", label: "Users", icon: Users },
];

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">E2D</div>
          <div>
            <h2>Bharat E2D</h2>
            <p>Enquiry to Dispatch</p>
          </div>
        </div>

        <nav className="side-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.path} to={item.path}>
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">          
          <div className="top-user">
            <span>{user?.name || "User"}</span>
            <small>{user?.role || "role"}</small>
          </div>
        </header>

        <section className="content-area">
          <Outlet />
        </section>
      </main>

      <nav className="mobile-bottom-nav">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path}>
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default AppLayout;