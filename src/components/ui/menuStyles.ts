// Shared by context menus, submenus, and email selection actions. These surfaces
// are deliberately opaque: the workspace's warm translucent tokens reduce menu contrast.
export const menuSurface = "fixed z-[100] rounded-[10px] border border-black/10 bg-white p-1 text-[13px] leading-[18px] font-normal tracking-normal text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.20),0_2px_6px_rgba(15,23,42,0.12)] dark:border-white/15 dark:bg-slate-900 dark:text-slate-100";
export const menuRow = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-[18px] font-normal tracking-normal transition-colors disabled:cursor-default disabled:opacity-40";
export const menuHover = "hover:bg-slate-100 dark:hover:bg-slate-800";
export const menuActive = "bg-slate-100 dark:bg-slate-800";
export const menuFont = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };
