import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import ThreadWindow from "./ThreadWindow";
import ComposerWindow from "./ComposerWindow";
import "./styles/globals.css";
import { startEmailNavigationListener } from "./services/links/emailNavigation";
import { reportError } from "./stores/toastStore";

const params = new URLSearchParams(window.location.search);
const isThreadWindow = params.has("thread") && params.has("account");
const isComposerWindow = params.has("compose");

function Root() {
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    startEmailNavigationListener()
      .then((unlisten) => {
        if (disposed) unlisten();
        else cleanup = unlisten;
      })
      .catch((err) => reportError("Could not initialize email links", err));
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  if (isThreadWindow) return <ThreadWindow />;
  if (isComposerWindow) return <ComposerWindow />;
  return <RouterProvider router={router} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
