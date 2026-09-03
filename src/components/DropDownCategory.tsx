import { CATEGORIES } from "../types";
import type { Category } from "../types";

/**
 * Pick a challenge category.
 */
export function DropDownCategory({
  value,
  onChange,
}: {
  value: Category;
  onChange: (category: Category) => void;
}) {
  return (
    <select
      className="pill"
      value={value}
      onChange={(event) => onChange(event.target.value as Category)}
    >
      {CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {category.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
