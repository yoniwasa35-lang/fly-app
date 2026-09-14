import Link from "next/link";
import { NewClientForm } from "./NewClientForm";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <>
      <header className="topbar">
        <h1>
          לקוח חדש
          <span className="sub">שם וטלפון מספיקים. השאר אפשר להשלים אחר כך.</span>
        </h1>
        <Link className="btn" href="/clients">
          ביטול
        </Link>
      </header>

      <NewClientForm />
    </>
  );
}
