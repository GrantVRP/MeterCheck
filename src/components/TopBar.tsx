import Link from "next/link";
import { BackIcon } from "./Icons";

/** One "Back" button, top left. Inherits the screen's text colour. */
export function TopBar({ href = "/", label = "Back" }: { href?: string; label?: string }) {
  return (
    <nav className="topbar" aria-label="Back">
      <Link href={href} className="pill">
        <BackIcon />
        {label}
      </Link>
    </nav>
  );
}
