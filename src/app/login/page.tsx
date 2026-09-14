import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <header className="topbar">
        <h1>
          תיקי נסיעה
          <span className="sub">כניסה</span>
        </h1>
      </header>
      <LoginForm next={next ?? ""} />
    </>
  );
}
