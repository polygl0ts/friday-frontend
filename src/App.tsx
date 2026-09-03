import { Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { Header } from "./components/Header";
import { RequireAdmin } from "./components/RequireAdmin";
import { Admin } from "./pages/Admin";
import { AdminChallenges } from "./pages/AdminChallenges";
import { AdminTeams } from "./pages/AdminTeams";
import { ArchivedChalls } from "./pages/ArchivedChalls";
import { Challenges } from "./pages/Challenges";
import { Home } from "./pages/Home";
import { Intro2 } from "./pages/Intro2";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { Scoreboard } from "./pages/Scoreboard";
import { Slides } from "./pages/Slides";
import { Verify } from "./pages/Verify";
import { Writeups } from "./pages/Writeups";

function App() {
  return (
    <>
      <div
        style={{
          pointerEvents: "none",
          position: "fixed",
          inset: 0,
          zIndex: 1,
          opacity: 0.35,
          background:
            "repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,43,62,.028) 3px 4px)",
        }}
      />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/intro2" element={<Intro2 />} />
        <Route path="/chall" element={<Challenges />} />
        <Route path="/writeups" element={<Writeups />} />
        <Route path="/archived" element={<ArchivedChalls />} />
        <Route path="/slides" element={<Slides />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/profile" element={<Profile />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Admin />} />
          <Route path="challs" element={<AdminChallenges />} />
          <Route path="teams" element={<AdminTeams />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
