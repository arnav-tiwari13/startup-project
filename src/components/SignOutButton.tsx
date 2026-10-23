import { signOut } from "../auth";
import { href } from "../router";

export default function SignOutButton() {
  const onClick = async () => {
    await signOut();
    window.location.hash = href("home");
  };
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent">
      Sign out
    </button>
  );
}
