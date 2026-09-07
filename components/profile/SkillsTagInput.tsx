"use client";

import { useState, type KeyboardEvent } from "react";
import { Tag } from "@/components/ui/Tag";

export function SkillsTagInput({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const normalized = draft.trim().toLowerCase();
    if (normalized && !skills.includes(normalized)) {
      onChange([...skills, normalized]);
    }
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <label
        htmlFor="skills-input"
        className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2"
      >
        Skills
      </label>
      <div
        role="list"
        className="flex flex-wrap items-center gap-2 border border-border bg-surface px-[12px] py-[10px] focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary"
      >
        {skills.map((skill) => (
          <span key={skill} role="listitem">
            <Tag
              variant="skill"
              removable={{
                label: skill,
                onRemove: () => onChange(skills.filter((s) => s !== skill)),
              }}
            >
              {skill}
            </Tag>
          </span>
        ))}
        <input
          id="skills-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={skills.length === 0 ? "Add a skill…" : undefined}
          className="min-w-[120px] flex-1 border-0 bg-transparent font-body text-[13px] text-ink placeholder:text-muted focus:outline-none"
        />
      </div>
    </div>
  );
}
