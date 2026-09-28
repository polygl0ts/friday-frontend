import { AsciiFrame } from "../components/AsciiFrame";
import { Markdown } from "../components/Markdown";
import guide from "./home.md?raw";

export function Home() {
  return (
    <div className="page">
      <AsciiFrame rank="silver" className="home-frame">
        <Markdown>{guide}</Markdown>
      </AsciiFrame>
    </div>
  );
}
