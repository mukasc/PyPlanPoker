import { Moon, Sun } from "lucide-react";
import useAuthStore from "../store/authStore";
import api from "../services/api";

export default function ThemeToggle() {
  const { theme, setTheme, globalUser } = useAuthStore();

  const toggleTheme = async () => {
    const newTheme = theme === "classic" ? "bms" : "classic";
    setTheme(newTheme);
    
    if (globalUser && !globalUser.is_guest) {
      try {
        await api.post("/api/user/theme", { theme: newTheme });
      } catch (error) {
        console.error("Failed to sync theme preference", error);
      }
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-secondary text-foreground focus:outline-none transition-colors"
      aria-label="Toggle theme"
      title="Toggle Theme"
    >
      {theme === "classic" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
