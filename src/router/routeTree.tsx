import { lazy, Suspense } from "react";
import {
  createRootRoute,
  createRoute,
  redirect,
} from "@tanstack/react-router";
import App from "@/App";
import { MailLayout } from "@/components/layout/MailLayout";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useUIStore } from "@/stores/uiStore";

// Lazy-load heavy pages — these include many sub-components and service imports
const HelpPage = lazy(() => import("@/components/help/HelpPage").then((m) => ({ default: m.HelpPage })));
const CalendarPage = lazy(() => import("@/components/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const TasksPage = lazy(() => import("@/components/tasks/TasksPage").then((m) => ({ default: m.TasksPage })));
const AttachmentLibrary = lazy(() => import("@/components/attachments/AttachmentLibrary").then((m) => ({ default: m.AttachmentLibrary })));

// ---------- Search param validation ----------
const VALID_CATEGORIES = ["Primary", "Updates", "Promotions", "Social", "Newsletters"] as const;

type MailSearch = {
  q?: string;
  category?: (typeof VALID_CATEGORIES)[number];
};

function validateMailSearch(search: Record<string, unknown>): MailSearch {
  const result: MailSearch = {};
  if (typeof search["q"] === "string" && search["q"]) {
    result.q = search["q"];
  }
  const cat = search["category"];
  if (typeof cat === "string" && (VALID_CATEGORIES as readonly string[]).includes(cat)) {
    result.category = cat as MailSearch["category"];
  }
  return result;
}

// ---------- Root (shell: TitleBar, Sidebar, overlays) ----------
export const rootRoute = createRootRoute({
  component: App,
});

// ---------- / (index) → redirect to /mail/inbox ----------
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/mail/$label", params: { label: "inbox" } });
  },
});

// ---------- Mail routes: render MailLayout for all mail views ----------
function MailPage() {
  return (
    <ErrorBoundary name="MailLayout">
      <MailLayout />
    </ErrorBoundary>
  );
}

function CalendarPageWrapper() {
  return (
    <ErrorBoundary name="CalendarPage">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">Loading calendar...</div>}>
        <CalendarPage />
      </Suspense>
    </ErrorBoundary>
  );
}

function HelpPageWrapper() {
  return (
    <ErrorBoundary name="HelpPage">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">Loading help...</div>}>
        <HelpPage />
      </Suspense>
    </ErrorBoundary>
  );
}

// ---------- /mail/$label ----------
export const mailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "mail/$label",
  validateSearch: validateMailSearch,
  component: MailPage,
});

// ---------- /mail/$label/thread/$threadId ----------
export const mailThreadRoute = createRoute({
  getParentRoute: () => mailRoute,
  path: "thread/$threadId",
});

// ---------- /label/$labelId ----------
export const labelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "label/$labelId",
  validateSearch: validateMailSearch,
  component: MailPage,
});

// ---------- /label/$labelId/thread/$threadId ----------
export const labelThreadRoute = createRoute({
  getParentRoute: () => labelRoute,
  path: "thread/$threadId",
});

// ---------- /smart-folder/$folderId ----------
export const smartFolderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "smart-folder/$folderId",
  validateSearch: validateMailSearch,
  component: MailPage,
});

// ---------- /smart-folder/$folderId/thread/$threadId ----------
export const smartFolderThreadRoute = createRoute({
  getParentRoute: () => smartFolderRoute,
  path: "thread/$threadId",
});

// ---------- /settings (+ /settings/$tab) ----------
// Settings renders as a dialog over the mail UI rather than as its own page.
// These routes only exist so external deep links keep working: they open the
// dialog on the requested tab and hand the user back to the inbox behind it.
const settingsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  beforeLoad: () => {
    useUIStore.getState().openSettings("general");
    throw redirect({ to: "/mail/$label", params: { label: "inbox" } });
  },
});

export const settingsTabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings/$tab",
  beforeLoad: ({ params }) => {
    useUIStore.getState().openSettings(params.tab);
    throw redirect({ to: "/mail/$label", params: { label: "inbox" } });
  },
});

// ---------- /attachments ----------
function AttachmentLibraryWrapper() {
  return (
    <ErrorBoundary name="AttachmentLibrary">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">Loading attachments...</div>}>
        <AttachmentLibrary />
      </Suspense>
    </ErrorBoundary>
  );
}

export const attachmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "attachments",
  component: AttachmentLibraryWrapper,
});

// ---------- /tasks ----------
function TasksPageWrapper() {
  return (
    <ErrorBoundary name="TasksPage">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">Loading tasks...</div>}>
        <TasksPage />
      </Suspense>
    </ErrorBoundary>
  );
}

export const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "tasks",
  component: TasksPageWrapper,
});

// ---------- /calendar ----------
export const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "calendar",
  component: CalendarPageWrapper,
});

// ---------- /help (redirect to /help/getting-started) ----------
const helpIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "help",
  beforeLoad: () => {
    throw redirect({ to: "/help/$topic", params: { topic: "getting-started" } });
  },
});

// ---------- /help/$topic ----------
export const helpTopicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "help/$topic",
  component: HelpPageWrapper,
});

// ---------- Route tree ----------
export const routeTree = rootRoute.addChildren([
  indexRoute,
  mailRoute.addChildren([mailThreadRoute]),
  labelRoute.addChildren([labelThreadRoute]),
  smartFolderRoute.addChildren([smartFolderThreadRoute]),
  settingsIndexRoute,
  settingsTabRoute,
  attachmentsRoute,
  tasksRoute,
  calendarRoute,
  helpIndexRoute,
  helpTopicRoute,
]);
