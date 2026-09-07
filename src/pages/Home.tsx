import { Markdown } from "../components/Markdown";
import guide from "./home.md?raw";

export function Home() {
  return (
    <div className="page">
      <div className="panel" style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ padding: 24 }}>
          <Markdown>{guide}</Markdown>
        </div>
      </div>
    </div>
  );
}
