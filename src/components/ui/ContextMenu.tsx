import { useEffect, useRef, useState, useCallback } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { ChevronRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useShortcutStore } from "@/stores/shortcutStore";
import { menuSurface, menuRow, menuHover, menuActive, menuFont } from "./menuStyles";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  shortcutId?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separator?: boolean;
  children?: ContextMenuItem[];
  action?: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const keyMap = useShortcutStore((state) => state.keyMap);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [submenuOpenId, setSubmenuOpenId] = useState<string | null>(null);
  const submenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  // Track rects of items that have submenus for positioning
  const itemRectsRef = useRef<Map<string, DOMRect>>(new Map());

  useClickOutside(menuRef, () => {
    // Don't close if click is inside a submenu (which is portalled outside menuRef)
    // The submenu handles its own outside clicks
    if (!submenuOpenId) onClose();
  });

  // Measure and clamp position to viewport
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = position.x;
    let y = position.y;

    if (x + rect.width > vw) x = vw - rect.width - 4;
    if (y + rect.height > vh) y = vh - rect.height - 4;
    if (x < 4) x = 4;
    if (y < 4) y = 4;

    setAdjustedPosition({ x, y });
  }, [position]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setFocusedIndex((prev) => {
            let next = prev + 1;
            while (next < items.length && items[next]?.separator) next++;
            return next >= items.length ? prev : next;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedIndex((prev) => {
            let next = prev - 1;
            while (next >= 0 && items[next]?.separator) next--;
            return next < 0 ? prev : next;
          });
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const focused = items[focusedIndex];
          if (focused?.children && !focused.disabled) {
            setSubmenuOpenId(focused.id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          setSubmenuOpenId(null);
          break;
        }
        case "Enter": {
          e.preventDefault();
          const focused = items[focusedIndex];
          if (focused && !focused.disabled && !focused.separator) {
            if (focused.children) {
              setSubmenuOpenId(focused.id);
            } else if (focused.action) {
              focused.action();
              onClose();
            }
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        }
      }

      // Prevent other handlers from seeing these keys
      if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter", "Escape"].includes(e.key)) {
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [items, focusedIndex, onClose]);

  const cancelSubmenuTimer = useCallback(() => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback((index: number, item: ContextMenuItem) => {
    setFocusedIndex(index);
    cancelSubmenuTimer();

    if (item.children && !item.disabled) {
      submenuTimerRef.current = setTimeout(() => {
        setSubmenuOpenId(item.id);
      }, 100);
    } else {
      // Longer delay before closing to allow mouse to travel to submenu
      submenuTimerRef.current = setTimeout(() => {
        setSubmenuOpenId(null);
      }, 300);
    }
  }, [cancelSubmenuTimer]);

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled || item.separator) return;
    if (item.children) {
      setSubmenuOpenId((prev) => prev === item.id ? null : item.id);
      return;
    }
    item.action?.();
    onClose();
  }, [onClose]);

  // Close submenu when clicking outside both menu and submenu
  useEffect(() => {
    if (!submenuOpenId) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // If click is inside the main menu, let normal handlers deal with it
      if (menuRef.current?.contains(target)) return;
      // If click is inside a submenu portal, let it handle itself
      if ((target as HTMLElement).closest?.("[data-submenu-portal]")) return;
      // Click is outside everything — close all
      onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [submenuOpenId, onClose]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    };
  }, []);

  // Compute submenu anchor position from the parent item's rect
  const openItem = submenuOpenId ? items.find((i) => i.id === submenuOpenId) : null;
  const submenuAnchor = submenuOpenId ? itemRectsRef.current.get(submenuOpenId) : undefined;

  return (
    <>
      <div
        ref={menuRef}
        role="menu"
        className={`${menuSurface} min-w-[208px] max-h-[calc(100vh-16px)] overflow-y-auto`}
        style={{ ...menuFont, left: adjustedPosition.x, top: adjustedPosition.y }}
      >
        {items.map((item, index) => {
          if (item.separator) {
            return (
              <div
                key={item.id}
                role="separator"
                className="mx-2 my-1 border-t border-slate-200/80 dark:border-slate-700"
              />
            );
          }

          const Icon = item.icon;
          const isFocused = focusedIndex === index;
          const hasSubmenu = !!item.children;
          const isSubmenuOpen = submenuOpenId === item.id;
          const shortcut = item.shortcutId ? keyMap[item.shortcutId] : item.shortcut;

          return (
            <div key={item.id}>
              <button
                role="menuitem"
                ref={(el) => {
                  if (el && hasSubmenu) {
                    itemRectsRef.current.set(item.id, el.getBoundingClientRect());
                  }
                }}
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => handleMouseEnter(index, item)}
                className={`${menuRow} ${
                  item.disabled
                    ? "text-text-tertiary cursor-default"
                    : item.danger
                      ? `text-danger ${isFocused || isSubmenuOpen ? "bg-danger/10" : ""}`
                      : isFocused || isSubmenuOpen ? menuActive : menuHover
                }`}
              >
                {/* Checkmark or icon column */}
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {item.checked != null ? (
                    item.checked ? <Check size={12} /> : null
                  ) : Icon ? (
                    <Icon size={14} />
                  ) : null}
                </span>

                <span className="flex-1">{item.label}</span>

                {hasSubmenu && (
                  <ChevronRight size={12} className="text-text-tertiary shrink-0" />
                )}

                {shortcut && !hasSubmenu && (
                  <span className="ml-5 shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                    {shortcut}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Render submenu as a fixed-position sibling to avoid overflow clipping */}
      {openItem?.children && submenuAnchor && (
        <Submenu
          items={openItem.children}
          anchorRect={submenuAnchor}
          onClose={onClose}
          onMouseEnter={cancelSubmenuTimer}
        />
      )}
    </>
  );
}

function Submenu({
  items,
  anchorRect,
  onClose,
  onMouseEnter,
}: {
  items: ContextMenuItem[];
  anchorRect: DOMRect;
  onClose: () => void;
  onMouseEnter?: () => void;
}) {
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: anchorRect.right,
    top: anchorRect.top,
  });

  useEffect(() => {
    const submenu = submenuRef.current;
    if (!submenu) return;

    const submenuRect = submenu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer right side, fall back to left
    let left = anchorRect.right;
    if (left + submenuRect.width > vw) {
      left = anchorRect.left - submenuRect.width;
    }
    if (left < 4) left = 4;

    // Align top with anchor, clamp to viewport
    let top = anchorRect.top;
    if (top + submenuRect.height > vh) {
      top = vh - submenuRect.height - 4;
    }
    if (top < 4) top = 4;

    setPosition({ left, top });
  }, [anchorRect]);

  return (
    <div
      ref={submenuRef}
      role="menu"
      data-submenu-portal
      className={`${menuSurface} z-[101] min-w-[180px] max-h-[calc(100vh-16px)] overflow-y-auto`}
      style={{ ...menuFont, left: position.left, top: position.top }}
      onMouseEnter={onMouseEnter}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.action?.();
              // Don't close on label toggle — allow multi-apply
              if (item.checked == null) {
                onClose();
              }
            }}
            className={`${menuRow} ${
              item.disabled
                ? "text-text-tertiary cursor-default"
                : menuHover
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              {item.checked != null ? (
                item.checked ? <Check size={12} className="text-accent" /> : null
              ) : Icon ? (
                <Icon size={12} />
              ) : null}
            </span>
            <span className="flex-1 truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
