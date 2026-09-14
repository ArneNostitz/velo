import { useState, useCallback, useRef } from "react";
import { Plus } from "lucide-react";

interface TaskQuickAddProps {
  onAdd: (title: string) => void | Promise<void>;
  placeholder?: string;
}

export function TaskQuickAdd({ onAdd, placeholder = "Add a task..." }: TaskQuickAddProps) {
  const [value, setValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isAdding) return;
    setIsAdding(true);
    try {
      await onAdd(trimmed);
      setValue("");
      inputRef.current?.focus();
    } finally {
      setIsAdding(false);
    }
  }, [value, onAdd, isAdding]);

  return (
    <div className="task-quick-add flex items-center gap-2 px-3 py-2.5">
      <Plus size={15} className="text-accent/70 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isAdding}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none disabled:opacity-60"
      />
    </div>
  );
}
