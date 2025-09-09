import { ThemeBtn } from "./components/global/theme-btn";
import { Button } from "./components/ui/button";

const App = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1>
        <Button>Click me</Button>
        <ThemeBtn />
      </h1>
    </div>
  );
};

export default App;
