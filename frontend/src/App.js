import "@/App.css";
import { Toaster } from "sonner";
import Converter from "@/pages/Converter";

function App() {
  return (
    <div className="App">
      <Converter />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: 0,
            border: "1px solid #222",
            background: "#111",
            fontFamily: "'IBM Plex Mono', monospace",
          },
        }}
      />
    </div>
  );
}

export default App;
